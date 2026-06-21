// Copyright (c) 2025 Raj
// See LICENSE for details.

import { BrickHistoryTypeEnum } from "../../model/BricksHistory.js";
import { Rank } from "../../model/rank.js";
import { UserStats } from "../../model/userStats.js";
import { pushUserHistory } from "../../service/BricksHistoryService.js";
import { CronSchedule, Job } from "../../types/jobs.js";

const rankHandler = async () => {
  console.log("🏆 Ranker job started at", new Date().toISOString());
  const users = await UserStats.find({}).populate("rank");

  await Promise.all(
    users.map(async (userStat: any) => {
      try {
        const { reputation, maxStreak } = userStat;
        const newRank = await Rank.findOne({
          minStreak: { $lte: maxStreak },
          minReputation: { $lte: reputation },
        }).sort({
          minReputation: -1,
          minStreak: -1,
        });

        const currentRankId = userStat.rank ? String(userStat.rank._id) : null;
        const newRankId = newRank ? String(newRank._id) : null;

        if (newRank && newRankId !== currentRankId) {
          userStat.rank = newRank._id;
          await userStat.save();
          const oldRankName = userStat.rank?.name || "Unranked";
          const newRankName = newRank.name;

          const action =
            !userStat.rank || newRankId! > currentRankId! ? "Promoted to" : "Demoted to";

          const description = `
                        🏅 Rank Change: ${action} **${newRankName}**! 
                        (Old Rank: ${oldRankName}). 
                        Current stats: Reputation: ${reputation}, Max Streak: ${maxStreak}.
                    `
            .trim()
            .replace(/\s+/g, " ");

          await pushUserHistory(
            {
              userId: userStat.userId,
              description: description,
            },
            BrickHistoryTypeEnum.Rank
          );
        }
      } catch (error) {
        console.error(`Rank update failed for user ${userStat._id}`, error);
      }
    })
  );
  console.log("🏆 Ranker job completed at", new Date().toISOString());
};
export const Ranker: Job = {
  name: "Ranker",
  description: "Recalculate user ranks every minute",
  enabled: true,
  schedule: CronSchedule.EVERY_DAY_MIDNIGHT,
  handler: rankHandler,
};
