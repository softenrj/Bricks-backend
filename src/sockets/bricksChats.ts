// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import BricksMessage from "../model/bricks_message.js";
import { Socket } from "socket.io";

export const bricksChatSocket = (socket: Socket) => {
  socket.on("bricks-chat:recall", async (req) => {
    try {
      const { chatId, projectId } = req;
      const userId = socket.data.userId;

      if (!userId) {
        socket.emit("bricks-chat:prompt:ack", { error: "User not authenticated." });
        return;
      }

      const chatHistory = await BricksMessage.find({ userId, chatId, projectId })
        .sort({ createdAt: -1 })
        .lean();

      socket.emit("bricks-chat:recall:ack", chatHistory);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      socket.emit("bricks-chat:recall:ack", error);
    }
  });
};
