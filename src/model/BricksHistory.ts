// Copyright (c) 2025 Raj
// See LICENSE for details.

import mongoose, { Document, Schema } from "mongoose";

export interface IBricksHistry {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  type: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum BrickHistoryTypeEnum {
  ArchForge = "ArchForge",
  FileSystem = "FileSystem",
  CodeCompletion = "CodeCompletion",
  BrickChat = "BrickChat",
  unknown = "unknown",
  user = "user",
  project = "project",
  Achievement = "Achievement",
  Rank = "RankChange",
}

//? i not include index as { nope nevermind !}
const bricksHistorySchema = new mongoose.Schema<IBricksHistry>(
  {
    userId: { type: Schema.ObjectId, required: true },
    projectId: { type: Schema.ObjectId, required: false },
    type: { type: String, enum: BrickHistoryTypeEnum, default: "unknown" },
    description: { type: String, required: true },
  },
  { timestamps: true }
);

export const BricksHistory = mongoose.model<IBricksHistry>("bricksHistory", bricksHistorySchema);
