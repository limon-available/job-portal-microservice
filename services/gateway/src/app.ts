import type { NextFunction, Request, RequestHandler, Response } from "express";
import cors from "cors";
import CircuitBreaker from "opossum";
import express from "express";
import helmet from "helmet";
import { createProxyMiddleware } from "http-proxy-middleware";
import { AppError, createLogger, createObservability } from "@hireheaven/shared";
import { env } from "./config/env.js";
import { createRateLimit, type GatewayRedisClient } from "./middleware/rateLimit.js";
import { requestId } from "./middleware/requestId.js";
import { authenticateRequest } from "./services/authenticate.js";

interface ServiceRoute {
  prefix: string;
  target: string;
  protectedRoute(path: string, method: string): boolean;
  pathRewrite?: (path: string) => string;
}

const isPath = (path: string, prefix: string): boolean =>
  path === prefix || path.startsWith(`${prefix}/`);

export const requiresAuthentication = (path: string, method: string): boolean => {
  if (isPath(path, "/api/auth")) {
    if (path.startsWith("/api/auth/internal/")) return true;
    if (method === "GET" && /^\/api\/auth\/verify-email\/[^/]+$/.test(path)) {
      return false;
    }
    if (
      method === "POST" &&
      (path === "/api/auth/register" ||
        path === "/api/auth/login" ||
        path === "/api/auth/forgot" ||
        path === "/api/auth/refresh" ||
        /^\/api\/auth\/reset\/[^/]+$/.test(path))
    )
      return false;
    return true;
  }
  if (isPath(path, "/api/user")) {
    if (
      method === "GET" &&
      (path === "/api/user/openapi.json" ||
        path.startsWith("/api/user/docs") ||
        /^\/api\/user\/public\/[^/]+$/.test(path))
    )
      return false;
    return true;
  }
  if (isPath(path, "/api/jobs")) {
    if (path.startsWith("/api/jobs/internal/")) return true;
    if (
      method === "GET" &&
      (path === "/api/jobs/openapi.json" ||
        path.startsWith("/api/jobs/docs") ||
        path === "/api/jobs/jobs" ||
        (/^\/api\/jobs\/jobs\/[^/]+$/.test(path) && path !== "/api/jobs/jobs/mine"))
    )
      return false;
    return true;
  }
  if (isPath(path, "/api/applications")) {
    return !(
      method === "GET" &&
      (path === "/api/applications/openapi.json" || path.startsWith("/api/applications/docs"))
    );
  }
  return true;
};

const routes: ServiceRoute[] = [
  {
    prefix: "/api/auth",
    target: env.AUTH_SERVICE_URL,
    protectedRoute: requiresAuthentication,
  },
  {
    prefix: "/api/user",
    target: env.USER_SERVICE_URL,
    protectedRoute: requiresAuthentication,
  },
  {
    prefix: "/api/jobs",
    target: env.JOB_SERVICE_URL,
    protectedRoute: requiresAuthentication,
  },
  {
    prefix: "/api/applications",
    target: env.APPLICATION_SERVICE_URL,
    protectedRoute: requiresAuthentication,
  },
  {
    prefix: "/api/notifications",
    target: env.NOTIFICATION_SERVICE_URL,
    protectedRoute: requiresAuthentication,
    pathRewrite: (path) => path.replace(/^\/api\/notifications(?=\/|$)/, "/notifications"),
  },
];

const logger = createLogger({ level: env.LOG_LEVEL });
const safeRequestPath = (path: string): string =>
  path
    .replace(/\/api\/auth\/reset\/[^/?]+/, "/api/auth/reset/[redacted]")
    .replace(/\/api\/auth\/verify-email\/[^/?]+/, "/api/auth/verify-email/[redacted]");
const errorResponse = (res: Response, statusCode: number, message: string): void => {
  if (res.headersSent) return;
  res.status(statusCode).json({ success: false, message, data: null });
};

const createProxyRoute = (route: ServiceRoute, redis: GatewayRedisClient): RequestHandler => {
  const proxy = createProxyMiddleware({
    target: route.target,
    changeOrigin: true,
    timeout: env.PROXY_TIMEOUT_MS,
    proxyTimeout: env.PROXY_TIMEOUT_MS,
    ...(route.pathRewrite ? { pathRewrite: route.pathRewrite } : {}),
    on: {
      proxyReq(proxyRequest, req) {
        proxyRequest.removeHeader("x-user-id");
        proxyRequest.removeHeader("x-user-role");
        proxyRequest.removeHeader("x-gateway-key");
        proxyRequest.removeHeader("x-internal-key");
        proxyRequest.removeHeader("x-access-token-id");
        proxyRequest.removeHeader("x-access-token-exp");
        proxyRequest.setHeader("x-gateway-key", env.GATEWAY_INTERNAL_KEY);
        proxyRequest.setHeader("x-internal-key", env.INTERNAL_API_KEY);
        proxyRequest.setHeader("x-request-id", req.headers["x-request-id"] ?? "");
        const userId = req.headers["x-user-id"];
        const role = req.headers["x-user-role"];
        if (typeof userId === "string" && typeof role === "string") {
          proxyRequest.setHeader("x-user-id", userId);
          proxyRequest.setHeader("x-user-role", role);
          const tokenId = req.headers["x-access-token-id"];
          const tokenExpiresAt = req.headers["x-access-token-exp"];
          if (typeof tokenId === "string" && typeof tokenExpiresAt === "string") {
            proxyRequest.setHeader("x-access-token-id", tokenId);
            proxyRequest.setHeader("x-access-token-exp", tokenExpiresAt);
          }
        }
      },
      error(error, _req, res) {
        logger.warn({ err: error, service: route.prefix }, "upstream proxy failed");

        if ("writeHead" in res) {
          if (!res.headersSent) {
            res.writeHead(502, {
              "Content-Type": "application/json",
            });
            res.end(
              JSON.stringify({
                success: false,
                message: "Upstream service is unavailable",
                data: null,
              }),
            );
          } else {
            res.destroy();
          }
        } else {
          res.destroy();
        }
      },
    },
  });

  const breakerAction = (req: Request, res: Response): Promise<void> =>
    new Promise((resolve, reject) => {
      const onFinish = (): void => {
        res.off("finish", onFinish);
        if (res.statusCode >= 500) {
          reject(new Error(`Upstream returned HTTP ${res.statusCode}`));
        } else {
          resolve();
        }
      };
      res.once("finish", onFinish);
      proxy(req, res, (error?: unknown) => {
        if (error) {
          res.off("finish", onFinish);
          reject(error);
        }
      });
    });
  const breaker = new CircuitBreaker(breakerAction, {
    timeout: env.PROXY_TIMEOUT_MS + 1000,
    errorThresholdPercentage: 50,
    resetTimeout: env.CIRCUIT_RESET_MS,
    volumeThreshold: 5,
  });
  breaker.on("open", () => logger.warn({ service: route.prefix }, "upstream circuit opened"));
  breaker.on("halfOpen", () =>
    logger.info({ service: route.prefix }, "upstream circuit half-open"),
  );
  breaker.on("close", () => logger.info({ service: route.prefix }, "upstream circuit closed"));

  return async (req, res, _next) => {
    try {
      if (route.protectedRoute(req.path, req.method)) {
        const identity = await authenticateRequest(
          req.get("authorization"),
          env.AUTH_SERVICE_URL,
          env.INTERNAL_API_KEY,
          redis,
        );
        req.headers["x-user-id"] = String(identity.userId);
        req.headers["x-user-role"] = identity.role;
        req.headers["x-access-token-id"] = identity.tokenId;
        req.headers["x-access-token-exp"] = String(identity.tokenExpiresAt);
      }
      await breaker.fire(req, res);
    } catch (error) {
      const open = breaker.opened;
      const appError = error instanceof AppError ? error : undefined;
      logger.warn(
        { err: error, service: route.prefix, circuitOpen: open },
        "gateway request failed",
      );
      errorResponse(
        res,
        appError?.statusCode ?? (open ? 503 : 502),
        appError?.isOperational
          ? appError.message
          : open
            ? "Upstream service circuit is open"
            : "Upstream service is unavailable",
      );
    }
  };
};

const stripUntrustedHeaders: RequestHandler = (req, _res, next) => {
  for (const name of Object.keys(req.headers)) {
    if (
      name.startsWith("x-user-") ||
      name === "x-gateway-key" ||
      name === "x-internal-key" ||
      name === "x-access-token-id" ||
      name === "x-access-token-exp"
    ) {
      delete req.headers[name];
    }
  }
  next();
};

export const createApp = (redis: GatewayRedisClient) => {
  const app = express();
  const observability = createObservability("gateway");
  app.set("trust proxy", env.TRUST_PROXY_HOPS);
  app.use(observability.middleware);
  app.get("/metrics", observability.metricsHandler);
  app.use(requestId);
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || env.CORS_ORIGINS.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new AppError(403, "Origin is not allowed"));
      },
    }),
  );
  app.use((req, res, next) => {
    const startedAt = process.hrtime.bigint();
    res.once("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.info(
        {
          requestId: req.requestId,
          method: req.method,
          path: safeRequestPath(req.path),
          statusCode: res.statusCode,
          durationMs: Math.round(durationMs * 100) / 100,
          ip: req.ip,
        },
        "gateway access",
      );
    });
    next();
  });
  app.use(stripUntrustedHeaders);
  app.use(createRateLimit(redis));

  app.get("/health", async (_req, res) => {
    const services = {
      auth: env.AUTH_SERVICE_URL,
      user: env.USER_SERVICE_URL,
      job: env.JOB_SERVICE_URL,
      application: env.APPLICATION_SERVICE_URL,
      notification: env.NOTIFICATION_SERVICE_URL,
      utils: env.UTILS_SERVICE_URL,
    };
    const health = await Promise.all(
      Object.entries(services).map(async ([name, url]) => {
        try {
          const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
          return [name, response.ok] as const;
        } catch {
          return [name, false] as const;
        }
      }),
    );
    const serviceHealth = Object.fromEntries(health);
    const healthy = health.every(([, status]) => status);
    res.status(healthy ? 200 : 503).json({
      success: healthy,
      message: healthy ? "All services are healthy" : "One or more services are unavailable",
      data: { services: serviceHealth },
    });
  });

  app.use("/api/utils", (_req, res) => {
    errorResponse(res, 404, "Direct utility service access is blocked");
  });
  app.use("/api/auth/internal", (_req, res) => {
    errorResponse(res, 404, "Internal auth routes are not publicly accessible");
  });
  app.use("/api/jobs/internal", (_req, res) => {
    errorResponse(res, 404, "Internal job routes are not publicly accessible");
  });

  const routeHandlers = routes.map((route) => ({
    route,
    handler: createProxyRoute(route, redis),
  }));
  app.use((req, res, next) => {
    const match = routeHandlers.find(({ route }) => isPath(req.path, route.prefix));
    if (!match) {
      next();
      return;
    }
    void match.handler(req, res, next);
  });

  app.use((_req, res) => errorResponse(res, 404, "Route not found"));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err: error }, "gateway request error");
    const appError = error instanceof AppError ? error : undefined;
    errorResponse(
      res,
      appError?.statusCode ?? 500,
      appError?.isOperational ? appError.message : "Internal server error",
    );
  });

  return app;
};
