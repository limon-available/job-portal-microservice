import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { createLogger } from "@hireheaven/shared";

const logger = createLogger();

export const requestId: RequestHandler = (req, res, next) => {
  const id = randomUUID();
  res.locals.requestId = id;
  res.setHeader("x-request-id", id);

  const requestLogger = logger.child({ requestId: id });
  const startedAt = Date.now();
  res.on("finish", () => {
    requestLogger.info({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    }, "request completed");
  });

  next();
};
