import mongoose, { Document, Schema } from "mongoose";

export interface IFILECONTEXT extends Document {
    projectId: mongoose.Types.ObjectId;
    fileId: mongoose.Types.ObjectId;
    filePath: string;
    snippet?: { symbolName: string; snippet: string }[];
    imports?: string[];
    exports?: string[];
    dependencies?: string[];
    lines?: number;
    fileType?: string;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const FILECONTEXT_SCHEMA = new mongoose.Schema<IFILECONTEXT>({
    projectId: { type: Schema.ObjectId, ref: "Project", required: true, index: true },
    fileId: { type: Schema.ObjectId, ref: "ProjectFile", required: true, index: true },
    filePath: { type: String, default: '.'},
    snippet: [{ symbolName: { type: String, required: true }, snippet: { type: String, required: true} }],
    imports: { type: [String], default: [] },
    exports: { type: [String], default: [] },
    dependencies: { type: [String], default: [] },
    isDefault: { type: Boolean, default: false },
    lines: { type: Number },
    fileType: { type: String },
}, { timestamps: true })

export default mongoose.model<IFILECONTEXT>("FileContext", FILECONTEXT_SCHEMA);