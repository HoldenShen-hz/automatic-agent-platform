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

const PLATFORM_API_VERSION = "v1";
const PLATFORM_VERSION = process.env["AA_BUILD_VERSION"] ?? "0.1.0";
const CONTRACT_VERSION = process.env["AA_CONTRACT_VERSION"] ?? "2026-04-01";
const MIN_CLIENT_VERSION = process.env["AA_MIN_CLIENT_VERSION"] ?? "0.1.0";
const OPENAPI_PUBLIC_OPT_IN_ENV = "AA_OPENAPI_PUBLIC";

export interface HealthRouteDeps {
  missionControlService: MissionControlService;
  isShuttingDown?: () => boolean;
}

function healthStatusCode(report: Record<string, unknown>, shuttingDown: boolean): number {
  if (shuttingDown) {
    return 503;
  }
  return report["status"] === "ok" || report["status"] === "healthy" ? 200 : 503;
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
        const report = await deps.missionControlService.getHealthReportAsync() as unknown as Record<string, unknown>;
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
      handler: async (ctx) => buildJsonResponse(ctx.requestId, 200, await deps.missionControlService.getHealthReportAsync()),
    },
    {
      method: "GET",
      pathname: "/v1/healthz",
      handler: async (ctx) => buildJsonResponse(ctx.requestId, 200, await deps.missionControlService.getHealthReportAsync()),
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
        if (ctx.principal == null && process.env[OPENAPI_PUBLIC_OPT_IN_ENV] !== "1") {
          return buildJsonErrorResponse(ctx.requestId, 401, {
            code: "api.openapi_auth_required",
            message: "OpenAPI document access requires authentication unless AA_OPENAPI_PUBLIC=1 is explicitly set.",
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
        apiVersion: PLATFORM_API_VERSION,
        platformVersion: PLATFORM_VERSION,
        contractVersion: CONTRACT_VERSION,
        minClientVersion: MIN_CLIENT_VERSION,
      }),
    },
    {
      method: "GET",
      pathname: "/v1/handshake",
      handler: async (ctx) => buildJsonResponse(ctx.requestId, 200, {
        accepted: true,
        apiVersion: PLATFORM_API_VERSION,
        platformVersion: PLATFORM_VERSION,
        contractVersion: CONTRACT_VERSION,
        minClientVersion: MIN_CLIENT_VERSION,
      }),
    },
  ];
}
