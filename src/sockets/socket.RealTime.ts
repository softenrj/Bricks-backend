import mongoose from "mongoose"
import { io } from "server.js"

export interface RealtimeStatusSocket {
    id: string
    type: "info" | "warn" | "fun" | "error"
    message: string
}

export class RealtimeStatusSocket {
    public static __push = (payload: RealtimeStatusSocket, userId: mongoose.Types.ObjectId) => {
        io.to(userId.toString()).emit('bricks:realtime:status', payload)
    }
}