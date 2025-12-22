import { Request, Response } from "express";
import { sendResponse } from "../types/apiResponse.js";
import { BricksEvent } from "../model/events.js";

export const createNewEvent = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, description, status, effect } = req.body;

    if (!name || !status) {
      sendResponse(res, 400, {
        success: false,
        message: "Name and status are required",
      });
      return;
    }

    let thumbnail = null;
    let audio = null;

    if (req.cloudinaryImage && req.cloudinaryImage.url) {
      thumbnail = req.cloudinaryImage.url;
    }

    if (req.cloudinaryAudio && req.cloudinaryAudio.url) {
      audio = req.cloudinaryAudio.url;
    }

    const event = await BricksEvent.create({
      name: name,
      description: description,
      status: status,
      effect: effect,
      thumbnail: thumbnail,
      audio: audio,
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
      { $sort: { createdAt: sort_filter }},
      { $limit: Number(limit) +1},
      { $lookup: {
        from: "Comment",
        localField: "_id",
        foreignField: "typeId",
        as: "eventComments"
      }},
      { $addFields: { comments: { $size: "$eventComments"}}},
      { $project: { eventComments: 0 }}
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
    if (!eventId) {
      sendResponse(res,400, { success: false, message: "Event Id is Required" });
      return ;
    }
    
    const event = await BricksEvent.findByIdAndUpdate(eventId, {
      $inc: { liked: 1 }
    }, { new: true })



    sendResponse(res,200, { success: true, message: "Liked", data: event });
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
    if (!eventId) {
      sendResponse(res,400, { success: false, message: "Event Id is Required" });
      return ;
    }
    
    const event = await BricksEvent.findByIdAndUpdate(eventId, {
      $inc: { liked: -1 }
    }, { new: true })

    sendResponse(res,200, { success: true, message: " unLiked", data: event });
  } catch (error) {
    console.error("Error while Like Events:", error);
    sendResponse(res, 500, { success: false, message: "Internal Server Error" });
  }
}