import { createAdapter } from "@socket.io/redis-adapter";
import compression from "compression";
import cookieSession from "cookie-session";
import cors from "cors";
import {
  Application,
  NextFunction,
  Request,
  Response,
  json,
  urlencoded,
} from "express";
import "express-async-errors";
import helmet from "helmet";
import hpp from "hpp";
import Http from "http";
import { createClient } from "redis";
import socket from "socket.io";
import { config } from "./config";
import applicationRoutes from "./routes";
import { CustomError, IErrorResponse } from "./shared/globals/error-handler";

const SERVER_PORT = 5000;
const log = config.createLogger("server");

export class Server {
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  start() {
    this.securityMiddleware(this.app);
    this.standardMiddleware(this.app);
    this.routeMiddleware(this.app);
    this.globalErrorHandler(this.app);
    this.startServer(this.app);
  }

  private securityMiddleware(app: Application) {
    app.use(
      cookieSession({
        name: "session",
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        keys: [config.SECRET_KEY_ONE!, config.SECRET_KEY_TWO!],
        maxAge: 1000 * 60 * 60 * 24 * 7,
        secure: config.NODE_ENV !== "development",
      })
    );
    app.use(hpp);
    app.use(helmet);
    app.use(
      cors({
        origin: config.CLIENT_URL,
        credentials: true,
        optionsSuccessStatus: 200,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      })
    );
  }

  private standardMiddleware(app: Application) {
    app.use(compression());
    app.use(json({ limit: "50mb" }));
    app.use(urlencoded({ extended: true, limit: "50mb" }));
  }

  private routeMiddleware(app: Application) {
    applicationRoutes(app);
  }

  private globalErrorHandler(app: Application) {
    app.all("*", (req, res) => {
      res.status(404).json({ message: `${req.originalUrl} not found` });
    });

    app.use(
      (
        error: IErrorResponse,
        _req: Request,
        res: Response,
        next: NextFunction
      ) => {
        log.error(error);
        if (error instanceof CustomError) {
          return res.status(error.statusCode).json(error.serializeErrors());
        }
        next();
      }
    );
  }

  private async startServer(app: Application) {
    try {
      const httpServer = new Http.Server(app);
      const socketId = await this.createSocketIon(httpServer);
      this.startHttpServer(httpServer);
      this.socketIOConnection(socketId);
    } catch (error) {
      log.error(error);
    }
  }

  private async createSocketIon(httpServer: Http.Server) {
    const io = new socket.Server(httpServer, {
      cors: {
        origin: config.CLIENT_URL,
      },
    });
    const pubClient = createClient({ url: config.REDIS_HOST });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient, subClient]);
    io.adapter(createAdapter(pubClient, subClient));
    return io;
  }

  private startHttpServer(httpServer: Http.Server) {
    log.info(`Server started with process ${process.pid}`);
    httpServer.listen(SERVER_PORT, () => {
      log.info(`Server running on port ${SERVER_PORT}`);
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  private socketIOConnection(io: socket.Server) {}
}
