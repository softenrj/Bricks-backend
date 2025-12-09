import cron from "node-cron";
import AllJobs from "./jobs/index.js"
import { logger } from "../config/loggerConfig.js";

logger.color('gray',"\n🏰 The Forge of Time awakens...");
logger.color('red',"~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");

AllJobs.forEach(job => {
  if (!job.enabled) return;

  cron.schedule(job.schedule, async () => {
    try {
      await job.handler();
    } catch (err) {
      console.error(`💀 Quest failed: ${job.name}`, err);
    }
  });

  logger.color('yellow',`⚙️  Quest forged: ${job.name} ⏰ ${job.schedule}`);
});

logger.color('red',"~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
logger.color('gray',"🔥 All quests are now running under the seal of midnight.\n");
