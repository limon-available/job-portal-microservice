import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export const requestId: RequestHandler = (req, res, next) => {
  req.requestId = randomUUID();
  req.headers["x-request-id"] = req.requestId;
  res.setHeader("x-request-id", req.requestId);
  next();
};
