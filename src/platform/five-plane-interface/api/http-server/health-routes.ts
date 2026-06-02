/**
 * @fileoverview Health Routes - Health check, metrics, and OpenAPI endpoints.
 *
 * Routes:
 * - GET /healthz
 * - GET /v1/healthz
 * - GET /health
 * - GET /v1/openapi.json
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */

import type { RouteDefinition } from "./types.js";
import { buildJsonDocumentResponse, buildJsonErrorResponse, buildJsonResponse } from "./utils.js";
import type { MissionControlService } from "../mission-control-service.js";
import { buildOpenApiDocument } from "../openapi-document.js";

export interface HealthRouteDeps {
  missionControlService: MissionControlService;
  isShuttingDown?: () => boolean;
  apiVersion?: string;
  platformVersion?: string;
  contractVersion?: string;
  minClientVersion?: string;
  openApiPublic?: boolean;
}

function healthStatusCode(report: { status?: unknown }, shuttingDown: boolean): number {
  if (shuttingDown) {
    return 503;
  }
  return report.status === "ok" || report.status === "healthy" ? 200 : 503;
}

export function createHealthRoutes(deps: HealthRouteDeps): RouteDefinition[] {
  return [
    {
      method: "GET",
      pathname: "/livez",
      handler: async (ctx) => buildJsonResponse(ctx.requestId, 200, {
        status: "alive",
        shuttingDown: deps.isShuttingDown?.() ?? false,
      }),
    },
    {
      method: "GET",
      pathname: "/readyz",
      handler: async (ctx) => {
        const report = await deps.missionControlService.getHealthReportAsync();
        const shuttingDown = deps.isShuttingDown?.() ?? false;
        return buildJsonResponse(ctx.requestId, healthStatusCode(report, shuttingDown), {
          ...report,
          readiness: shuttingDown ? "shutting_down" : "ready",
        });
      },
    },
    {
      method: "GET",
      pathname: "/healthz",
      handler: async (ctx) => {
        const report = await deps.missionControlService.getHealthReportAsync();
        return buildJsonResponse(ctx.requestId, healthStatusCode(report, deps.isShuttingDown?.() ?? false), report);
      },
    },
    {
      method: "GET",
      pathname: "/v1/healthz",
      handler: async (ctx) => {
        const report = await deps.missionControlService.getHealthReportAsync();
        return buildJsonResponse(ctx.requestId, healthStatusCode(report, deps.isShuttingDown?.() ?? false), report);
      },
    },
    {
      method: "GET",
      pathname: "/health",
      handler: async (ctx) => buildJsonResponse(ctx.requestId, 200, await deps.missionControlService.getHealthReportAsync()),
    },
    {
      method: "GET",
      pathname: "/v1/openapi.json",
      handler: (ctx) => {
        if (deps.openApiPublic !== true && ctx.principal == null) {
          return buildJsonErrorResponse(ctx.requestId, 401, {
            code: "api.openapi_auth_required",
            message: "Authentication is required to access the OpenAPI document.",
          });
        }
        return buildJsonDocumentResponse(buildOpenApiDocument(), ctx.requestId);
      },
    },
    {
      method: "GET",
      pathname: "/v1/version",
      handler: async (ctx) => buildJsonResponse(ctx.requestId, 200, {
        accepted: true,
        apiVersion: deps.apiVersion ?? "v1",
        platformVersion: deps.platformVersion ?? "0.1.0",
        contractVersion: deps.contractVersion ?? "2026-04-01",
        minClientVersion: deps.minClientVersion ?? "0.1.0",
      }),
    },
    {
      method: "GET",
      pathname: "/v1/handshake",
      handler: async (ctx) => buildJsonResponse(ctx.requestId, 200, {
        accepted: true,
        apiVersion: deps.apiVersion ?? "v1",
        platformVersion: deps.platformVersion ?? "0.1.0",
        contractVersion: deps.contractVersion ?? "2026-04-01",
        minClientVersion: deps.minClientVersion ?? "0.1.0",
      }),
    },
  ];
}
