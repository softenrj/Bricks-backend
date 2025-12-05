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
            this.pushToUser("🔍 Analyzing your request and scanning related project files...", projectId,userId,processId,"render");
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
            this.pushToUser("-", projectId,userId,processId,"complete");
            //todo pass to Next 
            const plannerScript = await this.archProjectPlanner(relatedFiles, codeBase, prompt,projectId,userId);
            //todo Recursive File Generation
            this.ArchCodeGenerator(plannerScript, projectId,userId)
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
    private static async ArchCodeGenerator(planedScript: ProjectPlan, projectId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId): Promise<void> {
        try {
            //? Whole PlannedCodeBase Keys
            const otherFilesContext = Object.entries(planedScript)
                .map(([path, info]) => `- ${path}: ${info.description}`)
                .join('\n');
            //! For each Files
            for (const [filePath, info] of Object.entries(planedScript)) {
                const tempProcessId = processIdProvider()
                const action = info.action;
                this.pushToUser(`🛠️ ${action === 'create' ? 'Creating' : 'Modifying'}: ${filePath} • ${info.description}`, projectId,userId,tempProcessId,"render");
                let fileCode = null;
                if (action === 'modify') {
                    fileCode = await this.fileCodeProvider(filePath, projectId);
                }
                if (action === 'retain') continue;

                    const systemPrompt = `You are a Senior Full Stack Architect and Lead Developer. 
                    Your goal is to write production-ready, bug-free code for a specific file in a React/TypeScript project.

                    ### TECHNOLOGY STACK:
                    - Framework: React (Vite)
                    - Language: TypeScript
                    - Styling: Tailwind CSS (Utility-first)
                    - Icons: Lucide-React
                    - UI Library: If path includes 'components/ui', use ShadCN/Radix primitives pattern.

                    ### STRICT OUTPUT RULES:
                    1. Return ONLY a valid JSON object. No markdown, no text before/after.
                    2. The JSON key "content" must contain the **FULL, COMPLETE CODE**.
                    3. **NEVER** use comments like "// ... rest of code" or "// implementation here". Write every single line.
                    4. Ensure all imports match the "Project Structure" provided.
                    5. If creating a new component, ensure it is exported as default.
                    6. JSON Structure:
                    {
                      "fileName": "Exact filename",
                      "path": "Exact path provided",
                      "content": "The raw code string, properly escaped",
                      ...{if  dependency needed "dependency": "npm i ..."}
                    }`;

                const userMessage = `
                ### TASK DETAILS
                **Action:** ${action}
                **Target File:** ${filePath}
                **Purpose:** ${info.description}

                ### PROJECT CONTEXT (Use for Imports & Logic)
                The following files exist or are being created in this plan. Ensure your code integrates with them:
                ${otherFilesContext}

                ### INSTRUCTIONS
                1. If "Action" is "create", write the full file from scratch using the Tech Stack.
                2. If "Action" is "modify", merge the "Existing Code" with the "Purpose".
                3. Use Tailwind classes for ALL styling. Make it look modern and professional (Amazon Clone style).
                4. Handle edge cases (loading states, missing props).

                ${fileCode ? `### EXISTING CODE (MODIFY THIS)\n${fileCode}` : "### EXISTING CODE\nNone (Create from scratch)"}
                `;

                const messages: ChatCompletionMessageParam[] = [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ];

                const completion = await AI_MODULE.chat.completions.create({
                    model: "Llama-3.3-70B-Versatile",
                    messages: messages,
                    temperature: 0.3, // Low temp for structural consistency 
                    response_format: { type: "json_object" }
                });

                const content = completion.choices[0]?.message?.content || "{}";

                const generatedCode: ArchProjectCode = JSON.parse(content);
                this.pushToUser("", projectId,userId,tempProcessId,"render");
                ArchEnginStatusSocket._code({
                    ...generatedCode,
                    projectId: projectId
                },userId)
            }
        } catch (error) {
            console.error("Error in ArchCodeGenerator ArchEngin:", error);
            return;
        }
    }

    /**
     * 
     * @param filePath 
     * @param projectId 
     * @returns 
     */
    private static async fileCodeProvider(filePath: string, projectId: mongoose.Types.ObjectId): Promise<string> {
        try {
            const file = await ProjectFile.findOne({ projectId, path: filePath });
            if (file && file.content) return file.content;
            return ""
        } catch (error) {
            console.error("Error in fileCodeProvider ArchEngin:", error);
            return "";
        }
    }
    // #endregion

    private static pushToUser(message: string, projectId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId,processId: string, state: "render" | "complete"): void {
        try {
            ArchEnginStatusSocket.__push({
                id: uIdProvider(),
                processId: processId,
                process: state,
                message: message
            },userId)
        } catch (error) {
            console.error("Error in ArchPush TO User ArchEngin:", error);
            return ;
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
            this.pushToUser("🧠 Analyzing project and planning required changes...", projectId,userId,processId,"render");
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
            this.pushToUser("", projectId,userId,processId,"complete");
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

// //! Test case ( Unit Test )
// ArchForge._process_({
//     prompt: "Create A Amazon Clone",
//     userId: new mongoose.Types.ObjectId("68cc11742daa63367d44b061"),
//     projectId: new mongoose.Types.ObjectId("6926f4f4c1ae883c414eb5e5"),
//     cursor_fileId: new mongoose.Types.ObjectId("6926f4f5c1ae883c414eb5f6")
// })
// // ! it Getting Exelerating
// #endregion