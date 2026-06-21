// Copyright (c) 2025 Raj
// See LICENSE for details.

import { createServer } from "node:http";
import app from "./app.js";
import { ENV } from "./config/env.js";
import { logger } from "./config/loggerConfig.js";
import { socketInitializer } from "./config/socket.js";

// :::: SOCKETS ::::
const httpServer = createServer(app);
export const io = socketInitializer(httpServer);

//  Start the server and listen for incoming requests
httpServer.listen(ENV.PORT, () => {
  logger.color("magentaBright").bold(`✅ Server is running on http://localhost:${ENV.PORT}`);
});
