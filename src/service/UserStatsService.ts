import mongoose from "mongoose";
import { UserStats, IUserStats } from "../model/userStats.js";

export async function ensureUserStats(
  userId: mongoose.Types.ObjectId
): Promise<IUserStats> {
  let stats = await UserStats.findOne({ userId });
  if (!stats) {
    stats = await UserStats.create({ userId });
  }
  return stats;
}

export async function streakEngine(
  userId: mongoose.Types.ObjectId
): Promise<void> {
  try {
    const stats = await ensureUserStats(userId);

    const today = new Date();
    const todayDate = today.toDateString();

    const last = stats.lastCountedStreak || new Date(0);
    const lastDate = last.toDateString();

    // already counted today
    if (todayDate === lastDate) return;

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayDate = yesterday.toDateString();

    if (lastDate === yesterdayDate) {
      stats.streak += 1;
      stats.reputation = Math.min(100, stats.reputation + 1);
    } else {
      stats.streak = 1;
    }

    stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
    stats.lastCountedStreak = today;

    await stats.save();
  } catch (err) {
    console.error("StreakEngine Error:", err);
  }
}

export async function starStats(
  type: 0 | 1,
  userId: mongoose.Types.ObjectId
): Promise<void> {
  try {
    await ensureUserStats(userId);

    if (type === 1) {
      await UserStats.updateOne(
        { userId },
        { $inc: { starMarked: 1 } }
      );
    } else {
      await UserStats.updateOne(
        { userId, starMarked: { $gt: 0 } },
        { $inc: { starMarked: -1 } }
      );
    }

  } catch (err) {
    console.error("StarStatsEngine Error:", err);
  }
}

export async function archivedStats(
  type: 0 | 1,
  userId: mongoose.Types.ObjectId
): Promise<void> {
  try {
    await ensureUserStats(userId);

    if (type === 1) {
      await UserStats.updateOne(
        { userId },
        { $inc: { archived: 1 } }
      );
    } else {
      await UserStats.updateOne(
        { userId, archived: { $gt: 0 } },
        { $inc: { archived: -1 } }
      );
    }

  } catch (err) {
    console.error("ArchivedStatsEngine Error:", err);
  }
}

export async function projectStats(
  type: 0 | 1,
  userId: mongoose.Types.ObjectId
): Promise<void> {
  try {
    await ensureUserStats(userId);

    if (type === 1) {
      await UserStats.updateOne(
        { userId },
        { $inc: { projects: 1 } }
      );
    } else {
      await UserStats.updateOne(
        { userId, projects: { $gt: 0 } },
        { $inc: { projects: -1 } }
      );
    }

  } catch (err) {
    console.error("ProjectStatsEngine Error:", err);
  }
}
