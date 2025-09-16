import mongoose, { Document, Schema } from "mongoose";

export interface IProjectFile extends Document {
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  fileName: string;
  filePath: string;   // "src/components/Button.tsx"
  parentId?: mongoose.Types.ObjectId; // for folder hierarchy
  isFolder: boolean;
  content?: string;   // only if not a folder
  version: number;    // for rollback/snapshots
  createdAt: Date;
  updatedAt: Date;
}

const ProjectFileSchema = new Schema<IProjectFile>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true }, 
    parentId: { type: Schema.Types.ObjectId, ref: "ProjectFile", default: null },
    isFolder: { type: Boolean, default: false },
    content: { type: String }, // code text if it's a file
    version: { type: Number, default: 1 }
  },
  { timestamps: true }
);

export const ProjectFile = mongoose.model<IProjectFile>("ProjectFile", ProjectFileSchema);
