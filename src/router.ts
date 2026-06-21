// Copyright (c) 2025 Raj
// See LICENSE for details.

import { Application, Request, Response } from "express";
import { userRouter } from "./router/user.js";
import { projectRouter } from "./router/project.js";
import { Context } from "./router/context.js";
import { bricksChatRouter } from "./router/bricksChat.js";
import { BricksAiRouter } from "./router/bricksAi.js";
import { BricksHistoryRouter } from "./router/bricksHistory.js";
import { adminRouter } from "./router/admin.js";
import { eventRouter } from "./router/event.js";
import { commentRouter } from "./router/comment.js";

export const router = (app: Application) => {
  (app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: Date.now(),
    });
  }),
    app.use("/api/user", userRouter),
    app.use("/api/project", projectRouter),
    app.use("/api/context", Context),
    app.use("/api/chat", bricksChatRouter),
    app.use("/api/ai", BricksAiRouter),
    app.use("/api/history", BricksHistoryRouter),
    app.use("/api/admin", adminRouter),
    app.use("/api/event", eventRouter),
    app.use("/api/comment", commentRouter),
    app.use("/", (req: Request, res: Response): void => {
      res.status(200).json("Welcome to the Bricks API");
    }));
};
