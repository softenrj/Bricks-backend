// Copyright (c) 2025 Raj
// See LICENSE for details.

import mongoose from "mongoose";
import { BType } from "./comments.js";

export interface ILike {
  _id: mongoose.Types.ObjectId;
  type: BType;
  typeId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LikeSchema = new mongoose.Schema<ILike>(
  {
    type: { type: String, enum: Object.values(BType), required: true, index: true },
    typeId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  },
  { timestamps: true }
);

LikeSchema.index({
  type: 1,
  typeId: 1,
  userId: 1,
});

export const Like = mongoose.model<ILike>("likes", LikeSchema);
