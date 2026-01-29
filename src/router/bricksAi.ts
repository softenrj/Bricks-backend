import { Router } from "express";
import { isAuth, isStreamAuth } from "../middleware/auth.js";
import * as bricksArchController from "../controller/bricksArchController.js"

const router = Router();

router.post('/bricks-arch-forge', isAuth, bricksArchController.archForgeCodeGenBricks)
router.get('/bricks-arch-forge/stream/:jobId', isStreamAuth, bricksArchController.ArchForgeStream)

export const BricksAiRouter = router;
