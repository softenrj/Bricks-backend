import mongoose from "mongoose";
import { Achievement, AchievementEnum } from "../model/achievements.js";
import { UserStats } from "../model/userStats.js";
import { ensureUserStats } from "./UserStatsService.js";


export async function AchievementService(
    type: AchievementEnum,
    userId: mongoose.Types.ObjectId
): Promise<void> {
    try {
        const ach = await Achievement.findOne({ name: type });
        if (!ach) return;

        const stats = await ensureUserStats(userId);

        const REPUTATION_CAP = 100;
        const REPUTATION_INCREASE = 5;
        const rep = Math.min(REPUTATION_CAP, stats.reputation + REPUTATION_INCREASE)

        await UserStats.updateOne(
            { userId },
            {
                $set: { reputation: rep },
                $addToSet: { achievements: ach._id }
            }
        );


    } catch (error) {
        console.error("AchievementService Error:", error);
    }
}