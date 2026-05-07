/**
 * @fileoverview Health Routes - Health check, metrics, OpenAPI, and contract version endpoints.
 *
 * Routes:
 * - GET /healthz
 * - GET /v1/healthz
 * - GET /health
 * - GET /v1/openapi.json
 * - GET /api/contract-version
 * - GET /api/v1/meta/contract-version
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */

import type { RouteDefinition } from "./types.js";
import { buildJsonDocumentResponse, buildJsonResponse } from "./utils.js";
import type { MissionControlService } from "../mission-control-service.js";
import { buildOpenApiDocument } from "../openapi-document.js";

/**
 * API Contract Version
 * Represents the current API contract version per §6.4.
 */
export const API_CONTRACT_VERSION = "2026-04-01" as const;
export const API_CONTRACT_MIN_VERSION = "2026-01-01" as const;

export interface ContractVersionInfo {
  readonly contractVersion: string;
  readonly minServerVersion: string;
  readonly supportedVersions: readonly string[];
  readonly platformVersion: string;
  readonly status: "current" | "deprecated";
  readonly version: string;
  readonly minVersion: string;
}

export interface HealthRouteDeps {
  missionControlService: MissionControlService;
}

function buildContractVersionInfo(): ContractVersionInfo {
  return {
    contractVersion: API_CONTRACT_VERSION,
    minServerVersion: API_CONTRACT_MIN_VERSION,
    supportedVersions: [API_CONTRACT_VERSION, API_CONTRACT_MIN_VERSION],
    platformVersion: API_CONTRACT_VERSION,
    status: "current",
    // Legacy aliases kept during the migration window.
    version: API_CONTRACT_VERSION,
    minVersion: API_CONTRACT_MIN_VERSION,
  };
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
    {
      method: "GET",
      pathname: "/api/contract-version",
      handler: (ctx) => buildJsonResponse(ctx.requestId, 200, buildContractVersionInfo()),
    },
    {
      method: "GET",
      pathname: "/api/v1/meta/contract-version",
      handler: (ctx) => buildJsonResponse(ctx.requestId, 200, buildContractVersionInfo()),
    },
    {
      method: "GET",
      pathname: "/v1/meta/contract-version",
      handler: (ctx) => buildJsonResponse(ctx.requestId, 200, buildContractVersionInfo()),
    },
  ];
}
