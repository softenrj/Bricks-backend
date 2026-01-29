import mongoose from "mongoose";

export enum snapshotEnum {
    DRAFT = "DRAFT",
    ACTIVE = "ACTIVE",
    FAILED = "FAILED"
}

export interface ISnapshot {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    projectId: mongoose.Types.ObjectId;
    parentSnapshot: mongoose.Types.ObjectId | null;
    status: snapshotEnum;
    createAt: Date;
    updatedAt: Date;
}

const snapshotSchema = new mongoose.Schema<ISnapshot>({
    userId: { type: mongoose.Schema.ObjectId, required: true, ref: "users", index: true },
    projectId: { type: mongoose.Schema.ObjectId, required: true, ref: "Project", index: true },
    parentSnapshot: { type: mongoose.Schema.ObjectId, required: false, index: true },
    status: { type: String, enum: Object.values(snapshotEnum), required: true, default: snapshotEnum.DRAFT }
}, { timestamps: true })

export const Snapshot = mongoose.model<ISnapshot>("snapshots",snapshotSchema);