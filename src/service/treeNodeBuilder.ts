import { IProjectFile } from "../model/project_files.js";

export type TreeNode = { [key: string]: string | TreeNode }

export function buildTree(files: IProjectFile[]): TreeNode {
    const root: TreeNode = {};

    for (const file of files) {
        const parts = file.path === '.' ? [] : file.path.split('/');
        let current = root;

        for (const part of parts) {
            if (!current[part]) current[part] = {};
            current = current[part] as TreeNode;
        }

        if (file.type === 'folder') {
            if (!current[file.name]) current[file.name] = {};
        } else {
            current[file.name] = file.content || "";
        }
    }

    return root;
}