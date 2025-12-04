//? ArchForge Engin

import mongoose from "mongoose";
import getVectorEmbedding from "../service/vectorTransformer.js";
import { FileVector } from "../model/file_vectors.js";
import { IProjectFile, ProjectFile } from "../model/project_files.js";
import { buildAsciiTree, buildTree, TreeNode } from "../service/treeNodeBuilder.js";
import { AI_MODULE } from "../config/groqSdkConfig.js";
import { ChatCompletionCreateParams, ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions.mjs";

/**
 * todo
 * 1. validate paths
 * 2. Modification
 * 3. Required Resource guthering
 * 4. Ai planner
 * 5. Each Recursive File folder formation
 * 6. validator
 * 7. Render to User
 * 8. End
 */

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
class ArchForge {

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

            //todo pass to Next 
            console.log(await this.archProjectPlanner(relatedFiles,codeBase,prompt))
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

    // #region ------ AI planner ------
    /**
     * 
     * @param fileContext 
     * @param codeBase 
     * @returns 
     */
    public static async archProjectPlanner(
        fileContexts: ArchFileContext[],
        projectTree: string,
        userPrompt: string
    ): Promise<ProjectPlan> {
        try {
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
                model: "llama-3.1-8b-instant", // or gpt-4o for complex architecture
                messages: messages,
                temperature: 0.3, // Low temp for structural consistency
                response_format: { type: "json_object" }
            });

            const content = completion.choices[0]?.message?.content || "{}";

            // E. Parse & Validate
            const plan: ProjectPlan = JSON.parse(content);
            // todo Planner Done There Job
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

//! Test case ( Unit Test )
ArchForge._process_({
    prompt: "Create A Amazon Clone",
    userId: new mongoose.Types.ObjectId("68cc11742daa63367d44b061"),
    projectId: new mongoose.Types.ObjectId("6926f4f4c1ae883c414eb5e5"),
    cursor_fileId: new mongoose.Types.ObjectId("6926f4f5c1ae883c414eb5f6")
})
// ! it Getting Exelerating