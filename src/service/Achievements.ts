// Copyright (c) 2025 Raj
// See LICENSE for details.

import mongoose from "mongoose";
import { Achievement, AchievementEnum } from "../model/achievements.js";
import { UserStats } from "../model/userStats.js";
import { ensureUserStats } from "./UserStatsService.js";
import { pushUserHistory } from "./BricksHistoryService.js";
import { BrickHistoryTypeEnum } from "../model/BricksHistory.js";

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
    const newReputation = Math.min(REPUTATION_CAP, stats.reputation + REPUTATION_INCREASE);

    const isNewAchievement = !stats.achievements.includes(ach._id);
    const reputationChange = newReputation - stats.reputation;

    await UserStats.updateOne(
      { userId },
      {
        $set: { reputation: newReputation },
        $addToSet: { achievements: ach._id },
      }
    );

    if (isNewAchievement) {
      const descriptionMessage = `
                🏆 Achievement Unlocked: ${ach.name || ach.name}
                Description: ${ach.description}.
                Reputation increased by ${reputationChange}. New reputation: ${newReputation}.
            `
        .trim()
        .replace(/\s+/g, " ");

      await pushUserHistory(
        {
          userId,
          description: descriptionMessage,
        },
        BrickHistoryTypeEnum.Achievement
      );
    }
  } catch (error) {
    console.error("AchievementService Error:", error);
  }
}
