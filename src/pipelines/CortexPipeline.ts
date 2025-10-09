import { IProjectFile } from "../model/project_files.js";
import { decodeBase64Encoding } from "./utils.js";
import { extractFileContextAST, FileContextResult } from "../service/adstractSyntexTree.js";
import FileContext from "../model/files_contexts.js";
import getVectorEmbedding from "../service/vectorTransformer.js";
import { FileVector } from "../model/file_vectors.js";

/**
 * @name CortexPipeline
 * @description Sigma-grade pipeline to extract file context and vectorize it for AI search
 * @param {IProjectFile} projectFile - The file object containing content and metadata
 * @returns {Promise<void>}
 */
export async function CortexPipeline(projectFile: IProjectFile) {
  try {

    // #region ------------------------- SETUP -------------------------
    //! Extract base info
    const projectId = projectFile.projectId;
    const fileId = projectFile._id;
    const fileName = projectFile.name;
    const decodedContent = projectFile.content ? decodeBase64Encoding(projectFile.content) : '';
    // #endregion

    // #region ------------------------- FILE CONTEXT -------------------------
    //! Use AST to extract snippet, imports, exports, dependencies, lines, fileType
    const context: FileContextResult = extractFileContextAST(fileName, decodedContent);
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

    const vectorCollection = await upsertVector();
    //! Vector saved
    // #endregion

  } catch (error) {
    //? Handle any unexpected errors in the pipeline
    console.error("🔥 [CORTEX PIPELINE ERROR]", error);
  }
}
