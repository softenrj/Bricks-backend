import { Request, Response } from "express";
import { sendResponse } from "../types/apiResponse.js";
import { BricksHistory } from "../model/BricksHistory.js";
import { AchievementService } from "../service/Achievements.js";
import { AchievementEnum } from "../model/achievements.js";

export const getUserHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            sendResponse(res, 401, { success: false, message: "Unauthorized" });
            return;
        }

        const { lastCreatedAt, limit = 10, q, sort } = req.query;

        const query: Record<string, any> = {
            userId,
            projectId: null
        };

        let sort_filter: 1 | -1 = -1;
        if (sort) {
            sort_filter = sort === "asc" ? 1 : -1;
        }

        if (lastCreatedAt) {
            const date = new Date(lastCreatedAt as any);
            if (!isNaN(date.getTime())) {
                query.createdAt = { $lt: date }
            }
        }

        if (q) {
            query.description = { $regex: q as string, $options: "i" }
        }


        const history = await BricksHistory.find(query).sort({ createdAt: sort_filter }).limit(Number(limit) + 1);
        const hasNextPage = history.length > Number(limit);
        const data = hasNextPage ? history.slice(0, -1) : history;

        sendResponse(res, 200, { success: true, message: "Successfully Fetched User History", data: data, nextCursor: hasNextPage ? data[data.length - 1].createAt : null })
    } catch (error) {
        console.error("Error while fetching user history:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
}

export const removeUserHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            sendResponse(res, 401, { success: false, message: "Unauthorized" });
            return;
        }
        const { historyId } = req.params;

        if (!historyId) {
            sendResponse(res, 400, { success: false, message: "Missing or Invalid History Id" });
            return;
        }

        await BricksHistory.findByIdAndDelete(historyId)
        sendResponse(res, 200, { success: true, message: "Successfully Removed History" })
    } catch (error) {
        console.error("Error while fetching user history:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
}

export const cleanUserHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            sendResponse(res, 401, { success: false, message: "Unauthorized" });
            return;
        }

        await BricksHistory.deleteMany({ userId, projectId: null })
        sendResponse(res, 200, { success: true, message: "Successfully Removed History" })
    } catch (error) {
        console.error("Error while fetching user history:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
}


export const getProjectHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            sendResponse(res, 401, { success: false, message: "Unauthorized" });
            return;
        }

        const { lastCreatedAt, limit = 10, q } = req.query;
        const {projectId} = req.params;

        if (!projectId) {
            sendResponse(res, 400, { success: false, message: "Missing or Invalid Project Id" });
            return;
        }

        const query: Record<string, any> = {
            userId,
            projectId
        };

        if (q) {
            query.description = { $regex: q as string, $options: "i" }
        }

        if (lastCreatedAt) {
            const date = new Date(lastCreatedAt as any);
            if (!isNaN(date.getTime())) {
                query.createdAt = { $lt: date }
            }
        }
        const history = await BricksHistory.find(query).sort({ createdAt: -1 }).limit(Number(limit) + 1);

        const hasNextPage = history.length > Number(limit);
        const data = hasNextPage ? history.slice(0,-1) : history;

        sendResponse(res, 200, { success: true, message: "Successfully Fetched project History", data: data, nextCursor: hasNextPage ? data[data.length - 1].createAt : null })
    } catch (error) {
        console.error("Error while fetching project history:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
}

export const removeProjectHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            sendResponse(res, 401, { success: false, message: "Unauthorized" });
            return;
        }
        const historyId = req.params;

        if (!historyId) {
            sendResponse(res, 400, { success: false, message: "Missing or Invalid History Id" });
            return;
        }

        await BricksHistory.findByIdAndDelete(historyId)
        sendResponse(res, 200, { success: true, message: "Successfully Removed History" })
    } catch (error) {
        console.error("Error while fetching user history:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
}

export const cleanProjectHistory = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            sendResponse(res, 401, { success: false, message: "Unauthorized" });
            return;
        }

        const projectId = req.params;

        if (!projectId) {
            sendResponse(res, 400, { success: false, message: "Missing or Invalid Project Id" });
            return;
        }

        await BricksHistory.deleteMany({ userId, projectId: projectId })
        await AchievementService(AchievementEnum.SH, userId);
        sendResponse(res, 200, { success: true, message: "Successfully Removed History" })
    } catch (error) {
        console.error("Error while fetching user history:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
}
