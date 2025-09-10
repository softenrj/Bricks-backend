import { NextFunction, Request, Response } from "express";
import catchAsyncErrors from "./catchAsyncErrors.js";
import admin from "@/config/firebaseAdmin.js";
import User from "@/model/user.js";
import mongoose from "mongoose";

declare global {
  namespace Express {
    interface Request {
      userId?: mongoose.Types.ObjectId;
    }
  }
}

class AuthMiddleware {
  private static extractToken(req: Request): string | null {
    if (req.headers.authorization?.startsWith("Bearer ")) {
      return req.headers.authorization.split(" ")[1];
    }
    return null;
  }

  public static isAuthenticated = catchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {
    const token = this.extractToken(req);
    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const user = await User.findOne({ firebaseId: decodedToken.uid }, { _id: 1 });

    if (!user) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }

    req.userId = user._id;
    next();
  });
}

export default AuthMiddleware;
export const isAuth = AuthMiddleware.isAuthenticated;
