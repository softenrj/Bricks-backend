import express, { Application } from "express";
import morgan from "morgan";
import compression from "compression";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
const swaggerDocument = YAML.load("./src/docs/swagger.yaml");
// Configs
import { helmetConfig } from "./config/halmetConfig.js";
import { corsConfig } from "./config/corsConfig.js";
import { rateLimiter } from "./config/rateLimitConfig.js";
// Router & Middleware
import { router } from "./router.js";
import { errorHandler } from "./middleware/errorHandler.js";
import mongoServer from "./config/mongoConfig.js";
import { env } from "./config/env.js";
import "./scheduler/index.js"
import cookieParser from 'cookie-parser';

const app = express();
env

// :::: Middleware Stack ::::
// Doc
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Logger
app.use(morgan("dev"));
app.use(compression({
    filter: (req, res) => {
        if (req.headers.accept?.includes("text/event-stream")) {
            return false;
        }
        return compression.filter(req, res);
    }
}));
helmetConfig(app);
corsConfig(app);

// MongoDb
mongoServer();

// Rate limiting
app.use(rateLimiter);

// Parse incoming requests and cookie
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// :::: ROUTER ::::
router(app);

// :::: ERROR HANDLER ::::
app.use(errorHandler);

export default app as Application;
