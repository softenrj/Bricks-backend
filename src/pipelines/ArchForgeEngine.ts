//? ArchForge Engin
// #region ---------- ArchForge ---------
import mongoose from "mongoose";
import getVectorEmbedding from "../service/vectorTransformer.js";
import { FileVector } from "../model/file_vectors.js";
import { IProjectFile, ProjectFile } from "../model/project_files.js";
import { buildAsciiTree } from "../service/treeNodeBuilder.js";
import { AI_MODULE } from "../config/groqSdkConfig.js";
import { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions.mjs";
import { ArchEnginStatusSocket } from "../sockets/ArchEnginProcess.js";
import { processIdProvider, uIdProvider } from "../service/user.uidProvider.js";

interface Process {
    prompt: string;
    userId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    cursor_fileId: mongoose.Types.ObjectId;
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
export interface ProjectPlan {
    [filePath: string]: {
        description: string;
        action: FileAction;
    };
}
export interface ArchProjectCode {
    fileName: string;
    path: string;
    content: string;
    dependency?: string;
}
export default class ArchForge {

    public static async _process_(processArgs: Process) {
        //! assume there is text only (Version 1)
        const { prompt } = processArgs;

        //? validate + sanitize
        const safePrompt = this.validatePrompt(prompt);
        processArgs.prompt = safePrompt;

        await this.lexicalArchPipeLine(processArgs);
    }

    /**
     * todo Sanitizes a prompt by removing unsafe characters/patterns.
     * @param prompt 
     * @returns 
     */
    private static validatePrompt(prompt: string): string {
        const pattern = /\s+\W/g;
        const safePrompt = prompt.replace(pattern, " ");
        return safePrompt.trim();
    }

    // #region ------- Laxical ArchPipeLine --------
    /**
     * ! laxical ArchPipeLine
     * @param processArgs 
     * @returns 
     */
    private static async lexicalArchPipeLine(processArgs: Process): Promise<any> {
        try {
            const { prompt, projectId, userId, cursor_fileId } = processArgs;
            //? Inform to User
            const processId = processIdProvider();
            this.pushToUser("🔍 Analyzing your request and scanning related project files...", projectId, userId, processId, "render");
            const queryVector = await getVectorEmbedding(prompt);
            const relatedFiles = await FileVector.aggregate([{
                $vectorSearch: {
                    index: "vector_index",
                    path: "vector",
                    queryVector,
                    numCandidates: 380,
                    limit: 5,
                    filter: { projectId }
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
            /**
             * Now we have the Most Promising Files to work with
             * ? context
             * ? And Project Tree in Acii Format 
             */

            const codeBase = await this.projectTree(projectId, userId)

            //? Inform to User
            this.pushToUser("-", projectId, userId, processId, "complete");
            //todo pass to Next 
            const plannerScript = await this.archProjectPlanner(relatedFiles, codeBase, prompt, projectId, userId);
            //todo Recursive File Generation
            this.ArchCodeGenerator(plannerScript, projectId, userId)
        } catch (error) {
            console.error("Error in lexicalArchEngin:", error);
            return null;
        }
    }
    // #endregion

    /**
     * 
     * @param projectId 
     * @param userId 
     * @returns 
     */
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
    /**
     * todo Generate Each File's code
     * @param planedScript 
     * @param projectId 
     * @returns 
     */
    private static async ArchCodeGenerator(
        planedScript: ProjectPlan,
        projectId: mongoose.Types.ObjectId,
        userId: mongoose.Types.ObjectId
    ): Promise<void> {
        try {

            let planKeys = Object.keys(planedScript);

            for (let i = 0; i < planKeys.length; i++) {
                const filePath = planKeys[i];
                const info = planedScript[filePath];

                const tempProcessId = processIdProvider();
                const action = info.action;

                if (action === "retain") continue;

                let fileCode: string | null = null;

                if (action === "modify") {
                    fileCode = await this.fileCodeProvider(filePath, projectId);
                }
                const otherFilesContext = Object.entries(planedScript)
                    .map(([path, info]) => `- ${path}: ${info.description}`)
                    .join("\n");

                this.pushToUser(
                    `🛠️ ${action === "create" ? "Creating" : "Modifying"}: ${filePath} • ${info.description}`,
                    projectId,
                    userId,
                    tempProcessId,
                    "render"
                );

                const systemPrompt = `You are an expert Senior Full Stack React Architect. 
                    Your specific goal is to generate or modify code for a React (Vite) + TypeScript project.

                    ### TECHNOLOGY STACK PREFERENCES:
                    - Framework: React (Vite)
                    - Language: TypeScript (Strict mode, proper interfaces)
                    - Styling: Tailwind CSS (Utility-first, mobile-first approach)
                    - Icons: Lucide-React
                    - Architecture: Functional components, Hooks-based logic.

                    ### STRICT OUTPUT FORMAT:
                    You must output ONLY a valid, parseable JSON object. 
                    DO NOT include markdown blocks (like \`\`\`json). 
                    DO NOT include conversational text.

                    The JSON structure must be:
                    {
                      "fileName": "The filename with extension (e.g., App.tsx)",
                      "path": "The relative file path (e.g., src/components/App.tsx)",
                      "content": "THE_FULL_FILE_CONTENT_HERE"
                    }

                    ### CRITICAL RULES:
                    1. **JSON Safety**: The "content" field must be a valid JSON string. You must properly escape newlines (\\n) and double quotes (\\").
                    2. **Completeness**: Never use placeholder comments like "// ... rest of code". Return the FULL, executable code.
                    3. **Imports**: Verify imports against the provided "PROJECT CONTEXT". Do not hallucinate files that are not listed.
                    4. **Modifications**: If modifying an existing file, do not return a diff. Return the ENTIRE file content with the changes integrated.
                    5. **ShadCn UI**: If the path includes 'components/ui', treat it as a standard ShadCn component—do not modify logic unless explicitly requested.
                `;
                            
                const userMessage = `
                    ### TASK REQUEST
                    **Action:** ${action} (Values: "create" | "modify")
                    **Target File:** ${filePath}
                    **Description:** ${info.description}

                    ### PROJECT CONTEXT (File Tree & Exports)
                    Use this list to ensure imports are correct and relative paths are accurate:
                    ${otherFilesContext}

                    ${fileCode ? `
                    ### EXISTING FILE CONTENT
                    (You must rewrite this file completely with the requested changes applied)
                    ${fileCode}
                    ` : ''}

                    ### IMPLEMENTATION STEPS
                    1. Analyze the "Description" and "Action".
                    2. If "Action" is "create": Scaffolding a new component/file with proper Tailwind styling.
                    3. If "Action" is "modify": Read "EXISTING FILE CONTENT", apply changes, and output the FULL merged result.
                    4. Ensure all variables are typed (TypeScript).
                    5. Output the final JSON.
                `;

                const messages: ChatCompletionMessageParam[] = [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ];

                try {
                    const completion = await AI_MODULE.chat.completions.create({
                        model: "Llama-3.3-70B-Versatile",
                        messages,
                        temperature: 0.3,
                        response_format: { type: "json_object" }
                    });

                    const raw = completion.choices?.[0]?.message?.content || "{}";
                    const generatedCode: ArchProjectCode = JSON.parse(raw);

                    await this.handleMissingImports(generatedCode, planedScript);

                    planKeys = Object.keys(planedScript);

                    this.pushToUser("", projectId, userId, tempProcessId, "render");

                    ArchEnginStatusSocket._code(
                        {
                            ...generatedCode,
                            projectId
                        },
                        userId
                    );
                } catch (error) {
                    console.error("Error:", error);
                } finally {
                    this.pushToUser(
                        `🛠️ ${action === "create" ? "Creating" : "Modifying"}: ${filePath} • ${info.description}`,
                        projectId,
                        userId,
                        tempProcessId,
                        "complete"
                    );
                }
            }
        } catch (error) {
            console.error("ArchCodeGenerator Failed:", error);
        }
    }

    /**
     * 
     * @param generated 
     * @param plan 
     */
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
                    description: `Auto-generated dependency for ${generated.fileName}`,
                    action: "create"
                };
            }
        }
    }

    /**
     * 
     * @param content 
     * @returns 
     */
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


    /**
     * 
     * @param filePath 
     * @param projectId 
     * @returns 
     */
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
    /**
     * 
     * @param fileContexts 
     * @param projectTree 
     * @param userPrompt 
     * @param projectId 
     * @param userId 
     * @returns 
     */
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

            const systemPrompt = `
                You are a Senior Software Architect. 
                Your goal is to plan a file structure changes based on a User Request.

                INPUT DATA:
                1. **Project Tree**: The current folder structure.
                2. **Existing Exports**: A summary of existing files and what they export.

                INSTRUCTIONS:
                - Analyze the User Request against the existing structure.
                - **CRITICAL:** You must decide the "action" for each file:
                   - "create": New file needed.
                   - "modify": Existing file needs changes (add code/fix bugs).
                   - "retain": Existing file is perfect, NO changes needed.
                   - DO NOT include any useless files only files that need to create or modified

                - Return a JSON object where keys are file paths and values are objects containing:
                   - "description": Purpose of the file.
                   - "action": One of "create", "modify", "retain".

                STRICT OUTPUT FORMAT (JSON ONLY):
                {
                  "src/components/Header.tsx": { "description": "Add user login state", "action": "modify" },
                  "src/components/Footer.tsx": { "description": "Standard footer", "action": "retain" },
                  "src/pages/NewPage.tsx": { "description": "New marketing page", "action": "create" }
                }
            `;

            // C. Construct User Message
            const userMessage = `
                Current Project Tree:
                ${projectTree}
                Existing File Context (Exports & Types):
                ${optimizedContext}
                USER REQUEST:
                "${userPrompt}"
            `;

            const messages: ChatCompletionMessageParam[] = [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ];

            // D. Call AI Model
            const completion = await AI_MODULE.chat.completions.create({
                model: "llama-3.1-8b-instant",
                messages: messages,
                temperature: 0.3, // Low temp for structural consistency
                response_format: { type: "json_object" }
            });

            const content = completion.choices[0]?.message?.content || "{}";

            // E. Parse & Validate
            const plan: ProjectPlan = JSON.parse(content);
            // todo Planner Done There Job
            this.pushToUser("", projectId, userId, processId, "complete");
            return plan;
        } catch (error) {
            console.error(" ArchEngine Planner Error:", error);
            // Return empty plan ensures pipeline doesn't crash, just stops
            return {};
        }
    }
    // #endregion

    /**
     * 
     * @param files 
     * @returns 
     */
    private static formatContextForPlanner = (files: ArchFileContext[]): string => {
        return files.map(f => {
            return `File: ${f.context.filePath}
            Type: ${f.context.fileType}
            Exports: ${f.context.exports.join(", ")}`;
        }).join("\n---\n");
    };

}
