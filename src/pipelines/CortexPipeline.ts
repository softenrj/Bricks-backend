// Copyright (c) 2025 Raj
// See LICENSE for details.

import { IProjectFile } from "../model/project_files.js";
import { decodeBase64Encoding } from "./utils.js";
import { extractFileContextAST, FileContextResult } from "../service/adstractSyntexTree.js";
import FileContext from "../model/files_contexts.js";
import getVectorEmbedding from "../service/vectorTransformer.js";
import { FileVector } from "../model/file_vectors.js";
import { RealtimeStatusSocket } from "../sockets/socket.RealTime.js";
import mongoose from "mongoose";
import { uIdProvider } from "../service/user.uidProvider.js";

/**
 * @name CortexPipeline
 * @description Sigma-grade pipeline to extract file context and vectorize it for AI search
 * @param {IProjectFile} projectFile - The file object containing content and metadata
 * @returns {Promise<void>}
 */
export async function CortexPipeline(projectFile: IProjectFile, userId: mongoose.Types.ObjectId) {
  try {
    // #region ------------------------- SETUP -------------------------
    //! Extract base info
    const projectId = projectFile.projectId;
    const fileId = projectFile._id;
    const fileName = projectFile.name;
    const content = projectFile.content || "";

    const isLockFile = projectFile.name === "package-lock.json";
    if (isLockFile) return;
    // #endregion

    // #region ------------------------- FILE CONTEXT -------------------------
    //! Use AST to extract snippet, imports, exports, dependencies, lines, fileType
    const context: FileContextResult = extractFileContextAST(fileName, content);
    const { snippets, imports, exports, lines, dependencies, fileType } = context;

    /**
     * @function upsertContext
     * @description Updates or creates a file context document
     * @returns {Promise<FileContext>}
     */
    async function upsertContext() {
      return await FileContext.findOneAndUpdate(
        { projectId, fileId },
        {
          snippet: content,
          imports,
          exports,
          dependencies,
          lines,
          fileType,
          filePath: projectFile.path,
        },
        { upsert: true, new: true }
      );
    }

    const contentCollection = await upsertContext();
    if (contentCollection) {
      RealtimeStatusSocket.__push(
        {
          id: uIdProvider(),
          type: "fun",
          message: "[Info] Context is Updated for this File",
        },
        userId
      );
    }
    //! Context saved
    // #endregion

    // #region ------------------------- VECTOR -------------------------
    //! Generate vector embedding for snippet

    const embedding = snippets.map((snip) => {
      return {
        symbolName: snip.symbolName,
        fileType: fileType,
        imports: imports,
        exports: exports,
        functionType: snip.functionType,
        snippet: snip.snippet,
      };
    });
    const vectors = await Promise.all(
      embedding.map(async (snip) => ({
        symbolName: snip.symbolName,
        snippet: snip.snippet,
        vector: await getVectorEmbedding(JSON.stringify(snip)),
      }))
    );
    const contextId = contentCollection._id;

    /**
     * @function upsertVector
     * @description Updates or creates a vector document
     * @returns {Promise<FileVector>}
     */
    async function upsertVector() {
      const process = await Promise.allSettled(
        vectors.map(async (v) =>
          FileVector.findOneAndUpdate(
            {
              contextId,
              fileId,
              projectId,
              symbolName: v.symbolName,
            },
            {
              vector: v.vector,
              snippet: v.snippet,
            },
            { upsert: true, new: true }
          )
        )
      );
      return process;
    }

    const vectorCollection = await upsertVector();

    if (vectorCollection) {
      RealtimeStatusSocket.__push(
        {
          id: uIdProvider(),
          type: "fun",
          message: "[Info] Vector is Updated for that File..",
        },
        userId
      );
    }
    //! Vector saved
    // #endregion
  } catch (error) {
    //? Handle any unexpected errors in the pipeline
    console.error("🔥 [CORTEX PIPELINE ERROR]", error);
  }
}
