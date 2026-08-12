import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

const frontendDistDir = process.env["FRONTEND_DIST_DIR"];

if (frontendDistDir) {
  const frontendIndexPath = path.join(frontendDistDir, "index.html");

  app.use(express.static(frontendDistDir, { index: false }));
  app.use((req, res, next) => {
    if (
      req.method !== "GET" ||
      req.path === "/api" ||
      req.path.startsWith("/api/")
    ) {
      next();
      return;
    }

    if (!fs.existsSync(frontendIndexPath)) {
      next();
      return;
    }

    res.sendFile(frontendIndexPath, (error) => {
      if (error) next(error);
    });
  });
}

export default app;
