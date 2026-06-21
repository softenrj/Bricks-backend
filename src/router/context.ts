// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import { Router } from "express";
import { isAuth } from "../middleware/auth.js";
import { ProjectContextController } from "../controller/project.context.js";

const router = Router();

router.get("/pxt/:projectId", isAuth, ProjectContextController.getProject);
router.get("/child/:projectId", isAuth, ProjectContextController.getProjectChild);

export const Context = router;
