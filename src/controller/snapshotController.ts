import { Request, Response } from "express";
import { sendResponse } from "../types/apiResponse.js";
import { Snapshot } from "../model/snapshot.js";
import mongoose from "mongoose";
import { snapShotFile } from "../model/snapshotfile.js";
import { FLUCFlowService } from "../service/fileUpdateCreateSync.js";
import { FSTYPE } from "../model/project_files.js";
import path from "path";

export const extendSnapLife = async (req: Request, res: Response): Promise<void> => {
    try {
        const { snapv1Id, snapv2Id } = req.body;

        if (!snapv1Id || !snapv2Id || !mongoose.isValidObjectId(snapv1Id) || !mongoose.isValidObjectId(snapv2Id)) {
            sendResponse(res, 400, { success: false, message: "Both SnapSort id is required" });
            return;
        }

        const extededTime = new Date(Date.now() + 15 * 60 * 1000);

        await Snapshot.updateMany({
            _id: {
                $in: [new mongoose.Types.ObjectId(snapv1Id), new mongoose.Types.ObjectId(snapv2Id)]
            }, expiresAt: { $gt: new Date() }
        }, { $set: { expiresAt: extededTime } });

        sendResponse(res, 200, { success: true, message: "snapshot life exteded to 15 minutes " });
    } catch (error) {
        console.error("Error while extending life of snapshot:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
        return;
    }
}

export const commitSnap = async (req: Request, res: Response): Promise<void> => {
    try {
        const { snapv1Id, snapv2Id } = req.body;

        if (!snapv1Id || !snapv2Id || !mongoose.isValidObjectId(snapv1Id) || !mongoose.isValidObjectId(snapv2Id)) {
            sendResponse(res, 400, { success: false, message: "Valid SnapSort IDs (v1 and v2) are required." });
            return;
        }

        const files = await snapShotFile.find({ snapshotId: snapv2Id });

        const processPromises = files.map(file => {
            const fileName = path.basename(file.path);
            const lastSlashIdx = file.path.lastIndexOf("/");

            let filePath = lastSlashIdx === -1 ? "." : file.path.slice(0,lastSlashIdx);

            return FLUCFlowService.process({
                path: filePath,
                name: fileName,
                projectId: file.projectId,
                content: file.content,
                userId: file.userId,
                type: FSTYPE.FILE
            });
        });

        await Promise.all(processPromises);

        const idsToDelete = [
            new mongoose.Types.ObjectId(snapv1Id),
            new mongoose.Types.ObjectId(snapv2Id)
        ];

        await Promise.all([
            snapShotFile.deleteMany({ snapshotId: { $in: idsToDelete } }),
            Snapshot.deleteMany({ _id: { $in: idsToDelete } })
        ]);

        sendResponse(res, 200, { success: true, message: "Files synced and snapshots cleaned up successfully." });

    } catch (error) {
        console.error("Error inside commitSnap:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
};

export const rollbackSnap = async (req: Request, res: Response): Promise<void> => {
    try {
        
        const { snapv1Id, snapv2Id } = req.body;

        if (!snapv1Id || !snapv2Id || !mongoose.isValidObjectId(snapv1Id) || !mongoose.isValidObjectId(snapv2Id)) {
            sendResponse(res, 400, { success: false, message: "Valid SnapSort IDs (v1 and v2) are required." });
            return;
        }

        const files = await snapShotFile.find({ snapshotId: snapv1Id });

        const idsToDelete = [
            new mongoose.Types.ObjectId(snapv1Id),
            new mongoose.Types.ObjectId(snapv2Id)
        ];

        await Promise.all([
            snapShotFile.deleteMany({ snapshotId: { $in: idsToDelete } }),
            Snapshot.deleteMany({ _id: { $in: idsToDelete } })
        ]);

        sendResponse(res, 200, { success: true, message: "Files rollback and snapshots cleaned up successfully.", data: files });
    } catch (error) {
        console.error("Error inside commitSnap:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
}