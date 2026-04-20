/**
 * @fileoverview Dashboard Routes - Mission control dashboard endpoints.
 *
 * Routes:
 * - GET /v1/dashboard/snapshot
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */

import type { RouteDefinition } from "./types.js";
import { buildJsonResponse, requirePrincipal, assertGlobalTenantScopeSupported } from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { MissionControlService } from "../mission-control-service.js";

export interface DashboardRouteDeps {
  authService: ApiAuthService | null;
  missionControlService: MissionControlService;
}

export function createDashboardRoutes(deps: DashboardRouteDeps): RouteDefinition[] {
  return [
    {
      method: "GET",
      pathname: "/dashboard/snapshot",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        assertGlobalTenantScopeSupported(principal, "dashboard snapshots");
        return buildJsonResponse(ctx.requestId, 200, deps.missionControlService.getSnapshot());
      },
    },
    {
      method: "GET",
      pathname: "/v1/dashboard/snapshot",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        assertGlobalTenantScopeSupported(principal, "dashboard snapshots");
        return buildJsonResponse(ctx.requestId, 200, deps.missionControlService.getSnapshot());
      },
    },
  ];
}
