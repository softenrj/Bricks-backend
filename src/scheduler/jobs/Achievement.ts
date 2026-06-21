// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import { AchievementEnum } from "../../model/achievements.js";
import { UserStats } from "../../model/userStats.js";
import { AchievementService } from "../../service/Achievements.js";
import { CronSchedule, Job } from "../../types/jobs.js";

const achievementHandler = async () => {
  console.log("🏆 Achievements job started at", new Date().toISOString());
  const users = await UserStats.find({});

  await Promise.all(
    users.map(async (userStat) => {
      try {
        const { reputation } = userStat;
        if (reputation >= 95) {
          await AchievementService(AchievementEnum.EKH, userStat.userId);
        }
      } catch (error) {
        console.error(`Achievements update failed for user ${userStat._id}`, error);
      }
    })
  );
  console.log("🏆Achievements job completed at", new Date().toISOString());
};

export const AchievementScheduler: Job = {
  name: "Achievements",
  description: "Eternal Knight of Honor",
  enabled: true,
  schedule: CronSchedule.EVERY_DAY_MIDNIGHT,
  handler: achievementHandler,
};
