import { Application, Request, Response } from "express";
import { userRouter } from "./router/user.js";
import { projectRouter } from "./router/project.js";

export const router = (app: Application) => {
    app.get('/health', (req, res) => {
        res.json({
            status: "ok",
            uptime: process.uptime(),
            timestamp: Date.now(),
        });
    }),
    
    app.use('/api/user',userRouter),
    app.use('/api/project', projectRouter),

    app.use('/', (req: Request, res: Response): void => {
        res.status(200).json("Welcome to the API")
    })
}