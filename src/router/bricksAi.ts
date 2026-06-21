// Copyright (c) 2025 Raj
// See LICENSE for details.

import { Router } from "express";
import { isAuth, isStreamAuth } from "../middleware/auth.js";
import * as bricksArchController from "../controller/bricksArchController.js";
import * as snapsortController from "../controller/snapshotController.js";

const router = Router();

router.post("/bricks-arch-forge", isAuth, bricksArchController.archForgeCodeGenBricks);
router.get("/bricks-arch-forge/stream/:jobId", isStreamAuth, bricksArchController.ArchForgeStream);

router.post("/bricks-arch/snapshot-extened", isAuth, snapsortController.extendSnapLife);
router.post("/bricks-arch/snapshot-commit", isAuth, snapsortController.commitSnap);
router.post("/bricks-arch/snapshot-rollback", isAuth, snapsortController.rollbackSnap);

export const BricksAiRouter = router;
