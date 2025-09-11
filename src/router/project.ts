import { isAuth } from "@/middleware/auth.js";
import { Router } from "express";
import * as projectController from "@/controller/projectController.js"

const router = Router();

router.post('/bricks-new-project', isAuth, projectController.createNewProject)
router.get('/projects', isAuth, projectController.getProjects)
router.get('/project/:projectId', isAuth, projectController.getProject)
router.get('/bricks-recent', isAuth, projectController.getRecentProjects)


export const projectRouter = router;