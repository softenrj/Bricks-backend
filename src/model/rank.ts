import mongoose, { Schema } from "mongoose";

export interface IRank {
  name: string;
  description: string;
  badge: string;
  minReputation: number;
  minStreak: number;
}

const rankSchema = new Schema<IRank>({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, required: true },
  badge: { type: String, required: true },
  minReputation: { type: Number, required: true },
  minStreak: { type: Number, required: true }
}, { timestamps: true });

export const Rank = mongoose.model<IRank>("Rank", rankSchema);
