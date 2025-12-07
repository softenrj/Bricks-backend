import { Rank } from "../../model/rank.js";
import { UserStats } from "../../model/userStats.js";
import { CronSchedule, Job } from "../../types/jobs.js";

const rankHandler = async () => {
  console.log('🏆 Ranker job started at', new Date().toISOString());
  const users = await UserStats.find({});

  await Promise.all(
    users.map(async (userStat) => {
      try {
        const { reputation, maxStreak } = userStat;
        const rank = await Rank.findOne({
          minStreak: { $lte: maxStreak },
          minReputation: { $lte: reputation }
        }).sort({
          minReputation: -1,
          minStreak: -1
        });

        if (rank && String(userStat.rank) !== String(rank._id)) {
          userStat.rank = rank._id;
          await userStat.save();
        }
      } catch (error) {
        console.error(`Rank update failed for user ${userStat._id}`, error);
      }
    })
  );
  console.log('🏆 Ranker job completed at', new Date().toISOString());
};

export const Ranker: Job = {
  name: "Ranker",
  description: "Recalculate user ranks every minute",
  enabled: true,
  schedule: CronSchedule.EVERY_DAY_MIDNIGHT,
  handler: rankHandler
};
