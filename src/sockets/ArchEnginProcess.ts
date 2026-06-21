// Copyright (c) 2025 Raj
// See LICENSE for details.

import mongoose from "mongoose";
import { io } from "../server.js";
import { ArchProjectCode } from "../pipelines/ArchForgeEngine.js";

export interface ArchEnginStatusSocket {
  id: string;
  processId: string;
  process: "render" | "complete";
  message: string;
}

export interface ArchCodeSocket extends ArchProjectCode {
  projectId: mongoose.Types.ObjectId;
}

export class ArchEnginStatusSocket {
  public static __push = (payload: ArchEnginStatusSocket, userId: mongoose.Types.ObjectId) => {
    io.to(userId.toString()).emit("bricks:archengin:status", payload);
  };

  public static _code = (payLoad: ArchCodeSocket, userId: mongoose.Types.ObjectId) => {
    io.to(userId.toString()).emit("bricks:archcode:gen", payLoad);
  };
}
