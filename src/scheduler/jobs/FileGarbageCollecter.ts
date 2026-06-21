// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import { FileVector } from "../../model/file_vectors.js";
import files_contexts from "../../model/files_contexts.js";
import { Project } from "../../model/project.js";
import { ProjectFile } from "../../model/project_files.js";
import { CronSchedule, Job } from "../../types/jobs.js";

const GarbageCollecter = async () => {
  console.log("🏆 File garbage collecter [file] job started at", new Date().toISOString());

  const projects = await Project.find({ markDelete: true });
  const ids = projects.map((i) => i._id);

  // file remove
  await ProjectFile.deleteMany({ projectId: { $in: ids } });
  await files_contexts.deleteMany({ projectId: { $in: ids } });
  await FileVector.deleteMany({ projectId: { $in: ids } });
  await Project.deleteMany({ _id: { $in: ids } });

  console.log("File garbage collecter [file] job completed at", new Date().toISOString());
};

export const FileGarbageCollecter: Job = {
  name: "file garbage collector",
  description: "project marked delete is now cleaned from database",
  enabled: true,
  handler: GarbageCollecter,
  schedule: CronSchedule.EVERY_DAY_MIDNIGHT,
};
