// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import mongoose, { Document, Schema } from "mongoose";

export interface IBricksChat extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  name: string;
  createdAt: string;
  updatedAt: string;
}

const BricksChats = new mongoose.Schema<IBricksChat>(
  {
    userId: { type: Schema.ObjectId, required: true, ref: "users", index: true },
    projectId: { type: Schema.ObjectId, required: true, ref: "Project", index: true },
    name: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IBricksChat>("bricks-chats", BricksChats);
