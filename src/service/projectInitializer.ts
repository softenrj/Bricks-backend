// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import { FileVector } from "../model/file_vectors.js";
import files_contexts from "../model/files_contexts.js";
import { TechLanguage } from "../model/project.js";
import { ProjectFile } from "../model/project_files.js";
import mongoose from "mongoose";
import logger from "primelogger";

export async function ProjectInitializer(
  projectId: string,
  userId: mongoose.Types.ObjectId,
  language: TechLanguage
) {
  logger.default.color("magentaBright").bold(`Project initializer Start for userId: ${userId}`);

  const defaultFiles = await ProjectFile.find({ isDefault: true });

  const userFiles = await Promise.all(
    defaultFiles.map(async (file) => {
      const { _id, isDefault, ...rest } = file.toObject();
      const newFileId = new mongoose.Types.ObjectId();

      const userFile = {
        ...rest,
        _id: newFileId,
        projectId,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const context = await files_contexts.findOne({ isDefault: true, fileId: file._id });
      if (context) {
        const vector = await FileVector.findOne({ isDefault: true, contextId: context._id });
        const newContextId = new mongoose.Types.ObjectId();
        const newVectorId = new mongoose.Types.ObjectId();

        const { _id: ctxId, isDefault: ctxDefault, ...ctxRest } = context.toObject();
        const userContext = {
          ...ctxRest,
          _id: newContextId,
          fileId: newFileId,
          projectId,
        };

        await files_contexts.create(userContext);

        if (vector) {
          const { _id: vecId, isDefault: vecDefault, ...vecRest } = vector.toObject();
          const userVector = {
            ...vecRest,
            _id: newVectorId,
            fileId: newFileId,
            projectId,
          };

          await FileVector.create(userVector);
        }
      }

      return userFile;
    })
  );

  if (userFiles.length > 0) {
    await ProjectFile.bulkWrite(userFiles.map((f) => ({ insertOne: { document: f } })));
  }

  logger.default
    .color("magentaBright")
    .bold(`Project initializer exit with Success for userId: ${userId}`);
}
