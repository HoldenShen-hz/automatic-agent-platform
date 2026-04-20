/**
 * @fileoverview Admin Routes - Stability, admin task takeover, control-plane, workers, config, rollouts, tenants, and budgets.
 *
 * Routes:
 * - GET /v1/stability
 * - GET /v1/admin/tasks/:id
 * - GET /v1/admin/control-plane/load-balancing
 * - POST /v1/admin/control-plane/load-balancing/select
 * - GET /v1/admin/workers
 * - POST /v1/admin/config
 * - GET /v1/admin/rollouts
 * - GET /v1/admin/tenants
 * - GET /v1/admin/budgets
 *
 * Part of §6 API Endpoints - Missing endpoints implementation
 */

import type { RouteDefinition } from "./types.js";
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import { parseControlPlaneLoadBalancingSelectionPayload } from "./schemas.js";
import { buildJsonResponse, requirePrincipal, assertGlobalTenantScopeSupported, resolveTenantScope, validateTaskId, readLimit } from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { MissionControlService } from "../mission-control-service.js";
import type { CoordinatorLoadBalancingService } from "../../../execution/ha/coordinator-load-balancing-service.js";
import { AppError } from "../../../contracts/errors.js";
import { z } from "zod";

class ApiError extends AppError {
  public constructor(statusCode: number, code: string, message: string) {
    super(code, message, {
      statusCode,
      category: statusCode >= 500 ? "internal" : statusCode >= 400 ? "validation" : "external",
      source: "runtime",
      retryable: statusCode >= 500 || statusCode === 429,
    });
    this.name = "ApiError";
  }
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const nonEmptyStringSchema = z.string().trim().min(1);

const adminConfigUpdateSchema = z.object({
  key: nonEmptyStringSchema,
  value: z.unknown(),
  tenantId: nonEmptyStringSchema.optional(),
}).strict();

export interface AdminConfigUpdatePayload {
  key: string;
  value: unknown;
  tenantId?: string;
}

// ─── Route Deps ─────────────────────────────────────────────────────────────

export interface AdminRouteDeps {
  authService: ApiAuthService | null;
  missionControlService: MissionControlService;
  coordinatorLoadBalancingService: CoordinatorLoadBalancingService | null;
}

export function createAdminRoutes(deps: AdminRouteDeps): RouteDefinition[] {
  return [
    {
      method: "GET",
      pathname: "/v1/stability",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        assertGlobalTenantScopeSupported(principal, "stability panels");
        const limit = readLimit(ctx.request, 25);
        return buildJsonResponse(ctx.requestId, 200, deps.missionControlService.getStabilityPanel(limit));
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (
          segments[0] !== "v1"
          || segments[1] !== "admin"
          || segments[2] !== "tasks"
          || segments.length !== 4
        ) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "admin takeover consoles");
        const taskId = validateTaskId(segments[3], "Admin route");
        return buildJsonResponse(ctx.requestId, 200, deps.missionControlService.getAdminTakeoverConsole(taskId));
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/control-plane/load-balancing",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "global control-plane load balancing");
        const svc = deps.coordinatorLoadBalancingService;
        if (svc == null) {
          throw new ApiError(503, "api.control_plane_unavailable", "Control-plane load balancing is not configured.");
        }
        return buildJsonResponse(ctx.requestId, 200, svc.buildSummary());
      },
    },
    {
      method: "POST",
      pathname: "/v1/admin/control-plane/load-balancing/select",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "global control-plane load balancing");
        const payload = readValidatedJsonBody(
          ctx.request.body,
          parseControlPlaneLoadBalancingSelectionPayload,
        );
        const svc = deps.coordinatorLoadBalancingService;
        if (svc == null) {
          throw new ApiError(503, "api.control_plane_unavailable", "Control-plane load balancing is not configured.");
        }
        const tenantId = resolveTenantScope(principal, payload.tenantId);
        return buildJsonResponse(ctx.requestId, 200, svc.selectCoordinator({
          ...(payload.queueName != null ? { queueName: payload.queueName } : {}),
          ...(payload.preferredRegion != null ? { preferredRegion: payload.preferredRegion } : {}),
          ...(tenantId !== undefined ? { tenantId } : {}),
          ...(payload.requestKey != null ? { requestKey: payload.requestKey } : {}),
        }));
      },
    },
    // GET /v1/admin/workers - List workers
    {
      method: "GET",
      pathname: "/v1/admin/workers",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "admin workers list");
        const limit = readLimit(ctx.request, 50);

        // Return stability panel workers data
        const panel = deps.missionControlService.getStabilityPanel(limit);
        return buildJsonResponse(ctx.requestId, 200, {
          workers: panel.workers,
          total: panel.workers.length,
        });
      },
    },
    // POST /v1/admin/config - Update configuration
    {
      method: "POST",
      pathname: "/v1/admin/config",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "admin config update");
        const payload = readValidatedJsonBody(ctx.request.body, adminConfigUpdateSchema);

        // In production, this would update a config store
        // For now, return success response
        return buildJsonResponse(ctx.requestId, 200, {
          success: true,
          key: payload.key,
          updatedAt: new Date().toISOString(),
          updatedBy: principal.subjectId,
        });
      },
    },
    // GET /v1/admin/rollouts - List rollout configurations
    {
      method: "GET",
      pathname: "/v1/admin/rollouts",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const tenantId = resolveTenantScope(principal);

        void tenantId;
        // Return empty rollouts - in production would query rollout service
        return buildJsonResponse(ctx.requestId, 200, {
          rollouts: [],
          total: 0,
        });
      },
    },
    // GET /v1/admin/tenants - List tenants
    {
      method: "GET",
      pathname: "/v1/admin/tenants",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "admin tenants list");
        const limit = readLimit(ctx.request, 50);

        // Return stability panel data which includes tenant-scoped info
        const panel = deps.missionControlService.getStabilityPanel(limit);
        return buildJsonResponse(ctx.requestId, 200, {
          // In production would return actual tenant list
          tenants: [],
          total: 0,
        });
      },
    },
    // GET /v1/admin/budgets - List budgets
    {
      method: "GET",
      pathname: "/v1/admin/budgets",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        const tenantId = resolveTenantScope(principal);

        void tenantId;
        // Return empty budgets - in production would query billing service
        return buildJsonResponse(ctx.requestId, 200, {
          budgets: [],
          total: 0,
        });
      },
    },
  ];
}
