import { Server } from "socket.io";
import { logger } from "./loggerConfig.js";
import { broadCast, SocketModule } from "../socket.js";
import admin from "./firebaseAdmin.js";
import User from "../model/user.js";

export const socketInitializer = (httpServer: any) => {
    const io = new Server(httpServer, {
        cors: { origin: process.env.URL, methods: ["GET", "POST"] },
    });

    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) return next(new Error("Unauthorized"));
            const decodedToken = await admin.auth().verifyIdToken(token);
            const user = await User.findOne({ firebaseId: decodedToken.uid }, { _id: 1 });

            if (!user) {
                return next(new Error("Unauthorized"));
            }
            socket.data.userId = user._id;
            next();
        } catch (err) {
            next(new Error("Unauthorized"));
        }
    })

    io.on("connection", (socket) => {
        logger.color("greenBright").bold(`A user with socket Id: ${socket.id} connected`);
        socket.join(socket.data.userId.toString());

        socket.on("disconnect", (reason) => {
            logger.color("yellowBright").bold(`User disconnected: ${socket.id}, reason: ${reason}`);
        });

        // All other Logics
        SocketModule(socket);
    });

    broadCast(io);

    return io;
};