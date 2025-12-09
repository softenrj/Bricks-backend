import { Job } from "../../types/jobs.js";
import { AchievementScheduler } from "./Achievement.js"
import { Ranker } from "./ranker.js";

const AllJobs: Job[] = [
    Ranker,
    AchievementScheduler
]

export default AllJobs;