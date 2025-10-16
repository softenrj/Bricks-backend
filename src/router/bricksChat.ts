import { Router } from "express";
import { isAuth } from "../middleware/auth.js";
import * as bricksChatController from "../controller/project.chat.js"

const router = Router();

router.get('/tabs', isAuth, bricksChatController.projectBricksChatTabs)
router.get('/brick-ai-response/:projectId', isAuth, bricksChatController.projectBricksChat)

export const bricksChatRouter = router;