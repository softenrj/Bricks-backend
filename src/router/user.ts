// Copyright (c) 2025 Raj
// See LICENSE for details.

import { Router } from "express";
import * as userController from "../controller/userController.js";
import { isAuth } from "../middleware/auth.js";
import { upLoad, uploadSingleImageToCloudnary } from "../middleware/fileUpload.js";

const router = Router();

router.post("/signIn", userController.signIn);
router.get("/bricks-user", isAuth, userController.getUser);
router.get("/bricks-stats", isAuth, userController.getUserStats);

router.patch("/update", isAuth, upLoad, uploadSingleImageToCloudnary, userController.accountChange);
router.post("/daily-login", isAuth, userController.dailyLogin);

export const userRouter = router;
