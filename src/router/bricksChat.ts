import { Router } from "express";
import { isAuth } from "../middleware/auth.js";
import * as bricksChatController from "../controller/project.chat.js"

const router = Router();

router.post('/tabs/:projectId', isAuth, bricksChatController.projectBricksChatTabs)
router.post('/brick-ai-response/:projectId', isAuth, bricksChatController.projectBricksChat)

export const bricksChatRouter = router;