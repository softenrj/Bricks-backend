// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

//? FLUCFlowService
// Handles CREATE / UPDATE routing for project file changes.
// Ensures DB consistency and real-time sync across systems.

import mongoose from "mongoose";
import { FSTYPE, ProjectFile } from "../model/project_files.js";
import { projectUpdate } from "../sockets/projectSink.js";
import { RealtimeStatusSocket } from "../sockets/socket.RealTime.js";
import { uIdProvider } from "./user.uidProvider.js";

type FlowServiceType = {
  path: string;
  name: string;
  projectId: mongoose.Types.ObjectId;
  content: string;
  userId: mongoose.Types.ObjectId;
  type: FSTYPE;
};

class FLUCFlowService {
  /** Main entry point: decides whether to create or update */
  /**
   *
   * @param payload
   * @returns
   */
  public static async process(payload: FlowServiceType): Promise<boolean> {
    const { path, name, projectId, content, userId, type } = payload;

    try {
      const isNew = await this._isNewFile(path, name, projectId, userId, type);
      if (isNew === undefined) return false;

      if (isNew) {
        // Create new file record
        await ProjectFile.create({ path, name, content, type, userId, projectId });
        RealtimeStatusSocket.__push(
          {
            id: uIdProvider(),
            type: "info",
            message: `[Info] Project ${type} is created`,
          },
          userId
        );
      } else {
        // Update existing file (real-time sync)
        await projectUpdate(path, content, name, userId, projectId);
        RealtimeStatusSocket.__push(
          {
            id: uIdProvider(),
            type: "info",
            message: "[Info] Project File is Updated",
          },
          userId
        );
      }
      return true;
    } catch (error) {
      console.error("FLUC error:", error);
      return false;
    }
  }

  /** ! Checks DB to determine if file already exists */
  /**
   *
   * @param path
   * @param name
   * @param projectId
   * @param userId
   * @param type
   * @returns
   */
  private static async _isNewFile(
    path: string,
    name: string,
    projectId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    type: FSTYPE
  ): Promise<boolean | undefined> {
    try {
      const existing = await ProjectFile.findOne({ path, name, projectId, userId, type });
      return !existing;
    } catch (err) {
      console.error("FLUC lookup failed:", err);
      return undefined;
    }
  }
}

export { FLUCFlowService };
