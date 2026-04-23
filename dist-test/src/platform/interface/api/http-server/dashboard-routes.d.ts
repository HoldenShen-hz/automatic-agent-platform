/**
 * @fileoverview Dashboard Routes - Mission control dashboard endpoints.
 *
 * Routes:
 * - GET /v1/dashboard/snapshot
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */
import type { RouteDefinition } from "./types.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { MissionControlService } from "../mission-control-service.js";
export interface DashboardRouteDeps {
    authService: ApiAuthService | null;
    missionControlService: MissionControlService;
}
export declare function createDashboardRoutes(deps: DashboardRouteDeps): RouteDefinition[];
