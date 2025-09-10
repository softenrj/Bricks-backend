import User from "@/model/user.js";
import { ApiResponse, sendResponse } from "@/types/apiResponse.js";
import { Request, Response } from "express";

export const signIn = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, username, firebaseId, token, authType } = req.body;

        if (!firebaseId) {
            sendResponse(res, 400, { success: false, message: "firebaseId is required", })
            return;
        }
        let user = await User.findOne({ firebaseId });

        if (!user) {
            user = await User.create({ email, username, firebaseId, token, authType });
        }

        sendResponse(res, 200, ({ success: true, message: "User signed in successfully", data: user }));
    } catch (error) {
        console.error("SignIn Error:", error);
        sendResponse(res, 500, {
            success: false,
            message: "Internal server error",
        })
    }
};

