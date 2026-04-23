/**
 * @fileoverview Console Routes - HTML mission-control dashboard endpoints.
 *
 * Routes:
 * - GET /console
 * - GET /console/tasks/:id
 * - GET /console/workflows
 * - GET /console/workflows/:id
 * - GET /console/approvals
 * - GET /console/stability
 * - GET /console/admin/tasks/:id
 * - GET /console/targets
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */
import type { RouteDefinition } from "./types.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { MissionControlService } from "../mission-control-service.js";
import type { GatewayTargetDirectoryService } from "../../channel-gateway/gateway-target-directory-service.js";
export interface ConsoleRouteDeps {
    authService: ApiAuthService | null;
    missionControlService: MissionControlService;
    gatewayTargetDirectoryService: GatewayTargetDirectoryService | null;
}
export declare function createConsoleRoutes(deps: ConsoleRouteDeps): RouteDefinition[];
