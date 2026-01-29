import mongoose from "mongoose";
import { FileAction } from "../pipelines/ArchForgeEngine.js";

export interface ISnapshotFile {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    snapshotId: mongoose.Types.ObjectId;
    path: string;
    content: string;
    action: FileAction;
    createAt: Date;
    updatedAt: Date;
}

const snapshotSchema = new mongoose.Schema<ISnapshotFile>({
    userId: { type: mongoose.Schema.ObjectId, required: true, ref: "users", index: true },
    projectId: { type: mongoose.Schema.ObjectId, required: true, ref: "Project", index: true },
    snapshotId: { type: mongoose.Schema.ObjectId, required: true, ref: "snapshots", index: true },
    action: { type: String, required: true, default: "modify" },
    path: { type: String, required: true },
    content: { type: String, required: true, default: "" }
}, { timestamps: true })

export const snapShotFile = mongoose.model<ISnapshotFile>("snapshotfiles",snapshotSchema);