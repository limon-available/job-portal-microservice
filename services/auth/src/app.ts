import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { AppError, createObservability } from "@hireheaven/shared";
import authRoutes from "./routes/auth.js";
import { env } from "./config/env.js";
import { requestId } from "./middleware/requestId.js";
import errorHandler from "./utils/errorHandler.js";

const app = express();
const allowedOrigins = new Set(env.CORS_ORIGINS);
const observability = createObservability("auth");

app.use(observability.middleware);
app.get("/metrics", observability.metricsHandler);
app.use(requestId);
app.use(helmet());
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new AppError(403, "Origin is not allowed"));
  },
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Auth service is healthy",
    data: { status: "ok" },
  });
});
app.use("/api/auth", authRoutes);
app.use(errorHandler);

export default app;
