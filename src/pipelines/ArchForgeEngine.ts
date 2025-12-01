//? ArchForge Engin

import mongoose from "mongoose";
import getVectorEmbedding from "../service/vectorTransformer.js";
import { FileVector } from "../model/file_vectors.js";
import { IProjectFile, ProjectFile } from "../model/project_files.js";
import { buildAsciiTree, buildTree, TreeNode } from "../service/treeNodeBuilder.js";

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
                        fileId: 1
                    }
                }
            },
            ])

            // console.log(relatedFiles)
            this.projectTree(projectId,userId)
        } catch (error) {
            console.error("Error in lexicalArchEngin:", error);
            return null;
        }
    }

    /**
     * 
     * @param projectId 
     * @param userId 
     * @returns 
     */
    private static async projectTree(projectId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId): Promise<any> {
        try {
            const projectFile = (await ProjectFile.find({ projectId, userId },{ content: 0 }).lean()) as unknown as IProjectFile[];

            const treeNode = buildAsciiTree(projectFile);
            console.log(treeNode);
        } catch (error) {
            console.error("Error in ProjectTree ArchEngin:", error);
            return null;
        }
    }

}
ArchForge._process_({
    prompt: "A clean Task manager App",
    userId: new mongoose.Types.ObjectId("68cc11742daa63367d44b061"),
    projectId: new mongoose.Types.ObjectId("6926f4f4c1ae883c414eb5e5"),
    cursor_fileId: new mongoose.Types.ObjectId("6926f4f5c1ae883c414eb5f6")
})

// ! Related files Example
//   {
//     _id: new ObjectId('6926f6562a0d188402110add'),
//     context: {
//       fileId: new ObjectId('6926f4f5c1ae883c414eb5ed'),
//       exports: [],
//       imports: [],
//       isDefault: false,
//       snippet: '{\n' +
//         '  "name": "Bricks-stater-template-ts",\n' +
//         '  "private": true,\n' +
//         '  "version": "0.0.0",\n' +
//         '  "type": "module",\n' +
//         '  "scripts": {\n' +
//         '    "dev": "vite",\n' +
//         '    "build": "tsc -b && vite build",\n' +
//         '    "lint": "eslint .",\n' +
//         '    "preview": "vite preview"\n' +
//         '  },\n' +
//         '  "dependencies": {\n' +
//         '    "@dnd-kit/core": "^6.3.1",\n' +
//         '    "@dnd-kit/modifiers": "^9.0.0",\n' +
//         '    "@dnd-kit/sortable": "^10.0.0",\n' +
//         '    "@radix-ui/react-avatar": "^1.1.11",\n' +
//         '    "@tailwindcss/vite": "^4.1.14",\n' +
//         '    "class-variance-authority": "^0.7.1",\n' +
//         '    "clsx": "^2.1.1",\n' +
//         '    "framer-motion": "^12.23.24",\n' +
//         '    "lucide-react": "^0.555.0",\n' +
//         '    "nanoid": "^5.1.6",\n' +
//         '    "react": "^19.1.1",\n' +
//         '    "react-dom": "^19.1.1",\n' +
//         '    "tailwind-merge": "^3.4.0",\n' +
//         '    "tailwindcss": "^4.1.14"\n' +
//         '  },\n' +
//         '  "devDependencies": {\n' +
//         '    "@eslint/js": "^9.36.0",\n' +
//         '    "@types/react": "^19.1.13",\n' +
//         '    "@types/react-dom": "^19.1.9",\n' +
//         '    "@vitejs/plugin-react": "^5.0.3",\n' +
//         '    "eslint": "^9.36.0",\n' +
//         '    "eslint-plugin-react-hooks": "^5.2.0",\n' +
//         '    "eslint-plugin-react-refresh": "^0.4.20",\n' +
//         '    "globals": "^16.4.0",\n' +
//         '    "tw-animate-css": "^1.4.0",\n' +
//         '    "typescript": "~5.8.3",\n' +
//         '    "typescript-eslint": "^8.44.0",\n' +
//         '    "vite": "^7.1.7"\n' +
//         '  }\n' +
//         '}\n'
//     },
//     score: 0.5700703859329224
//   }

// ! Tree
// .
// ├── tsconfig.node.json
// ├── vite.config.ts
// ├── tsconfig.json
// ├── tsconfig.app.json
// ├── README.md
// ├── package.json
// ├── index.html
// ├── eslint.config.js
// ├── .gitignore
// ├── src/
// │   ├── main.tsx
// │   ├── index.css
// │   ├── assets/
// │   │   └── react.svg
// │   ├── App.tsx
// │   ├── components/
// │   │   ├── ui/
// │   │   │   ├── alert.tsx
// │   │   │   ├── avatar.tsx
// │   │   │   └── select.tsx
// │   │   ├── SortableTask.tsx
// │   │   └── TaskCard.tsx
// │   └── lib/
// │       └── utils.ts
// ├── public/
// │   └── vite.svg
// ├── package-lock.json
// └── components.json

