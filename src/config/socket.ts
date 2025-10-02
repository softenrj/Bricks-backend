import { Server } from "socket.io";
import { logger } from "./loggerConfig.js";
import { broadCast, SocketModule } from "@/socket.js";

export const socketInitializer = (httpServer: any) => {
    const io = new Server(httpServer, {
        cors: { origin: process.env.URL, methods: ["GET", "POST"] },
    });

    io.on("connection", (socket) => {
        logger.color("greenBright").bold(`A user with socket Id: ${socket.id} connected`);
        socket.on("disconnect", (reason) => {
            logger.color("yellowBright").bold(`User disconnected: ${socket.id}, reason: ${reason}`);
        });

        // All other Logics
        SocketModule(socket);
    });

    broadCast(io);

    return io;
};