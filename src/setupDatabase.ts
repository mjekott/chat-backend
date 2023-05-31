import mongoose from "mongoose";
import { config } from "./config";

const log = config.createLogger("setup database");

export default async () => {
  try {
    mongoose.connect(config.DATABASE_URL!);
    log.info("DB Connected");
  } catch (error) {
    log.error("Error connecting to database", error);
    process.exit(1);
  }
};
