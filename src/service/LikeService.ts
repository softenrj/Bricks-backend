// Copyright (c) 2025 Raj
// See LICENSE for details.

import mongoose from "mongoose";
import { BType } from "../model/comments.js";
import { Like } from "../model/like.js";

interface LikeResult {
  success: boolean;
  action?: "added" | "removed" | "no_change";
  error?: any;
}

export class LikeModule {
  /**
   *
   * @param type
   * @param typeId
   * @param userId
   * @returns
   */
  public static setLike = async (
    type: BType,
    typeId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<LikeResult> => {
    try {
      const result = await Like.updateOne(
        { type, typeId, userId },
        { $set: { type, typeId, userId, createdAt: new Date() } },
        { upsert: true }
      );

      const action = result.upsertedCount > 0 ? "added" : "no_change";

      return { success: true, action };
    } catch (error) {
      console.error(`Error in setLike [User: ${userId}, Type: ${type}]`, error);
      return { success: false, error };
    }
  };

  /**
   *
   * @param type
   * @param typeId
   * @param userId
   * @returns
   */
  public static removeLike = async (
    type: BType,
    typeId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<LikeResult> => {
    try {
      const result = await Like.deleteOne({ type, typeId, userId });

      const action = result.deletedCount > 0 ? "removed" : "no_change";

      return { success: true, action };
    } catch (error) {
      console.error(`Error in removeLike [User: ${userId}, Type: ${type}]`, error);
      return { success: false, error };
    }
  };

  /**
   *
   * @param type
   * @param typeId
   * @param userId
   * @returns
   */
  public static toggleLike = async (
    type: BType,
    typeId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<LikeResult> => {
    try {
      const existingLike = await Like.findOne({ type, typeId, userId });

      if (existingLike) {
        await existingLike.deleteOne();
        return { success: true, action: "removed" };
      } else {
        await Like.create({ type, typeId, userId });
        return { success: true, action: "added" };
      }
    } catch (error) {
      console.error(`Error in toggleLike [User: ${userId}, Type: ${type}]`, error);
      return { success: false, error };
    }
  };
}
