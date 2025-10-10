import mongoose, { Document, Schema } from "mongoose";

export enum FSTYPE {
  FOLDER = "folder",
  FILE = "file",
  IMAGE = "image"
}

export interface IProjectFile extends Document {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  path: string;
  type: FSTYPE;
  content?: string;
  version: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}


export interface ProjectContextNode {
  _id: any;
  projectId: any;
  userId: mongoose.Types.ObjectId;
  name: string;
  path: string;
  type: string;
  content?: string;
  version: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  child?: ProjectContextNode[];
  parent?: mongoose.Types.ObjectId;
}

const ProjectFileSchema = new Schema<IProjectFile>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    path: { type: String },
    type: {
      type: String,
      enum: Object.values(FSTYPE),
      required: true
    },
    content: { type: String },
    version: { type: Number, default: 1 },
    isDefault: { type: Boolean, default: false }
  },
  { timestamps: true }
);


export const ProjectFile = mongoose.model<IProjectFile>("ProjectFile", ProjectFileSchema);
