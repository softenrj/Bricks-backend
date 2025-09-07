import { Application } from "express";
import cors from "cors";

const allowedOrigins = [
  "http://localhost:3000",
  "https://bricks-three-rose.vercel.app"
];

export const corsConfig = (app: Application) => {
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("CORS not allowed for this origin"));
        }
      },
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );
};
