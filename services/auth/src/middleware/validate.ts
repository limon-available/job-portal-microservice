import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "@hireheaven/shared";

type RequestPart = "body" | "params";

export const validate = (
  schema: ZodType,
  part: RequestPart = "body",
): RequestHandler => (req: Request, _res: Response, next: NextFunction) => {
  const result = schema.safeParse(part === "body" ? req.body : req.params);

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    return next(new AppError(400, message));
  }

  if (part === "body") {
    req.body = result.data;
  }

  return next();
};
