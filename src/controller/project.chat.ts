import express, { Response, Request } from "express"
import bricks_chats from "../model/bricks_chats.js";
import { sendResponse } from "../types/apiResponse.js";
import { BRICKS_AI_ENGINE } from "../service/bricksChat.js";
import { Message } from "../types/AIMessage.js";
import { uIdProvider } from "../service/user.uidProvider.js";


/**
 * 
 * @param req 
 * @param res 
 * @returns 
 */

export const projectBricksChatTabs = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const projectId = req.params.projectId;

    if (!userId) {
      sendResponse(res, 401, { success: false, message: "Unauthorized" });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const cursor = req.query.cursor ? new Date(req.query.cursor as string) : null;

    const query: any = { userId, projectId };
    if (cursor) {
      query.createdAt = { $lt: cursor };
    }

    const tabs = await bricks_chats
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    const nextCursor: Date | null = tabs.length > 0 
      ? new Date(tabs[tabs.length - 1].createdAt) 
      : null;

    sendResponse(res, 200, {
      success: true,
      message: "Bricks chat fetched successfully",
      data: tabs,
      nextCursor,
    });
  } catch (error) {
    console.error("Error Getting FS: Project:", error);
    sendResponse(res, 500, { success: false, message: "Internal Server Error" });
  }
};


export const projectBricksChat = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        const projectId = req.params.projectId;
        const { chatId, prompt } = req.body;

        if (!userId) {
            sendResponse(res, 401, { success: false, message: "Unauthorized" });
            return;
        }

        if (!projectId) {
            sendResponse(res, 401, { success: false, message: "ChatId or Project Id is Envalid please try again." })
            return;
        }

        if (!prompt || prompt.trim() == '') {
            sendResponse(res, 401, { success: false, message: "Prompt cannot be empty." })
            return;
        }

        const aiResponse = await BRICKS_AI_ENGINE.projectChatSupport(chatId, userId, String(projectId), prompt);

        const result: Message = {
            id: uIdProvider(),
            role: "assistant",
            content: aiResponse,
        }
        sendResponse(res, 200, { success: true, message: "Ai Response", data: result });
    } catch (error) {
        console.error("Error Getting FS: Project:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
}