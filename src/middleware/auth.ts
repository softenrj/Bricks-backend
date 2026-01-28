import { NextFunction, Request, Response } from "express";
import catchAsyncErrors from "./catchAsyncErrors.js";
import mongoose from "mongoose";
import User from "../model/user.js";
import admin from "../config/firebaseAdmin.js";
import jwt from "jsonwebtoken";
const JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY!.replace(/\\n/g, "\n");

declare global {
  namespace Express {
    interface Request {
      userId?: mongoose.Types.ObjectId;
      user: any;
    }
  }
}

class AuthMiddleware {
  private static extractToken(req: Request): string | null {
    // if (req.headers.authorization?.startsWith("Bearer ")) {
    //   return req.headers.authorization.split(" ")[1];
    // }

    if (req.cookies.token) {
      return req.cookies.token;
    }
    return null;
  }

  public static isAuthenticated = catchAsyncErrors(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = this.extractToken(req);
      if (!token) {
        return res.status(401).json({ message: "Unauthorized: No token provided", unauthorized: true });
      }

      const decodedToken = await admin.auth().verifyIdToken(token);
      const user = await User.findOne({ firebaseId: decodedToken.uid }, { _id: 1 });

      if (!user) {
        return res.status(401).json({ message: "Unauthorized: User not found", unauthorized: true });
      }

      req.userId = user._id;
      next();
    } catch (error) {
      return res.status(401).json({ message: "Unauthorized: User not found", unauthorized: true });
    }
  });
}

export const requireAdmin = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ message: "No token" });
        }

        const payload = jwt.verify(token, JWT_PRIVATE_KEY) as any;

        if (payload.role !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }

        req.user = payload;
        next();
    } catch {
        return res.status(401).json({ message: "Invalid token" });
    }
};


export default AuthMiddleware;
export const isAuth = AuthMiddleware.isAuthenticated;
