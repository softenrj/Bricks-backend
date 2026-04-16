//? ArchForge Engin
// #region ---------- ArchForge ---------
import mongoose from "mongoose";
import getVectorEmbedding from "../service/vectorTransformer.js";
import { FileVector } from "../model/file_vectors.js";
import { IProjectFile, ProjectFile } from "../model/project_files.js";
import { buildAsciiTree } from "../service/treeNodeBuilder.js";
import { AI_MODULE, Google_GenAI } from "../config/groqSdkConfig.js";
import { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions.mjs";
import { ArchEnginStatusSocket } from "../sockets/ArchEnginProcess.js";
import { processIdProvider, uIdProvider } from "../service/user.uidProvider.js";
import { archSSEmanager } from "../serversideevents/ArchSSEManager.js";
import { codeGenPrompt, folderStructurePrompt, promptCraftMaster } from "./ArchPrompts.js";
import { Snapshot, snapshotEnum } from "../model/snapshot.js";
import { snapShotFile } from "../model/snapshotfile.js";
import { uploadFiles } from "../middleware/fileUpload.js";

interface Process {
    prompt: string;
    userId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    cursor_fileId: mongoose.Types.ObjectId;
    jobId: string;
}

interface ArchFileContext {
    _id: mongoose.Types.ObjectId;
    context: {
        fileId: mongoose.Types.ObjectId;
        snippet: string;
        filePath: string;
        imports: string[];
        exports: string[];
        fileType: string;
        isDefault: boolean;
    }
}
export type FileAction = "create" | "modify" | "retain";

type ProjectPlan = {
    [filePath: string]: {
        action: "create" | "modify";
        role: "app-entry" | "page" | "layout" | "component" | "state" | "utility";
        responsibilities: string[];
        constraints?: string[];
        inputs?: string[];
        outputs?: string[];
    };
};

export interface ArchProjectCode {
    path: string;
    content: string;
    dependency?: string;
}

interface snaps {
    path: string;
    content: string | null;
    action: string;
}

type GenerationRequest = {
    task: "create" | "modify";
    targetFile: string;
    architecturalResponsibilities: string[];
    constraints: string[];
    existingFileContent: string | null;
};
export default class ArchForge {

    public static async _process_(processArgs: Process) {
        //! assume there is text only (Version 1)

        await this.lexicalArchPipeLine(processArgs);
    }

    // #region ------- Laxical ArchPipeLine --------
    private static async lexicalArchPipeLine(processArgs: Process): Promise<any> {
        try {
            const { prompt, projectId, userId, cursor_fileId, jobId } = processArgs;

            const processId = processIdProvider();
            this.pushToUser("🔍 Analyzing your request and scanning related project files...", projectId, userId, processId, "render");

            // -------------- RAG ---------------------------
            const queryVector = await getVectorEmbedding(prompt);

            const relatedFiles = await FileVector.aggregate([{
                $vectorSearch: {
                    index: "vector_index",
                    path: "vector",
                    queryVector,
                    numCandidates: 380,
                    limit: 12,
                    filter: { projectId: new mongoose.Types.ObjectId(projectId) }
                },
            },
            { $project: { fileId: 1, contextId: 1, score: { $meta: "vectorSearchScore" } } },
            {
                $lookup: {
                    from: "filecontexts",
                    localField: "contextId",
                    foreignField: "_id",
                    as: "context",
                },
            },
            { $unwind: "$context" },
            { $match: { "context.isDefault": false } },
            {
                $project: {
                    score: { $meta: "vectorSearchScore" },
                    projectId: 1,
                    context: {
                        isDefault: 1,
                        imports: 1,
                        exports: 1,
                        snippet: 1,
                        fileId: 1,
                        fileType: 1,
                        filePath: 1,
                    }
                }
            },
            ])

            const context = [];

            relatedFiles.sort((cadidateA, candidateB) => candidateB.score - cadidateA.score);
            const seen = new Set<string>();

            for (const file of relatedFiles) {
                if (context.length === 6) break;
                const fileId = file._id.toString();
                if (!seen.has(fileId)) {
                    seen.add(fileId);
                    context.push(file);
                }
            }

            const codeBase = await this.projectTree(projectId, userId)

            this.pushToUser("-", projectId, userId, processId, "complete");

            const plannerScript = await this.archProjectPlanner(context, codeBase, prompt, projectId, userId);

            const snapids = await this.ArchCodeGenerator(context, plannerScript, projectId, userId, jobId)
            archSSEmanager.complete(jobId, snapids);
        } catch (error) {
            console.error("Error in lexicalArchEngin:", error);
            return null;
        }
    }
    // #endregion


    private static async projectTree(projectId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId): Promise<string> {
        try {
            const projectFile = (await ProjectFile.find({ projectId, userId }, { content: 0 }).lean()) as unknown as IProjectFile[];

            const treeNode = buildAsciiTree(projectFile);
            return treeNode;
        } catch (error) {
            console.error("Error in ProjectTree ArchEngin:", error);
            return "";
        }
    }

    // #region ------ AI CodeFile Generation ------
    private static async ArchCodeGenerator(
        fileContexts: ArchFileContext[],
        planedScript: ProjectPlan,
        projectId: mongoose.Types.ObjectId,
        userId: mongoose.Types.ObjectId,
        jobId: string
    ): Promise<{ snapv1Id: string, snapv2Id: string } | null> {
        try {

            let planKeys = Object.entries(planedScript).sort(([, a], [, b]) => {
                if (a.action === "create" && b.action === "modify") return -1;
                if (a.action === "modify" && b.action === "create") return 1;
                return 0;
            })
                .map(([path]) => path);

            const allowedImportsContext = fileContexts
                .map(fc => `- ${fc.context.filePath}: exports [${fc.context.exports.join(", ")}]`)
                .join("\n");

            const plannedFilesContext = Object.entries(planedScript)
                .map(([path, info]) => `- ${path}: role=${info.role}`)
                .join("\n");


            const lagacyCode = new Map<string, string>();

            await Promise.all(planKeys.map(async (key) => {
                const action = planedScript[key].action;

                if (action === "create") return;

                const code = await this.fileCodeProvider(key, projectId);
                lagacyCode.set(key, code);
            }))

            const parentFiles: snaps[] = planKeys.map((key) => {
                const file = planedScript[key];
                return {
                    action: file.action,
                    content: lagacyCode.has(key) ? lagacyCode.get(key)! : null,
                    path: key
                }
            });

            const enrichedFiles: snaps[] = [];

            // ---------------------- Batch Process ---------------

            const batchSize = 3;
            const batches: string[][] = [];

            for (let i = 0; i < planKeys.length; i += batchSize) {
                batches.push(planKeys.slice(i, i + batchSize));
            }

            const enrichedRequests = await Promise.all(
                batches.map(async (batch) => {

                    const enrichedRequest = await Promise.all(
                        batch.map(async (filePath) => {
                            const info = planedScript[filePath];

                            return {
                                task: info.action,
                                targetFile: filePath,
                                architecturalResponsibilities: info.responsibilities,
                                constraints: info.constraints ?? [],
                                existingFileContent: lagacyCode.get(filePath) ?? null
                            };
                        })
                    );

                    return enrichedRequest
                })
            );


            for (let i = 0; i < enrichedRequests.length; i++) {

                const processMap = new Map<string, GenerationRequest>();

                for (const req of enrichedRequests[i]) {


                    const tempProcessId = processIdProvider();
                    processMap.set(tempProcessId, req);
                    this.pushToUser(
                        `🛠️ ${req.task === "create" ? "Creating" : "Modifying"}: ${req.targetFile} • ${req.architecturalResponsibilities}`,
                        projectId,
                        userId,
                        tempProcessId,
                        "render"
                    );
                }

                const systemPrompt = codeGenPrompt;

const userMessage = `
                                    You are a Principal-Level Senior React + TypeScript Architect.

                                    ========================
                                    FILE GENERATION TASKS
                                    ========================
                                    You must generate code for EACH task listed below.

                                    Each task represents ONE file that must be created or modified.

                                    For every task:
                                    - Follow the architecturalResponsibilities exactly
                                    - Respect all constraints
                                    - If task = "modify", rewrite the FULL file using existingFileContent as the base
                                    - If task = "create", generate a complete new file

                                    Tasks:
                                    ${JSON.stringify(enrichedRequests[i], null, 2)}

                                    IMPORTANT:
                                    You MUST generate ONE output object for EACH task above.

                                    The number of output files MUST match the number of tasks.

                                    Return them in the same order.
                                    ========================
                                    PLANNED FILE ROLES
                                    ========================
                                    These files are part of the same change set and may not exist yet.

                                    ${plannedFilesContext}

                                    ========================
                                    ALLOWED IMPORTS
                                    ========================
                                    ${allowedImportsContext}

                                    ========================
                                    UI DESIGN FREEDOM (TASK-SPECIFIC)
                                    ========================
                                    This file is a USER-FACING UI component.
                                                
                                    You are FREE and ENCOURAGED to use your full creativity to design
                                    a visually outstanding, modern, clean, and professional UI.
                                                
                                    You MAY creatively decide:
                                    - Layout and spacing
                                    - Typography hierarchy
                                    - Color palette and gradients
                                    - Visual emphasis and depth
                                    - Subtle animations and micro-interactions
                                    - Hover and focus states
                                                
                                    The UI should feel like a real product, not tutorial code.
                                                
                                    BOUNDARIES:
                                    - Do NOT add new features, logic, or flows beyond the responsibilities.
                                    - Do NOT violate constraints.
                                    - Any state or animation must exist ONLY to improve UI/UX.


                                    ========================
                                    IMPLEMENTATION RULES (MANDATORY)
                                    ========================
                                    1. Follow IMPLEMENTATION STEPS exactly — do not add extra features.
                                    2. Prefer the SIMPLEST working solution.
                                    3. Code MUST compile in React (Vite) + TypeScript strict mode.
                                    4. No unused imports, variables, props, or hooks.
                                    5. No console.logs, TODOs, commented code, or noise.
                                    6. Minimal comments — only where logic is non-obvious.
                                    7. Clean naming and readable logic.
                                    8. Styling rules:
                                       - If creating a NEW file → Tailwind CSS only.
                                       - If modifying an EXISTING file → preserve existing styling approach.

                                    ========================
                                    STRICT OUTPUT FORMAT (JSON ONLY)
                                    ========================
                                    Return ONLY a valid JSON object.
                                    NO markdown.
                                    NO explanations.
                                    NO extra text.

                                    Schema:
                                    [{
                                      "fileName": "ExactFileName.tsx",
                                      "path": "src/relative/path/ExactFileName.tsx",
                                      "content": "FULL FILE CONTENT AS A JSON STRING"
                                    }, so on..]
                                    Note: you have to give Array of object that is as above format

                                    ========================
                                    JSON SAFETY (CRITICAL)
                                    ========================
                                    Return ONLY valid JSON.

                                    Rules:
                                    - The response MUST contain JSON only.
                                    - Do NOT include markdown.
                                    - Do NOT include explanations or extra text.
                                    - Do NOT include comments.
                                    - The output MUST start with [ and end with ].
                                    - Each object in the array must follow the schema exactly.
                                    - Do NOT include trailing commas.
                                    - Ensure the JSON is valid and parseable by JSON.parse().
                                                
                                    Schema:
                                                
                                    [
                                      {
                                        "fileName": "ExactFileName.tsx",
                                        "path": "src/relative/path/ExactFileName.tsx",
                                        "content": "FULL FILE CONTENT"
                                      }
                                    ]

                                    ========================
                                    FINAL VERIFICATION (DO NOT SKIP)
                                    ========================
                                    Before returning the response, verify the following:

                                    1. The output is valid JSON.
                                    2. The JSON array contains exactly one object for each requested task.
                                    3. Each object strictly follows the required schema.
                                    4. The "path" matches the requested target file.
                                    5. The "fileName" matches the file name in the path.
                                    6. The "content" field contains the complete file code.
                                    7. The generated code compiles in React (Vite) with TypeScript strict mode.
                                    8. JSX syntax is valid.
                                    9. React Hooks rules are respected.
                                    10. Imports only reference allowed files.
                                    11. No unused imports, variables, or props exist.
                                    12. No TODOs, console logs, or commented-out code remain.
                                                
                                    If any rule fails, FIX the issue before producing the final JSON output.
                                `;

                const messages: ChatCompletionMessageParam[] = [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ];

                let raw = "";

                try {
                    try {
                        const response = await Google_GenAI.models.generateContent({
                            model: "gemini-2.5-flash",
                            contents: [
                                {
                                    role: "user",
                                    parts: [
                                        { text: systemPrompt },
                                        { text: userMessage },
                                    ],
                                },
                            ],
                        });
                        const text = response?.text?.trim() || "";
                        raw = text.replace(/^(```[\w]*\n)|(\n```)$|(```)$/g, "").trim();

                    } catch (err) {


                        const completion = await AI_MODULE.chat.completions.create({
                            model: "Llama-3.3-70B-Versatile",
                            messages,
                            temperature: 0.3,
                            response_format: { type: "json_object" }
                        });
                        raw = completion.choices?.[0]?.message?.content || "{}";
                    }

        
                    let generatedCodeArray: ArchProjectCode[] = [];


                    try {
                        generatedCodeArray = this.extractAndParseJSON(raw);

                        for (const generatedCode of generatedCodeArray) {
                            const tempProcessId = processIdProvider();

                            this.pushToUser("", projectId, userId, tempProcessId, "render");

                            archSSEmanager.send(jobId, "file", {
                                ...generatedCode,
                                projectId
                            });

                            const request = enrichedRequests[i].find(r => r.targetFile === generatedCode.path);

                            enrichedFiles.push({
                                path: generatedCode.path,
                                content: generatedCode.content,
                                action: request?.task ?? "create"
                            });
                            this.pushToUser("", projectId, userId, tempProcessId, "complete");
                        }

                    } catch (err) {
                        console.error("Invalid JSON from model:", raw);
                    }

                    // await this.handleMissingImports(generatedCode, planedScript);

                    // planKeys = Object.keys(planedScript);

                } catch (error) {
                    console.error("Error:", error);
                } finally {
                    for (const [processId, req] of processMap) {

                        this.pushToUser(
                            `🛠️ ${req.task === "create" ? "Creating" : "Modifying"}: ${req.targetFile} • ${req.architecturalResponsibilities}`,
                            projectId,
                            userId,
                            processId,
                            "complete"
                        );
                    }
                }
            }



            const snapprocess = processIdProvider()
            this.pushToUser(
                `🛠️ snapshot is ready`,
                projectId,
                userId,
                snapprocess,
                "complete"
            );

            const snapshotv1Id = await this.snapshot(snapshotEnum.ACTIVE, userId, projectId, parentFiles, null);
            const snapshotv2Id = await this.snapshot(snapshotEnum.DRAFT, userId, projectId, enrichedFiles, snapshotv1Id);
            this.pushToUser(
                `🛠️ snapshot is ready`,
                projectId,
                userId,
                snapprocess,
                "complete"
            );

            return { snapv1Id: snapshotv1Id, snapv2Id: snapshotv2Id } as any;

        } catch (error) {
            console.error("ArchCodeGenerator Failed:", error);
            return null;
        }
    }


    private static async snapshot(
        state: snapshotEnum,
        userId: mongoose.Types.ObjectId,
        projectId: mongoose.Types.ObjectId,
        files: snaps[],
        parentSnapshotId: mongoose.Types.ObjectId | null
    ): Promise<mongoose.Types.ObjectId | null> {
        try {
            const snap = await Snapshot.create({
                userId,
                projectId,
                parentSnapshot: parentSnapshotId,
                status: state
            });

            if (!files.length) return snap._id;

            const bulkOps = files.map(file => ({
                insertOne: {
                    document: {
                        userId,
                        projectId,
                        snapshotId: snap._id,
                        path: file.path,
                        content: file.content
                    }
                }
            }));

            await snapShotFile.bulkWrite(bulkOps);

            return snap._id;
        } catch (error) {
            console.error("Snapshot Failed:", error);
            return null;
        }
    }



    private static async handleMissingImports(
        generated: ArchProjectCode,
        plan: ProjectPlan
    ): Promise<void> {
        const imports = this.extractImports(generated.content);

        for (const imp of imports) {
            const path = this.resolveImportPath(imp);
            if (!path) continue;

            if (!plan[path]) {
                plan[path] = {
                    responsibilities: [`Auto-generated dependency for ${generated.path}`],
                    action: "create",
                    role: "utility"
                };
            }
        }
    }


    private static extractImports(content: string): string[] {
        const regex = /import\s+(?:[^;]+?)\s+from\s+['"]([^'"]+)['"]/g;
        const imports: string[] = [];
        let match;

        while ((match = regex.exec(content)) !== null) {
            imports.push(match[1]);
        }
        return imports;
    }

    private static resolveImportPath(imp: string): string | null {
        // Skip external packages
        if (!imp.startsWith("@/")) return null;

        let path = imp.replace("@/", "src/");
        if (!path.endsWith(".tsx")) {
            path += ".tsx";
        }
        return path;
    }



    private static async fileCodeProvider(
        filePath: string,
        projectId: mongoose.Types.ObjectId
    ): Promise<string> {
        try {
            const segments = filePath.split('/');
            const fileName = segments.pop();

            const dirPath = segments.length > 0 ? segments.join('/') : "."; // "src"
            const file = await ProjectFile.findOne({
                name: fileName,
                projectId,
                path: dirPath
            });

            return file?.content ?? "";
        } catch (error) {
            console.error("Error in fileCodeProvider ArchEngin:", error);
            return "";
        }
    }
    // #endregion

    private static pushToUser(message: string, projectId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId, processId: string, state: "render" | "complete"): void {
        try {
            ArchEnginStatusSocket.__push({
                id: uIdProvider(),
                processId: processId,
                process: state,
                message: message
            }, userId)
        } catch (error) {
            console.error("Error in ArchPush TO User ArchEngin:", error);
            return;
        }
    }

    // #region ------ AI planner ------

    private static async archProjectPlanner(
        fileContexts: ArchFileContext[],
        projectTree: string,
        userPrompt: string,
        projectId: mongoose.Types.ObjectId,
        userId: mongoose.Types.ObjectId
    ): Promise<ProjectPlan> {
        try {
            const processId = processIdProvider();
            this.pushToUser("🧠 Analyzing project and planning required changes...", projectId, userId, processId, "render");
            const optimizedContext = this.formatContextForPlanner(fileContexts);

            // ENHANCED: Force classification and rule enforcement
            const enhancedSystemPrompt = `You are a Senior Software Architect and React/TypeScript expert.

========================
INPUT DATA
========================
1. Project Tree: ${projectTree}
2. Existing Exports: ${optimizedContext}
3. User Request: "${userPrompt}"

========================
MANDATORY: CLASSIFY THE REQUEST FIRST
========================
Read the user request CAREFULLY and classify it as ONE type:

**"ui-only"** (VISUAL DESIGN):
- Keywords: beautiful, animated, modern, clean, aesthetic, design, styling, colors, spacing, typography, layout, hero section, top section, visual hierarchy, wow, premium, attractive, impressive, smooth animations, hover effects
- Example: "make it beautiful", "add animations", "improve the design", "redesign the hero section"

**"architectural"** (NEW STRUCTURE):
- Keywords: new page, new route, new screen, navigation, multiple pages, section, todo app (if it implies a new page)
- Example: "add a new page", "create a todo page", "add routing"

**"behavioral"** (LOGIC/STATE):
- Keywords: when, on click, form, state, calculation, validation, logic, functionality, CRUD, show message, success message, button click
- Example: "when clicking the button", "add form validation", "calculate total", "manage user input"

========================
DIFFERENT RULES FOR EACH CLASSIFICATION
========================

=== RULES FOR "ui-only" REQUESTS ===
1. ONLY modify existing files (App.tsx or existing component) - do NOT create new files.
2. NO new state (useState, useEffect, useReducer).
3. NO routing changes.
4. NO conditional rendering based on flags or state.
5. Focus ONLY on: animations, spacing, typography, colors, gradients, layout, hover effects.
6. Do NOT introduce global style changes (like index.css) unless the user explicitly asks for a global theme.

=== RULES FOR "architectural" REQUESTS ===
1. CREATE new files for new pages/components.
2. MODIFY existing files for wiring (routing, imports).
3. Use appropriate state management for the feature.
4. Keep routing minimal and clean.
5. Structure files logically (pages/, components/).
6. Respect existing architecture patterns.

=== RULES FOR "behavioral" REQUESTS ===
1. Modify or create components for the functionality.
2. Add necessary state and effects.
3. Follow React best practices (cleanup, dependencies).
4. No unnecessary UI polish (unless requested).
5. Focus on correctness and functionality.

========================
CHECK FOR CONTRADICTIONS (CRITICAL)
========================
BEFORE outputting, verify:
1. Responsibilities MUST match constraints.
2. If the request is UI-only, do NOT create new files.
3. If the request is architectural, ensure new page files are created.
4. Constraints must NOT forbid what responsibilities require (e.g., if you need to show a message on click, you must allow state and conditional rendering).

========================
EXAMPLE OUTPUTS
========================

=== EXAMPLE 1: UI-only request ===
Request: "Make this page more beautiful and modern with smooth animations"
Output:
{
  "src/App.tsx": {
    "description": "Enhance existing UI with smooth animations and modern design",
    "action": "modify",
    "role": "app-entry",
    "responsibilities": [
      "Add smooth entrance animations to main content",
      "Update color scheme to a modern palette",
      "Improve spacing and typography for better visual hierarchy",
      "Add subtle hover effects to interactive elements"
    ],
    "constraints": [
      "Do not introduce new state or effects",
      "Do not change routing or create new pages",
      "Do not add conditional rendering logic",
      "Only modify styles and animations in this file"
    ]
  }
}

=== EXAMPLE 2: Behavioral request ===
Request: "When clicking the button, show a success message with animation"
Output:
{
  "src/App.tsx": {
    "description": "Add button click handler to show animated success message",
    "action": "modify",
    "role": "app-entry",
    "responsibilities": [
      "Add state to track whether button is clicked",
      "Conditionally render success message when button is clicked",
      "Animate the success message entrance and exit",
      "Style the success message appropriately"
    ],
    "constraints": [
      "Do not change routing or create new pages",
      "Keep the animation lightweight and non-intrusive"
    ]
  }
}

=== EXAMPLE 3: Architectural request ===
Request: "Add a new page to build a fictional todo app"
Output:
{
  "src/App.tsx": {
    "description": "Wire new Todo page into application routing",
    "action": "modify",
    "role": "app-entry",
    "responsibilities": [
      "Add route for Todo page",
      "Import and include TodoPage component"
    ],
    "constraints": [
      "Keep existing routes unchanged",
      "No visual redesign of other pages"
    ]
  },
  "src/pages/TodoPage.tsx": {
    "description": "Create fictional Todo page with mock functionality",
    "action": "create",
    "role": "page",
    "responsibilities": [
      "Render todo list UI with add/remove functionality",
      "Manage todo items with local component state",
      "Provide clear user feedback for actions"
    ],
    "constraints": [
      "No backend integration required",
      "Use mock data or local state only"
    ]
  }
}

========================
NOW ANALYZE THE CURRENT REQUEST
========================
Request: "${userPrompt}"

Classification Reasoning:
[Think step by step about the keywords and intent]

Final Classification: [ui-only|architectural|behavioral]

Based on this classification, apply the appropriate rules above.

========================
OUTPUT FORMAT (STRICT JSON ONLY)
========================
Return ONLY a JSON object mapping file paths to file contracts.
Ensure no contradictions between responsibilities and constraints.`;

            const messages: ChatCompletionMessageParam[] = [
                { role: "system", content: enhancedSystemPrompt },
                {
                    role: "user",
                    content: `Based on project tree and request, provide MINIMAL plan for: "${userPrompt}"`
                }
            ];

            const completion = await AI_MODULE.chat.completions.create({
                model: "llama-3.1-8b-instant",
                messages: messages,
                temperature: 0.1, // Very low temperature to prevent creativity
                response_format: { type: "json_object" }
            });

            const content = completion.choices[0]?.message?.content || "{}";
            const plan: ProjectPlan = JSON.parse(content);


            this.pushToUser("", projectId, userId, processId, "complete");
            return plan;
        } catch (error) {
            console.error(" ArchEngine Planner Error:", error);
            return {};
        }
    }

    // #endregion

    private static formatContextForPlanner = (files: ArchFileContext[]): string => {
        return files.map(f => {
            return `File: ${f.context.filePath}
            Type: ${f.context.fileType}
            Exports: ${f.context.exports.join(", ")}`;
        }).join("\n---\n");
    };

    private static extractAndParseJSON(str: string): any[] {
        // Clean out any Non-Breaking Spaces the LLM
        const cleanedStr = str.replace(/\u00A0/g, " ");

        const startArr = cleanedStr.indexOf("[");
        const endArr = cleanedStr.lastIndexOf("]");
        const startObj = cleanedStr.indexOf("{");
        const endObj = cleanedStr.lastIndexOf("}");

        try {
            if (startArr !== -1 && endArr !== -1 && (startArr < startObj || startObj === -1)) {
                const arrStr = cleanedStr.slice(startArr, endArr + 1);
                return JSON.parse(arrStr);
            }

            else if (startObj !== -1 && endObj !== -1) {
                const objStr = cleanedStr.slice(startObj, endObj + 1);
                const parsedObj = JSON.parse(objStr);
 
                return [parsedObj];
            }
        } catch (e) {
            console.error("Failed to parse LLM JSON:", e, "Raw output:", cleanedStr);
            return [];
        }

        return [];
    }

}

