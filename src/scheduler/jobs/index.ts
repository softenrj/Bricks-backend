// Copyright (c) 2025 Raj
// See LICENSE for details.

import { Job } from "../../types/jobs.js";
import { AchievementScheduler } from "./Achievement.js";
import { FileGarbageCollecter } from "./FileGarbageCollecter.js";
import { Ranker } from "./ranker.js";
import { SnapshotCleaner } from "./SnapshotCleaner.js";

const AllJobs: Job[] = [Ranker, AchievementScheduler, SnapshotCleaner, FileGarbageCollecter];

export default AllJobs;
