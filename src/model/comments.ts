// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import mongoose from "mongoose";

export enum BType {
  EVENT = "event",
  PROJECT = "project",
}

export interface IComment {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  content: string;
  parentId?: mongoose.Types.ObjectId | null;
  type: BType;
  typeId: mongoose.Types.ObjectId;
  profile: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new mongoose.Schema<IComment>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null, index: true },
    type: { type: String, enum: Object.values(BType), required: true, index: true },
    profile: { type: String, required: false },
    typeId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

CommentSchema.index({
  type: 1,
  typeId: 1,
  parentId: 1,
  createdAt: -1,
});

export default mongoose.models.Comment || mongoose.model<IComment>("comments", CommentSchema);
