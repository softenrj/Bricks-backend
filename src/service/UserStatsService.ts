// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import mongoose from "mongoose";
import { UserStats, IUserStats } from "../model/userStats.js";
import { AchievementEnum } from "../model/achievements.js";
import { AchievementService } from "./Achievements.js";

/**
 * Ensures the UserStats document exists for a given userId, creating it if necessary.
 * @param userId The ID of the user.
 * @returns The UserStats document.
 */
export async function ensureUserStats(userId: mongoose.Types.ObjectId): Promise<IUserStats> {
  let stats = await UserStats.findOne({ userId });
  if (!stats) {
    stats = await UserStats.create({ userId });
  }
  return stats;
}

/**
 * @param userId The ID of the user.
 */
export async function streakEngine(userId: mongoose.Types.ObjectId): Promise<void> {
  try {
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const REPUTATION_CAP = 100;
    const REPUTATION_INCREASE = 1;

    await ensureUserStats(userId);

    const stats = await UserStats.findOneAndUpdate(
      { userId: userId },
      [
        {
          $set: {
            isYesterday: {
              $eq: ["$lastCountedStreak", { $add: [todayUTC, -24 * 60 * 60 * 1000] }],
            },
            isCountedToday: { $eq: ["$lastCountedStreak", todayUTC] },
          },
        },
        {
          $set: {
            streak: {
              $cond: {
                if: "$isCountedToday",
                then: "$streak",
                else: {
                  $cond: {
                    if: "$isYesterday",
                    then: { $add: ["$streak", 1] },
                    else: 1,
                  },
                },
              },
            },

            reputation: {
              $cond: {
                if: "$isCountedToday",
                then: "$reputation",
                else: {
                  $min: [{ $add: ["$reputation", REPUTATION_INCREASE] }, REPUTATION_CAP],
                },
              },
            },

            lastCountedStreak: {
              $cond: {
                if: "$isCountedToday",
                then: "$lastCountedStreak",
                else: todayUTC,
              },
            },
          },
        },
        {
          $set: {
            maxStreak: { $max: ["$maxStreak", "$streak"] },
          },
        },
      ],
      { new: true }
    );

    if (stats && stats.streak === 10) await AchievementService(AchievementEnum.RF, userId);
    if (stats && stats.streak === 50) await AchievementService(AchievementEnum.AOP, userId);
  } catch (err) {
    console.error("StreakEngine Error:", err);
  }
}

/**
 * Handles starring and unstarring stats.
 * @param type 1 for star, 0 for unstar.
 * @param userId The ID of the user.
 */
export async function starStats(type: 0 | 1, userId: mongoose.Types.ObjectId): Promise<void> {
  try {
    await ensureUserStats(userId);

    if (type === 1) {
      await UserStats.updateOne({ userId }, { $inc: { starMarked: 1 } });
    } else {
      await UserStats.updateOne({ userId, starMarked: { $gt: 0 } }, { $inc: { starMarked: -1 } });
    }
  } catch (err) {
    console.error("StarStatsEngine Error:", err);
  }
}

/**
 * Handles archiving and unarchiving stats and triggers achievement checks.
 * @param type 1 for archive, 0 for unarchive.
 * @param userId The ID of the user.
 */
export async function archivedStats(type: 0 | 1, userId: mongoose.Types.ObjectId): Promise<void> {
  try {
    await ensureUserStats(userId);

    if (type === 1) {
      const stats = await UserStats.findOneAndUpdate(
        { userId },
        { $inc: { archived: 1 } },
        { new: true }
      );

      if (stats && stats.archived === 5) await AchievementService(AchievementEnum.FFA, userId);
    } else {
      await UserStats.updateOne({ userId, archived: { $gt: 0 } }, { $inc: { archived: -1 } });
    }
  } catch (err) {
    console.error("ArchivedStatsEngine Error:", err);
  }
}

/**
 * Handles project creation and deletion stats and triggers achievement checks.
 * @param type 1 for creation, 0 for deletion.
 * @param userId The ID of the user.
 */
export async function projectStats(type: 0 | 1, userId: mongoose.Types.ObjectId): Promise<void> {
  try {
    await ensureUserStats(userId);

    if (type === 1) {
      const stats = await UserStats.findOneAndUpdate(
        { userId },
        { $inc: { projects: 1 } },
        { new: true }
      );

      if (stats && stats.projects === 5) await AchievementService(AchievementEnum.QB, userId);
      if (stats && stats.projects === 25) await AchievementService(AchievementEnum.LOF, userId);
    } else {
      await UserStats.updateOne({ userId, projects: { $gt: 0 } }, { $inc: { projects: -1 } });
    }
  } catch (err) {
    console.error("ProjectStatsEngine Error:", err);
  }
}
