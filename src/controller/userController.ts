// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import { Request, Response } from "express";
import User from "../model/user.js";
import { userIdProvider } from "../service/user.uidProvider.js";
import { sendResponse } from "../types/apiResponse.js";
import { streakEngine } from "../service/UserStatsService.js";
import { AchievementService } from "../service/Achievements.js";
import { AchievementEnum } from "../model/achievements.js";
import { UserStats } from "../model/userStats.js";

export const signIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, username, firebaseId, token, authType, profile } = req.body;

    if (!firebaseId) {
      sendResponse(res, 400, { success: false, message: "firebaseId is required" });
      return;
    }
    let user = await User.findOne({ firebaseId });

    if (user && user?.authType !== authType) {
      user = await User.findByIdAndUpdate(user._id, { $set: { authType } }, { new: true });
    }

    if (!user) {
      const uid = userIdProvider();
      user = await User.create({ email, username, firebaseId, token, authType, uid, profile });
    }

    sendResponse(res, 200, { success: true, message: "User signed in successfully", data: user });
  } catch (error) {
    console.error("SignIn Error:", error);
    sendResponse(res, 500, {
      success: false,
      message: "Internal server error",
    });
  }
};

export const getUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      sendResponse(res, 401, { success: false, message: "Unauthorized" });
      return;
    }

    const user = await User.findById(userId).select("-authType -token -firebaseId");
    if (!user) {
      sendResponse(res, 401, { success: false, message: "Unauthorized" });
      return;
    }

    sendResponse(res, 200, {
      success: true,
      data: user,
      message: "successfully fetched user data ",
    });
  } catch (error) {
    console.error("Error getting User data:", error);
    sendResponse(res, 500, { success: false, message: "Internal Server Error" });
  }
};

export const accountChange = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      sendResponse(res, 401, { success: false, message: "Unauthorized" });
      return;
    }

    const { penname, bio } = req.body;

    const updateFields: Record<string, any> = {};

    if (req.cloudinaryImage?.url) {
      updateFields.profile = req.cloudinaryImage.url;
    }

    if (typeof penname === "string" && penname.trim()) {
      updateFields.penname = penname.trim();
    }

    if (typeof bio === "string" && bio.trim()) {
      updateFields.bio = bio.trim();
    }

    if (!Object.keys(updateFields).length) {
      sendResponse(res, 400, { success: false, message: "No changes provided" });
      return;
    }

    const updatedProfile = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true }
    );

    if (updatedProfile && userId) {
      await AchievementService(AchievementEnum.ER, userId);
    }

    sendResponse(res, 200, {
      success: true,
      message: "Profile updated successfully",
      data: updatedProfile,
    });
  } catch (error) {
    console.error("Error Updating User data:", error);
    sendResponse(res, 500, {
      success: false,
      message: "Internal Server Error",
    });
  }
};

export const dailyLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      sendResponse(res, 401, { success: false, message: "Unauthorized" });
      return;
    }
    await streakEngine(userId);
    sendResponse(res, 200, { success: true, message: "success on daily Login" });
  } catch (error) {
    console.error("Error  Daily Login:", error);
    sendResponse(res, 500, { success: false, message: "Internal Server Error" });
  }
};

export const getUserStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      sendResponse(res, 401, { success: false, message: "Unauthorized" });
      return;
    }

    const statsAgg = await UserStats.aggregate([
      { $match: { userId } },
      {
        $lookup: {
          from: "achievements",
          localField: "achievements",
          foreignField: "_id",
          as: "achievements",
        },
      },
      { $lookup: { from: "ranks", localField: "rank", foreignField: "_id", as: "rank" } },
      { $unwind: { path: "$rank", preserveNullAndEmptyArrays: true } },
    ]);

    let userStats;
    if (statsAgg.length === 0) {
      userStats = await UserStats.create({ userId });
    } else {
      userStats = statsAgg[0];
    }
    sendResponse(res, 200, {
      success: true,
      message: "successfully fetched userStats",
      data: userStats,
    });
  } catch (error) {
    console.error("Error getting User data:", error);
    sendResponse(res, 500, { success: false, message: "Internal Server Error" });
  }
};
