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
    // #endregion

    // #region ------------------------- FILE CONTEXT -------------------------
    //! Use AST to extract snippet, imports, exports, dependencies, lines, fileType
    const context: FileContextResult = extractFileContextAST(fileName, content);
    const { snippet, imports, exports, lines, dependencies, fileType } = context;

    /**
     * @function upsertContext
     * @description Updates or creates a file context document
     * @returns {Promise<FileContext>}
     */
    async function upsertContext() {
      return await FileContext.findOneAndUpdate(
        { projectId, fileId },
        { snippet, imports, exports, dependencies, lines, fileType },
        { upsert: true, new: true }
      );
    }

    const contentCollection = await upsertContext();
    if (contentCollection) {
      RealtimeStatusSocket.__push({
        id: uIdProvider(),
        type: 'fun',
        message: "[Info] Context is Updated for this File"
      }, userId)
    }
    //! Context saved
    // #endregion

    // #region ------------------------- VECTOR -------------------------
    //! Generate vector embedding for snippet
    const vector = snippet ? await getVectorEmbedding(snippet) : [];
    const contextId = contentCollection._id;

    /**
     * @function upsertVector
     * @description Updates or creates a vector document
     * @returns {Promise<FileVector>}
     */
    async function upsertVector() {
      return await FileVector.findOneAndUpdate(
        { contextId, fileId, projectId },
        { vector },
        { upsert: true, new: true }
      );
    }

    const isLockFile = projectFile.name === "package-lock.json";
    if (isLockFile) return;
    const vectorCollection = await upsertVector();

    if (vectorCollection) {
      RealtimeStatusSocket.__push({
        id: uIdProvider(),
        type: 'fun',
        message: "[Info] Vector is Updated for that File.."
      }, userId)
    }
    //! Vector saved
    // #endregion

  } catch (error) {
    //? Handle any unexpected errors in the pipeline
    console.error("🔥 [CORTEX PIPELINE ERROR]", error);
  }
}
