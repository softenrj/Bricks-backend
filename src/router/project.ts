import { isAuth } from "../middleware/auth.js";
import { Router } from "express";
import * as projectController from "../controller/projectController.js"
import ProjectStarHandler from "../controller/project.starController.js";
import ProjectArchieveHandler from "../controller/project.archieveController.js";

const router = Router();

router.post('/bricks-new-project', isAuth, projectController.createNewProject)
router.get('/projects', isAuth, projectController.getProjects)
router.get('/project/:projectId', isAuth, projectController.getProject)
router.get('/bricks-recent', isAuth, projectController.getRecentProjects)
router.delete('/bricks-remove-project/:projectId',isAuth, projectController.markProjectDetete)

router.post('/bricks-star/:projectId', isAuth, ProjectStarHandler.markStar)
router.delete('/bricks-unstar/:projectId', isAuth, ProjectStarHandler.unStar)

router.post('/bricks-archieve/:projectId', isAuth, ProjectArchieveHandler.markArchieve)
router.delete('/bricks-unarchieve/:projectId', isAuth, ProjectArchieveHandler.unArchieve)

router.get('/bricks-all-projects-list-export', isAuth, projectController.exportAllProject)
router.get('/bricks-arch-projects-list-export', isAuth, projectController.exportArchProject)

router.get('/bricks-project-files/:projectId', isAuth, projectController.projectFileTree)

router.get('/bricks-chat-tabs', isAuth, projectController.projectBricksChatTabs)

router.post('/bricks-code-sugg', isAuth, projectController.bricksCodeCompletion)


export const projectRouter = router;