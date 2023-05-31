import express from "express";
import { config } from "./config";
import DbConnect from "./setupDatabase";
import { Server } from "./setupServer";

class Application {
  public initialize() {
    this.loadConfiguration();
    DbConnect();
    const app = express();
    const server = new Server(app);
    server.start();
  }

  private loadConfiguration() {
    config.validateConfig();
  }
}

const application = new Application();
application.initialize();
