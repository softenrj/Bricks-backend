import { Request, Response } from "express";
import { sendResponse } from "../types/apiResponse.js";
import ArchForge from "../pipelines/ArchForgeEngine.js";
import { pushProjectHistory } from "../service/BricksHistoryService.js";
import { BrickHistoryTypeEnum } from "../model/BricksHistory.js";
import crypto from "crypto";
import { archSSEmanager } from "../serversideevents/ArchSSEManager.js";

export const archForgeCodeGenBricks = async (req: Request, res: Response): Promise<void> => {
  try {
    //! Version 1 for text only
    const userId = req.userId;

    if (!userId) {
      sendResponse(res, 401, { success: false, message: "Unauthorized" });
      return;
    }
    const { projectId, cursor_fileId, prompt = "" } = req.body;
    if (!projectId) {
      sendResponse(res, 400, { success: false, message: "Missing or Invalid Project Id " });
      return;
    }

    const jobId = crypto.randomUUID();
    sendResponse(res, 200, { success: true, message: "Process is Running", data: jobId });

    await ArchForge._process_({
      userId,
      projectId,
      cursor_fileId,
      prompt,
      jobId,
    });

    pushProjectHistory(
      {
        userId,
        projectId,
        description: `Initiated ArchForge Code Generation with prompt: "${prompt.substring(0, 30)}..."`,
      },
      BrickHistoryTypeEnum.ArchForge
    );
  } catch (error) {
    console.error("Error ArchForge Controller:", error);
    sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    return;
  }
};

export const ArchForgeStream = async (req: Request, res: Response): Promise<void> => {
  const { jobId } = req.params;

  if (!jobId) {
    sendResponse(res, 400, { success: false, message: "Missing or Invalid Project Id " });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  archSSEmanager._add(jobId as string, res);

  req.on("close", () => {
    archSSEmanager._remove(jobId as string);
  });
  return;
};
