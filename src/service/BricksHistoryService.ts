// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import mongoose from "mongoose";
import { BrickHistoryTypeEnum, BricksHistory } from "../model/BricksHistory.js";

interface BricksHistry {
  userId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  description: string;
}

export const pushProjectHistory = async (
  history: BricksHistry,
  type: BrickHistoryTypeEnum
): Promise<void> => {
  try {
    const { userId, projectId, description } = history;
    await BricksHistory.create({
      userId: userId,
      projectId: projectId,
      type: type,
      description: description,
    });
  } catch (error) {
    console.error("Error while push History", error);
  }
};

export const modifyProjectHistory = async (
  history: BricksHistry,
  type: BrickHistoryTypeEnum
): Promise<void> => {
  try {
    const { userId, projectId, description } = history;
    await BricksHistory.updateOne(
      {
        userId: userId,
        projectId: projectId,
        type: type,
      },
      { description: description },
      { upsert: true }
    );
  } catch (error) {
    console.error("Error while push History", error);
  }
};

export const pushUserHistory = async (
  history: BricksHistry,
  type: BrickHistoryTypeEnum
): Promise<void> => {
  try {
    const { userId, description } = history;
    await BricksHistory.create({
      userId: userId,
      type: type,
      description: description,
    });
  } catch (error) {
    console.error("Error while push History", error);
  }
};
