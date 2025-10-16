import express, { Response, Request } from "express"
import bricks_chats from "../model/bricks_chats.js";
import { sendResponse } from "../types/apiResponse.js";
import { BRICKS_AI_ENGINE } from "../service/bricksChat.js";


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

        const tabs = await bricks_chats.find({ userId, projectId })
        sendResponse(res, 200, { success: true, message: "Bricks chat is Successfully fetched", data: tabs });
    } catch (error) {
        console.error("Error Getting FS: Project:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
}

export const projectBricksChat = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        const projectId = req.params;
        const { chatId , prompt } = req.body;

        if (!userId) {
            sendResponse(res, 401, { success: false, message: "Unauthorized" });
            return;
        }

        if (!chatId || !projectId) {
            sendResponse(res, 4001, { success: false, message: "ChatId or Project Id is Envalid please try again."})
            return ;
        }

        if (!prompt || prompt.trim() == '') {
            sendResponse(res, 401, { success: false, message: "Prompt cannot be empty." })
            return ;
        }

        const aiResponse = await BRICKS_AI_ENGINE.projectChatSupport(chatId, userId, String(projectId), prompt);

        const base64Encode = Buffer.from(aiResponse, 'base64').toString();
        sendResponse(res, 200, { success: true, message: "Ai Response", data: base64Encode });
    } catch (error) {
        console.error("Error Getting FS: Project:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
}