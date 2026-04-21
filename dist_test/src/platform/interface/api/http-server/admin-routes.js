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
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import { parseControlPlaneLoadBalancingSelectionPayload } from "./schemas.js";
import { buildJsonResponse, requirePrincipal, assertGlobalTenantScopeSupported, resolveTenantScope, validateTaskId, readLimit } from "./utils.js";
import { AppError } from "../../../contracts/errors.js";
import { z } from "zod";
class ApiError extends AppError {
    constructor(statusCode, code, message) {
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
export function createAdminRoutes(deps) {
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
                if (segments[0] !== "v1"
                    || segments[1] !== "admin"
                    || segments[2] !== "tasks"
                    || segments.length !== 4) {
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
                const payload = readValidatedJsonBody(ctx.request.body, parseControlPlaneLoadBalancingSelectionPayload);
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
                const payload = readValidatedJsonBody(ctx.request.body, adminConfigUpdateSchema.parse);
                const tenantId = resolveTenantScope(principal, payload.tenantId);
                const record = deps.adminConfigService?.applyUpdate({
                    key: payload.key,
                    value: payload.value,
                    ...(tenantId !== undefined ? { tenantId } : {}),
                    updatedBy: principal.actorId,
                }) ?? {
                    success: true,
                    key: payload.key,
                    value: payload.value,
                    tenantId: tenantId ?? null,
                    updatedAt: new Date().toISOString(),
                    updatedBy: principal.actorId,
                };
                return buildJsonResponse(ctx.requestId, 200, {
                    success: true,
                    record,
                });
            },
        },
        // GET /v1/admin/rollouts - List rollout configurations
        {
            method: "GET",
            pathname: "/v1/admin/rollouts",
            handler: (ctx) => {
                requirePrincipal(ctx.request, deps.authService, "viewer");
                const rollouts = deps.configRolloutService?.getActiveRollouts() ?? [];
                return buildJsonResponse(ctx.requestId, 200, {
                    rollouts,
                    total: rollouts.length,
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
                return buildJsonResponse(ctx.requestId, 200, {
                    tenants: deps.tenantRegistryService?.listTenants(limit) ?? [],
                    total: deps.tenantRegistryService?.listTenants(Number.MAX_SAFE_INTEGER).length ?? 0,
                });
            },
        },
        // GET /v1/admin/budgets - List budgets
        {
            method: "GET",
            pathname: "/v1/admin/budgets",
            handler: (ctx) => {
                const principal = requirePrincipal(ctx.request, deps.authService, "admin");
                const tenantId = resolveTenantScope(principal, undefined);
                const budgets = deps.costReportService?.listBudgetSummaries(50, tenantId) ?? [];
                return buildJsonResponse(ctx.requestId, 200, {
                    budgets,
                    total: budgets.length,
                });
            },
        },
    ];
}
//# sourceMappingURL=admin-routes.js.map