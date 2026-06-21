// Copyright (c) 2025 Raj
// See LICENSE for details.

import { Request, Response } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { sendResponse } from "../types/apiResponse.js";
import { Admin } from "../model/admin.js";

const NONCE_TTL_MS = 60 * 1000; // 60 seconds
const nonceStore = new Map<string, Date>();

const ADMIN_PUBLIC_KEY = process.env.ADMIN_PUBLIC_KEY!.replace(/\\n/g, "\n");
const JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY!.replace(/\\n/g, "\n");

const isValidNonce = (nonce: string): boolean => {
  const createdAt = nonceStore.get(nonce);
  if (!createdAt) return false;

  if (Date.now() - createdAt.getTime() > NONCE_TTL_MS) {
    nonceStore.delete(nonce);
    return false;
  }

  return true;
};

export const getChallenge = async (req: Request, res: Response): Promise<void> => {
  try {
    const { uid, uniqueCode } = req.body;
    const isAdmin = await Admin.findOne({ uid, uniqueCode });
    if (!isAdmin) {
      sendResponse(res, 403, { success: false, message: "Invalid" });
      return;
    }
    const nonce = crypto.randomBytes(32).toString("hex");
    nonceStore.set(nonce, new Date());

    sendResponse(res, 200, { success: true, message: "Bricks:crypto_nonce", data: nonce });
  } catch (error) {
    console.error("Error while getChallenge:", error);
    sendResponse(res, 500, { success: false, message: "Failed to generate challenge" });
  }
};

export const verifyRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nonce, signature } = req.body;

    if (!nonce || !signature) {
      sendResponse(res, 400, { success: false, message: "Nonce and signature required" });
      return;
    }

    if (!isValidNonce(nonce)) {
      sendResponse(res, 403, { success: false, message: "Invalid or expired nonce" });
      return;
    }

    const isValidSignature = crypto.verify(
      "sha256",
      Buffer.from(nonce),
      ADMIN_PUBLIC_KEY,
      Buffer.from(signature, "base64")
    );

    if (!isValidSignature) {
      sendResponse(res, 403, { success: false, message: "Invalid signature" });
      return;
    }

    nonceStore.delete(nonce);

    const token = jwt.sign({ role: "admin" }, JWT_PRIVATE_KEY);

    sendResponse(res, 200, { success: true, message: "Admin verified", data: { token } });
  } catch (error) {
    console.error("Error while Admin Verify:", error);
    sendResponse(res, 500, { success: false, message: "Verification failed" });
  }
};
