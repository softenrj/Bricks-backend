// Copyright (c) 2025 Raj
// See LICENSE for details.

import { Router } from "express";
import { getChallenge, verifyRequest } from "../controller/adminController.js";

const router = Router();

router.post("/challenge", getChallenge);
router.post("/verify", verifyRequest);

export const adminRouter = router;
