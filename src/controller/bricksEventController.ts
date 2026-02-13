import { Request, Response } from "express";
import { sendResponse } from "../types/apiResponse.js";
import { BricksEvent } from "../model/events.js";
import { LikeModule } from "../service/LikeService.js";
import comments, { BType } from "../model/comments.js";
import mongoose from "mongoose";

export const createNewEvent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, description, lyrics, effect, expireAt, liveAt } = req.body;

    if (!name || !liveAt || !expireAt) {
      sendResponse(res, 400, {
        success: false,
        message: "Name, Live Date, and Expiry Date are required",
      });
      return;
    }

    const start = new Date(liveAt);
    const end = new Date(expireAt);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      sendResponse(res, 400, { success: false, message: "Invalid Date format" });
      return;
    }

    if (end <= start) {
      sendResponse(res, 400, {
        success: false,
        message: "Expire date must be after the Live date"
      });
      return;
    }

    const thumbnail = req.cloudinaryImage?.url || null;
    const audio = req.cloudinaryAudio?.url || null;

    const event = await BricksEvent.create({
      name,
      description,
      effect,
      lyrics,
      thumbnail,
      liveAt: start,
      expireAt: end,
      audio,
    });

    sendResponse(res, 201, { success: true, message: "Event created successfully", data: event });
  } catch (error) {
    console.error("Error Creating New Event:", error);
    sendResponse(res, 500, { success: false, message: "Internal Server Error" });
  }
};
export const getEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      sendResponse(res, 401, { success: false, message: "Unauthorized" });
      return;
    }

    const { lastCreatedAt, limit = 10, sort } = req.query;

    const query: Record<string, any> = {};

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

    const bricksEvent = await BricksEvent.aggregate([
      { $match: query },
      { $sort: { createdAt: -1 } },
      { $limit: Number(limit) + 1 },
      {
        $lookup: {
          from: "comments",
          let: { eventId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$typeId", "$$eventId"] } } },
            { $count: "count" }
          ],
          as: "commentStats"
        }
      },
      {
        $lookup: {
          from: "likes",
          let: { eventId: "$_id" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$typeId", "$$eventId"] }, { $eq: ["$userId", userId] }] } } },
            { $project: { _id: 1 } }
          ],
          as: "myLike"
        }
      },
      {
        $addFields: {
          comments: { $ifNull: [{ $arrayElemAt: ["$commentStats.count", 0] }, 0] },
          isLiked: { $gt: [{ $size: "$myLike" }, 0] }
        }
      },
      { $project: { commentStats: 0, myLike: 0, eventComments: 0, eventLikes: 0 } }
    ])


    const hasNextPage = bricksEvent.length > Number(limit);
    const data = hasNextPage ? bricksEvent.slice(0, -1) : bricksEvent;

    sendResponse(res, 200, { success: true, message: "Successfully Fetched project History", data: data, nextCursor: hasNextPage ? data[data.length - 1].createdAt : null })
  } catch (error) {
    console.error("Error fetching Events:", error);
    sendResponse(res, 500, { success: false, message: "Internal Server Error" });
  }
}

export const likeEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      sendResponse(res, 401, { success: false, message: "Unauthorized" });
      return;
    }

    const { eventId } = req.params;

    if (!eventId || !mongoose.isValidObjectId(eventId)) {
      sendResponse(res, 400, { success: false, message: "Valid Event Id is Required" });
      return;
    }

    const result = await LikeModule.setLike(
      BType.EVENT,
      new mongoose.Types.ObjectId(eventId),
      userId
    );

    if (!result.success) {
      sendResponse(res, 400, { success: false, message: "Could not process like" });
      return;
    }

    let event = null;

    if (result.action === 'added') {
      event = await BricksEvent.findByIdAndUpdate(
        eventId,
        { $inc: { liked: 1 } },
        { new: true }
      );
    } else {
      event = await BricksEvent.findById(eventId);
    }

    sendResponse(res, 200, { success: true, message: "Liked", data: event });

  } catch (error) {
    console.error("Error while Like Events:", error);
    sendResponse(res, 500, { success: false, message: "Internal Server Error" });
  }
}

export const unlikeEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      sendResponse(res, 401, { success: false, message: "Unauthorized" });
      return;
    }

    const { eventId } = req.params;
    if (!eventId || !mongoose.isValidObjectId(eventId)) {
      sendResponse(res, 400, { success: false, message: "Valid Event Id is Required" });
      return;
    }

    const result = await LikeModule.removeLike(
      BType.EVENT,
      new mongoose.Types.ObjectId(eventId),
      userId
    );

    if (!result.success) {
      sendResponse(res, 400, { success: false, message: "Could not process unlike" });
      return;
    }

    let event = null;

    if (result.action === 'removed') {
      event = await BricksEvent.findByIdAndUpdate(
        eventId,
        { $inc: { liked: -1 } },
        { new: true }
      );
    } else {
      event = await BricksEvent.findById(eventId);
    }

    sendResponse(res, 200, { success: true, message: "Unliked", data: event });

  } catch (error) {
    console.error("Error while Unlike Events:", error);
    sendResponse(res, 500, { success: false, message: "Internal Server Error" });
  }
}