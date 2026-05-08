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
import { buildJsonDocumentResponse, buildJsonResponse } from "./utils.js";
import type { MissionControlService } from "../mission-control-service.js";
import { buildOpenApiDocument } from "../openapi-document.js";

export interface HealthRouteDeps {
  missionControlService: MissionControlService;
}

export function createHealthRoutes(deps: HealthRouteDeps): RouteDefinition[] {
  return [
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
      handler: () => buildJsonDocumentResponse(buildOpenApiDocument()),
    },
  ];
}
