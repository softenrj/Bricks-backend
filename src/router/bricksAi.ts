import { Router } from "express";
import { isAuth } from "../middleware/auth.js";
import * as bricksArchController from "../controller/bricksArchController.js"

const router = Router();

router.post('/bricks-arch-forge', isAuth, bricksArchController.archForgeCodeGenBricks)

export const BricksAiRouter = router;
