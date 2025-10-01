import { TechLanguage } from "@/model/project.js";
import { ProjectFile } from "@/model/project_files.js";
import mongoose from "mongoose";
import logger from "primelogger";

export async function ProjectInitializer(projectId: string, userId: mongoose.Types.ObjectId, language: TechLanguage) {
    // Fetch the default project tree
    logger.default.color('magentaBright').bold(`Project initializer Start for userId: ${userId}`)
    const defaultFiles = await ProjectFile.find({ isDefault: true });

    const userFiles = defaultFiles.map(file => {
        const { _id, isDefault, ...rest } = file.toObject();
        const userFile = {
            ...rest,
            projectId,
            userId,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        return userFile
    });

    if (userFiles.length > 0) {
        await ProjectFile.bulkWrite(
            userFiles.map(f => ({ insertOne: { document: f } }))
        );
    }

    logger.default.color('magentaBright').bold(`Project initializer exit with Success for userId: ${userId}`)
}
