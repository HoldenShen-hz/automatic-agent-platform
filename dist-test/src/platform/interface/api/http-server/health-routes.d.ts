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
import type { MissionControlService } from "../mission-control-service.js";
export interface HealthRouteDeps {
    missionControlService: MissionControlService;
}
export declare function createHealthRoutes(deps: HealthRouteDeps): RouteDefinition[];
