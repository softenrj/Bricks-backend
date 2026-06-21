// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import { Router } from "express";
import * as BricksHistoryController from "../controller/BricksHistory.js";
import { isAuth } from "../middleware/auth.js";

const router = Router();

router.get("/user", isAuth, BricksHistoryController.getUserHistory);
router.get("/project/:projectId", isAuth, BricksHistoryController.getProjectHistory);

router.get("/user-all", isAuth, BricksHistoryController.getAllUserHistory);
router.get("/project-all/:projectId", isAuth, BricksHistoryController.getAllProjectHistory);

router.delete("/user/:historyId", isAuth, BricksHistoryController.removeUserHistory);
router.delete("/user", isAuth, BricksHistoryController.cleanUserHistory);

router.delete("/project/:historyId", isAuth, BricksHistoryController.removeProjectHistory);
router.delete("/project-all/:projectId", isAuth, BricksHistoryController.cleanProjectHistory);

export const BricksHistoryRouter = router;
