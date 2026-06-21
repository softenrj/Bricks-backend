// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import mongoose from "mongoose";
import axios from "axios";
import { ProjectFile } from "../model/project_files.js";

export interface DependencyInfo {
  name: string;
  version: string;
  description: string;
  npmUrl: string;
  homepage: string;
}

export const getDependencyList = async (
  projectId: string,
  userId: mongoose.Types.ObjectId
): Promise<DependencyInfo[]> => {
  // 1. Fetch package.json from DB
  const file = await ProjectFile.findOne({ projectId, userId, name: "package.json" });
  if (!file || !file.content) throw new Error("package.json not found.");

  const packageData = JSON.parse(file.content.toString());
  const allDeps = { ...(packageData.dependencies || {}), ...(packageData.devDependencies || {}) };

  const depNames = Object.keys(allDeps);

  // 2. Fetch metadata for each dependency from NPM Registry
  const detailedDeps = await Promise.all(
    depNames.map(async (name) => {
      try {
        // We encode the name to handle scoped packages like @types/node
        const { data } = await axios.get(
          `https://registry.npmjs.org/${encodeURIComponent(name)}/latest`
        );

        return {
          name,
          version: allDeps[name],
          description: data.description || "No description available",
          npmUrl: `https://www.npmjs.com/package/${name}`,
          homepage: data.homepage || "",
        };
      } catch (err) {
        // Fallback if NPM fetch fails for a specific package
        return {
          name,
          version: allDeps[name],
          description: "Metadata unavailable",
          npmUrl: `https://www.npmjs.com/package/${name}`,
          homepage: "",
        };
      }
    })
  );

  return detailedDeps;
};
