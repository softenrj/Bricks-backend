import User from "@/model/user.js";
import { Request, Response } from "express";

export const signIn = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, username, firebaseId, token, authType } = req.body;

        if (!firebaseId) {
            res.status(400).json({ success: false, message: "firebaseId is required", data: {}, });
            return;
        }
        let user = await User.findOne({ firebaseId });

        if (!user) {
            user = await User.create({ email, username, firebaseId, token, authType });
        }

        res.status(200).json({ success: true, message: "User signed in successfully", data: user });
    } catch (error) {
        console.error("SignIn Error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

