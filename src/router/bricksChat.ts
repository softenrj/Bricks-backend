// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import { Router } from "express";
import { isAuth } from "../middleware/auth.js";
import * as bricksChatController from "../controller/project.chat.js";

const router = Router();

router.post("/tabs/:projectId", isAuth, bricksChatController.projectBricksChatTabs);
router.post("/chat-metadata/:projectId", isAuth, bricksChatController.projectBricksChatMetaData);
router.post("/brick-ai-response/:projectId", isAuth, bricksChatController.projectBricksChat);
router.get("/bricks-chat-recoll/:chatId", isAuth, bricksChatController.bricksChatRecoll);

export const bricksChatRouter = router;
