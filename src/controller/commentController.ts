// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import { Request, Response } from "express";
import { sendResponse } from "../types/apiResponse.js";
import Comments from "../model/comments.js";
import mongoose from "mongoose";

export const newComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      sendResponse(res, 401, { success: false, message: "Unauthorized" });
      return;
    }

    const { content, parentId, type, typeId, profile } = req.body;

    if (!content || !type || !typeId) {
      sendResponse(res, 400, { success: false, message: " Missing Content or Type" });
      return;
    }

    const commentObject: Record<string, any> = {
      content: content,
      type: type,
      userId: userId,
      typeId: typeId,
      profile: profile,
    };
    if (parentId) {
      commentObject.parentId = parentId;
    }

    const message = await Comments.create(commentObject);
    sendResponse(res, 200, { success: true, message: "message is added", data: message });
  } catch (error) {
    console.error("Error adding commnet:", error);
    sendResponse(res, 500, { success: false, message: "Internal Server Error" });
  }
};

export const getComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      sendResponse(res, 401, { success: false, message: "Unauthorized" });
      return;
    }

    const { lastCreatedAt, limit = 10, sort, type, typeId } = req.query;

    if (!type || !typeId) {
      sendResponse(res, 400, { success: false, message: " Missing Type" });
      return;
    }

    const query: Record<string, any> = {
      type: type,
      typeId: new mongoose.Types.ObjectId(typeId as any),
    };
    let sort_filter: 1 | -1 = -1;
    if (sort) {
      sort_filter = sort === "asc" ? 1 : -1;
    }

    if (lastCreatedAt) {
      const date = new Date(lastCreatedAt as any);
      if (!isNaN(date.getTime())) {
        query.createdAt = { $lt: date };
      }
    }

    const comments = await Comments.aggregate([
      { $match: query },
      { $sort: { createdAt: sort_filter } },
      { $limit: Number(limit) + 1 },

      {
        $lookup: {
          from: "comments",
          let: { parentId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$parentId", "$$parentId"] } } },
            { $count: "count" },
          ],
          as: "replyStats",
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userObj",
        },
      },

      {
        $addFields: {
          replies: { $ifNull: [{ $arrayElemAt: ["$replyStats.count", 0] }, 0] },
          profile: { $arrayElemAt: ["$userObj.profile", 0] },
          userName: { $arrayElemAt: ["$userObj.username", 0] },
        },
      },

      { $project: { replyStats: 0, userObj: 0, replie: 0 } },
    ]);

    const hasNextPage = comments.length > Number(limit);
    const data = hasNextPage ? comments.slice(0, -1) : comments;

    sendResponse(res, 200, {
      success: true,
      message: "fetched message",
      data: data,
      nextCursor: hasNextPage ? data[data.length - 1].createdAt : null,
    });
  } catch (error) {
    console.error("Error while fetching comments:", error);
    sendResponse(res, 500, { success: false, message: "Internal Server Error" });
  }
};

export const getReplies = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      sendResponse(res, 401, { success: false, message: "Unauthorized" });
      return;
    }

    const { commentId } = req.params;
    const { lastCreatedAt, limit = 10, sort } = req.query;

    if (!commentId) {
      sendResponse(res, 400, { success: false, message: "Missing or Envalid Comment id" });
      return;
    }
    const query: Record<string, any> = { parentId: commentId };
    let sort_filter: 1 | -1 = -1;
    if (sort) {
      sort_filter = sort === "asc" ? 1 : -1;
    }

    if (lastCreatedAt) {
      const date = new Date(lastCreatedAt as any);
      if (!isNaN(date.getTime())) {
        query.createdAt = { $lt: date };
      }
    }

    const comments = await Comments.aggregate([
      { $match: query },
      { $sort: { sort_filter } },
      { $limit: Number(limit) + 1 },
      {
        $lookup: {
          from: "Comment",
          localField: "_id",
          foreignField: "parentId",
          as: "replie",
        },
      },
      { $addFields: { replies: { $size: "$replie" } } },
      { $project: { replie: 0 } },
    ]);
    const hasNextPage = comments.length > Number(limit);
    const data = hasNextPage ? comments.slice(0, -1) : comments;
    sendResponse(res, 200, {
      success: true,
      message: "fetched message",
      data: data,
      nextCursor: hasNextPage ? data[data.length - 1].createdAt : null,
    });
  } catch (error) {
    console.error("Error while fetching comments:", error);
    sendResponse(res, 500, { success: false, message: "Internal Server Error" });
  }
};

export const removeComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      sendResponse(res, 401, { success: false, message: "Unauthorized" });
      return;
    }

    const { commentId, lastCreatedAt, limit = 10, sort } = req.params;

    if (!commentId) {
      sendResponse(res, 400, { success: false, message: "Missing or Envalid Comment id" });
      return;
    }

    const comment = await Comments.findByIdAndUpdate(commentId, {
      isDeleted: true,
    });

    sendResponse(res, 200, { success: true, message: "message is Removed", data: comment });
  } catch (error) {
    console.error("Error while Removing comments:", error);
    sendResponse(res, 500, { success: false, message: "Internal Server Error" });
  }
};
