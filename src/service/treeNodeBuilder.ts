// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import { IProjectFile, ProjectContextNode } from "../model/project_files.js";

export type TreeNode = { [key: string]: string | TreeNode };

export function buildTree(files: IProjectFile[]): TreeNode {
  const root: TreeNode = {};

  for (const file of files) {
    const parts = file.path === "." ? [] : file.path.split("/");
    let current = root;

    for (const part of parts) {
      if (!current[part]) current[part] = {};
      current = current[part] as TreeNode;
    }

    if (file.type === "folder") {
      if (!current[file.name]) current[file.name] = {};
    } else {
      current[file.name] = file.content || "";
    }
  }

  return root;
}
export function buildAsciiTree(files: IProjectFile[]): string {
  const root: any = {};

  for (const file of files) {
    const fullPath = file.path === "." ? file.name : file.path + "/" + file.name;

    const parts = fullPath.split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      if (!current[part]) current[part] = isFile ? null : {};
      if (!isFile) current = current[part];
    }
  }
  return ".\n" + renderAscii(root, "");
}

function renderAscii(node: any, prefix: string): string {
  const entries = Object.keys(node);
  let output = "";

  entries.forEach((key, index) => {
    const isLast = index === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";

    if (node[key] === null) {
      // file
      output += `${prefix}${connector}${key}\n`;
    } else {
      // folder
      output += `${prefix}${connector}${key}/\n`;

      const newPrefix = prefix + (isLast ? "    " : "│   ");
      output += renderAscii(node[key], newPrefix);
    }
  });

  return output;
}

export function buildContextTree(files: IProjectFile[]): ProjectContextNode[] {
  const nodeMap: Record<string, ProjectContextNode> = {};
  const roots: ProjectContextNode[] = [];

  for (const file of files) {
    const node: ProjectContextNode = {
      ...file,
      child: [],
      parent: undefined,
    };

    nodeMap[file.path + "/" + file.name] = node;

    if (file.path && file.path !== ".") {
      const parentPath = file.path;
      const parentNode = nodeMap[parentPath];
      if (parentNode) {
        node.parent = parentNode._id;
        parentNode.child = parentNode.child || [];
        parentNode.child.push(node);
      } else {
        // parent node not created yet, create placeholder folder
        const placeholder: ProjectContextNode = {
          _id: `placeholder-${parentPath}`,
          projectId: file.projectId,
          userId: file.userId,
          name: parentPath.split("/").pop() || "",
          path: parentPath,
          type: "folder",
          version: 0,
          isDefault: false,
          child: [node],
          parent: undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        node.parent = placeholder._id;
        nodeMap[parentPath] = placeholder;
        roots.push(placeholder);
      }
    } else {
      // root level node
      roots.push(node);
    }
  }

  return roots;
}
