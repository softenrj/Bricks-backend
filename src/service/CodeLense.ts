// Copyright (c) 2025 Raj
// See LICENSE for details.

import { LanguageEnum } from "../features/LanguageEnum.js";
import { TreeNode } from "./treeNodeBuilder.js";

const ignored = ["node_modules", "dist", "build", ".gitignore", "package-lock.json"];

export function detectLanguage(path: string): (typeof LanguageEnum)[keyof typeof LanguageEnum] {
  const ext = path.split(".").pop() || "";
  return (LanguageEnum as any)[ext] || LanguageEnum.md;
}

const CodeLanseFileAnalyzer = (tree: TreeNode, stats: Record<string, number> = {}) => {
  for (const [name, value] of Object.entries(tree)) {
    if (ignored.some((item) => name.includes(item))) continue;

    // ? Folder
    if (typeof value === "object") {
      CodeLanseFileAnalyzer(value, stats);
      continue;
    }

    //? File
    const ext = name.slice(name.lastIndexOf("."));
    const lang = detectLanguage(name);
    if (!lang) continue;

    const bytes = value.length;
    stats[lang] = (stats[lang] || 0) + bytes;
  }
  return stats;
};

export type CodeLense = { lan: string; per: number }[];

export const getProjectCodeLenseService = (data: TreeNode): CodeLense => {
  const rawStats = CodeLanseFileAnalyzer(data);

  const total = Object.values(rawStats).reduce((a, b) => a + b, 0);

  if (total === 0) return [];

  return Object.entries(rawStats).map(([lang, bytes]) => ({
    lan: lang,
    per: +((bytes / total) * 100).toFixed(2),
  }));
};
