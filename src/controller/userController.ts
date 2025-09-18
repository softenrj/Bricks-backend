import User from "@/model/user.js";
import { userIdProvider } from "@/service/user.uidProvider.js";
import { sendResponse } from "@/types/apiResponse.js";
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
            const uid = userIdProvider()
            user = await User.create({ email, username, firebaseId, token, authType, uid });
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

        sendResponse(res, 200, { success: true, data: user, message: "successfully fetched user data "})
    } catch (error) {
        console.error("Error getting User data:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
}