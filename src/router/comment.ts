import { Router } from "express";
import { isAuth } from "../middleware/auth.js";
import * as commentController from "../controller/commentController.js";

const router = Router();

router.post('/new', isAuth, commentController.newComment)

router.get('/comments', isAuth, commentController.getComment)

router.get('/replies/:commentId', isAuth, commentController.getReplies)

router.delete('/remove/:commentId', isAuth, commentController.removeComment)

export const commentRouter = router;