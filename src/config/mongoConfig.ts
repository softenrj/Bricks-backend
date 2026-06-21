// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import mongoose from "mongoose";
import logger from "primelogger";

mongoose.Promise = Promise;

const mongoServer = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState === 1) {
      logger.default.color("greenBright", "Mongodb is Alreay Connected");
      return;
    }
    if (!process.env.MONGO_URI) {
      logger.default.color("redBright", `Please Check Env + ${process.env.MONGO_URI} `);
      return;
    }
    await mongoose.connect(process.env.MONGO_URI);
    logger.default.color("greenBright", "Mongodb is connected successfully");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1);
  }
};
export default mongoServer;
