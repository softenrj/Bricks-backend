import { Router } from "express";
import * as userController from "../controller/userController.js"
import { isAuth } from "../middleware/auth.js";

const router = Router();

router.post('/signIn', userController.signIn)
router.get('/bricks-user', isAuth, userController.getUser)

export const userRouter = router;