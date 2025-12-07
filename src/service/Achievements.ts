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

        await ensureUserStats(userId);
        
        const result = await UserStats.updateOne(
            { userId },
            { $addToSet: { achievements: ach._id } }
        );

        if (result.modifiedCount > 0) {
            await UserStats.updateOne(
                { userId },
                {
                    $inc: { reputation: 5 },
                    $min: { reputation: 100 }
                }
            );
        }

    } catch (error) {
        console.error("AchievementService Error:", error);
    }
}
