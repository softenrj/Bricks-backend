import { NextFunction, Router } from "express";
import { isAuth, requireAdmin } from "../middleware/auth.js";
import * as eventController from "../controller/bricksEventController.js";
import { uploadAudioToCloudinary, uploadFiles, uploadToCloudnary } from "../middleware/fileUpload.js";

const router = Router();

router.post('/add',requireAdmin, (req, res, next: NextFunction) => {console.log(req); next()}, uploadFiles, uploadToCloudnary, uploadAudioToCloudinary, eventController.createNewEvent)
router.get('/get', isAuth, eventController.getEvents)

router.post('/like/:eventId', isAuth, eventController.likeEvent)
router.post('/unlike/:eventId', isAuth, eventController.unlikeEvent)

export const eventRouter = router;