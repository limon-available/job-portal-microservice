import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export const TryCatch = (controller: AsyncController): RequestHandler =>
  (req, res, next) => {
    void controller(req, res, next).catch(next);
  };
