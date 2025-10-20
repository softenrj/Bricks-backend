import mongoose, { Document, Schema } from "mongoose";
export interface IFileVector extends Document {
    projectId: mongoose.Types.ObjectId;
    contextId: mongoose.Types.ObjectId;
    fileId: mongoose.Types.ObjectId;
    vector: number[];
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const FileVectorSchema = new mongoose.Schema<IFileVector>({
    projectId: { type: Schema.ObjectId, ref: "Project", required: true, index: true },
    contextId: { type: Schema.ObjectId, ref: "FileContext", required: true, index: true },
    fileId: { type: Schema.Types.ObjectId, ref: "ProjectFile", required: true, index: true },
    vector: { type: [Number], required: true },
    isDefault: { type: Boolean, default: false }
}, { timestamps: true });

export const FileVector = mongoose.model<IFileVector>("FileVector", FileVectorSchema);
