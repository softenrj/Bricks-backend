// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import mongoose, { Document, Schema } from "mongoose";

export interface IRank {
  name: string;
  rank: string;
  description: string;
  badge: string;
  minReputation: number;
  minStreak: number;
}

const rankSchema = new Schema<IRank>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    rank: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true },
    badge: { type: String, required: true },
    minReputation: { type: Number, required: true },
    minStreak: { type: Number, required: true },
  },
  { timestamps: true }
);

export const Rank = mongoose.model<IRank>("Rank", rankSchema);
