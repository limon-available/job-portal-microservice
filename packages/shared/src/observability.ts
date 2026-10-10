import {
  context,
  propagation,
  SpanStatusCode,
  trace,
  type TextMapGetter,
} from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import type { RequestHandler } from "express";
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from "prom-client";

let telemetrySdk: NodeSDK | undefined;

export async function startTelemetry(serviceName: string): Promise<void> {
  if (telemetrySdk) return;

  process.env.OTEL_SERVICE_NAME ??= serviceName;
  const explicitTracesEndpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  const configuredEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/+$/, "");
  const endpoint = explicitTracesEndpoint || (configuredEndpoint
    ? configuredEndpoint.endsWith("/v1/traces")
      ? configuredEndpoint
      : `${configuredEndpoint}/v1/traces`
    : undefined);
  telemetrySdk = new NodeSDK({
    ...(endpoint ? { traceExporter: new OTLPTraceExporter({ url: endpoint }) } : {}),
  });
  await telemetrySdk.start();
}

export async function shutdownTelemetry(): Promise<void> {
  const sdk = telemetrySdk;
  telemetrySdk = undefined;
  await sdk?.shutdown();
}

export function createObservability(serviceName: string) {
  const registry = new Registry();
  registry.setDefaultLabels({ service: serviceName });
  collectDefaultMetrics({ register: registry });

  const requests = new Counter({
    name: "http_server_requests_total",
    help: "Total HTTP requests completed by this service.",
    labelNames: ["method", "route", "status_code"],
    registers: [registry],
  });
  const duration = new Histogram({
    name: "http_server_request_duration_seconds",
    help: "Duration of completed HTTP requests in seconds.",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });
  const headerGetter: TextMapGetter<import("node:http").IncomingHttpHeaders> = {
    get(carrier, key) {
      const value = carrier[key.toLowerCase()];
      return Array.isArray(value) ? value[0] : value;
    },
    keys(carrier) {
      return Object.keys(carrier);
    },
  };

  const middleware: RequestHandler = (req, res, next) => {
    const startedAt = process.hrtime.bigint();
    const tracer = trace.getTracer(serviceName);
    const extractedContext = propagation.extract(context.active(), req.headers, headerGetter);
    const span = tracer.startSpan(
      "http.server.request",
      {
        attributes: {
          "http.request.method": req.method,
          "service.name": serviceName,
        },
      },
      extractedContext,
    );

    res.once("finish", () => {
      const route = req.route?.path
        ? `${req.baseUrl}${req.route.path}`
        : "unmatched";
      const statusCode = String(res.statusCode);
      const labels = { method: req.method, route, status_code: statusCode };
      requests.inc(labels);
      duration.observe(labels, Number(process.hrtime.bigint() - startedAt) / 1e9);
      span.setAttribute("http.route", route);
      span.setAttribute("http.response.status_code", res.statusCode);
      if (res.statusCode >= 500) {
        span.setStatus({ code: SpanStatusCode.ERROR });
      }
      span.end();
    });

    context.with(trace.setSpan(extractedContext, span), next);
  };

  const metricsHandler: RequestHandler = (_req, res, next) => {
    void registry.metrics().then((metrics) => {
      res.setHeader("Content-Type", registry.contentType);
      res.end(metrics);
    }).catch(next);
  };

  return { middleware, metricsHandler, registry };
}
