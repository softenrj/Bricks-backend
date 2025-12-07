export interface Job {
  name: string;
  description: string;
  schedule: CronSchedule;
  handler: () => Promise<void>;
  enabled: boolean;
}


export enum CronSchedule {
  EVERY_SECOND = "* * * * * *",
  EVERY_15_SECONDS = "*/15 * * * * *",
  EVERY_MINUTE = "0 * * * * *",
  EVERY_5_MINUTES = "0 */5 * * * *",
  EVERY_15_MINUTES = "0 */15 * * * *",
  EVERY_HOUR = "0 0 * * * *",
  EVERY_6_HOURS = "0 0 */6 * * *",
  EVERY_DAY_MIDNIGHT = "0 0 0 * * *",
  EVERY_WEEK_3AM = "0 0 3 * * 1",
  EVERY_MONTH = "0 0 0 1 * *",
}
