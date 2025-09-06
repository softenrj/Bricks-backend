import { Router } from "express";
import * as userController from "@/controller/userController.js"

const router = Router();

router.post('signIn', userController.signIn)

export const userRouter = router;