import mongoose, { Document, Schema } from "mongoose";

export interface IUserStats {
    userId: mongoose.Types.ObjectId;
    projects: number;
    archived: number;
    starMarked: number;
    reputation: number;
    streak: number;
    maxStreak: number;
    lastCountedStreak: Date;
    achievements: mongoose.Types.ObjectId[];
    rank: mongoose.Types.ObjectId;
}

const userStatsSchema = new Schema<IUserStats>({
    userId: { type: Schema.ObjectId, ref: "users", required: true, index: true },
    projects: { type: Number, default: 0 },
    archived: { type: Number, default: 0 },
    starMarked: { type: Number, default: 0 },
    reputation: { type: Number, default: 0, max: 100 },
    lastCountedStreak: { type: Date, default: () => new Date() },
    maxStreak: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    achievements: [{ type: Schema.Types.ObjectId, ref: "Achievement" }],
    rank: { type: Schema.Types.ObjectId, ref: "Rank" }
}, { timestamps: true });

export const UserStats = mongoose.model<IUserStats>("UserStats", userStatsSchema);
