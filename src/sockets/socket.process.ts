import mongoose from "mongoose"
import { io } from "../server.js"

export interface ProcessSocketType {
    status: boolean,
    message: string
}

export class ProcessSocket {
    public static pushStatus = (pdt: ProcessSocketType, userId: mongoose.Types.ObjectId) => {
        io.to(userId.toString()).emit('bricks:process:status', pdt)
    }
}