import { Request, Response } from "express"
import { sendResponse } from "../types/apiResponse.js";
import ArchForge from "../pipelines/ArchForgeEngine.js";

export const archForgeCodeGenBricks = async (req: Request, res: Response): Promise<void> => {
    try {
        //! Version 1 for text only
        const userId = req.userId;

        if (!userId) {
            sendResponse(res, 401, { success: false, message: "Unauthorized" });
            return;
        }
        const {projectId, cursor_fileId, prompt = ""} = req.body;
        if (!projectId) {
            sendResponse(res, 400, { success: false, message: "Missing or Invalid Project Id " });
            return;
        }
        await ArchForge._process_({
            userId, projectId, cursor_fileId, prompt
        })
        sendResponse(res, 200, { success: true, message: "Process is Running", data: [] });
    } catch (error) {
        console.error("Error ArchForge Controller:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
        return ;
    }
}