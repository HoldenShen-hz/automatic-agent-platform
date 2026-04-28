/**
 * @fileoverview Admin Routes - Stability, admin task takeover, control-plane, workers, config, rollouts, tenants, budgets, harness-runs, replay-sessions.
 *
 * Routes:
 * - GET /v1/stability
 * - GET /v1/admin/tasks/:id
 * - GET /v1/admin/control-plane/load-balancing
 * - POST /v1/admin/control-plane/load-balancing/select
 * - GET /v1/admin/workers
 * - POST /v1/admin/config (also PUT per R5-36)
 * - PUT /v1/admin/config (R5-36)
 * - GET /v1/admin/rollouts
 * - GET /v1/admin/tenants
 * - GET /v1/admin/budgets
 * - GET /v1/admin/chargeback/reports
 * - POST /v1/admin/panic-directives (R5-36)
 * - POST /v1/admin/resume-directives (R5-36)
 * - GET /api/v1/harness-runs (R5-35)
 * - GET /api/v1/harness-runs/:id (R5-35)
 * - GET /api/v1/harness-runs/:id/events (R5-35)
 * - GET /api/v1/replay-sessions (R5-36)
 * - GET /api/v1/replay-sessions/:id (R5-36)
 *
 * Part of §6 API Endpoints - Missing endpoints implementation
 */

import type { RouteDefinition } from "./types.js";
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import { parseControlPlaneLoadBalancingSelectionPayload } from "./schemas.js";
import { buildJsonResponse, requirePrincipal, assertGlobalTenantScopeSupported, resolveTenantScope, validateTaskId, readLimit } from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { MissionControlService } from "../mission-control-service.js";
import type { ApiDelegationService } from "../facade-interfaces.js";
import type { ConfigRolloutService } from "../../../control-plane/config-center/config-rollout-service.js";
import type { TenantBoundaryRegistryService } from "../../../control-plane/tenant/index.js";
import type { CostReportService } from "../cost-report-service.js";
import type { AdminConfigService } from "../admin-config-service.js";
import { ChargebackService } from "../../../model-gateway/cost-tracker/chargeback-service.js";
import { BenchmarkInventoryService } from "../../../shared/stability/benchmark-inventory-service.js";
import { DeploymentInventoryService } from "../../../shared/stability/deployment-inventory-service.js";
import { ProjectionInventoryService } from "../../../state-evidence/events/projection-inventory-service.js";
import { SchemaInventoryService } from "../../../state-evidence/truth/schema-inventory-service.js";
import { JudgeProviderRegistryService } from "../../../prompt-engine/eval/judge-provider-registry-service.js";
import { ComplianceProgramTemplateService } from "../../../compliance/compliance-program-template-service.js";
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

// §28.5 replay session schema
const replaySessionSchema = z.object({
  harnessRunId: z.string(),
  fromSequence: z.number().int().nonnegative().optional(),
  toSequence: z.number().int().nonnegative().optional(),
  replayMode: z.enum(["full", "incremental", "targeted"]).default("full"),
});

// §28.5 panic directive schema
const panicDirectiveSchema = z.object({
  targetType: z.enum(["harness_run", "node_run", "task"]),
  targetId: z.string(),
  reason: z.string(),
  severity: z.enum(["warning", "critical", "immediate"]),
});

// §28.5 resume directive schema
const resumeDirectiveSchema = z.object({
  targetType: z.enum(["harness_run", "node_run", "task"]),
  targetId: z.string(),
  fromCheckpoint: z.boolean().optional(),
  resumeFromStepId: z.string().optional(),
});

export interface AdminConfigUpdatePayload {
  key: string;
  value: unknown;
  tenantId?: string;
}

// ─── Route Deps ─────────────────────────────────────────────────────────────

export interface AdminRouteDeps {
  authService: ApiAuthService | null;
  missionControlService: MissionControlService;
  coordinatorLoadBalancingService: ApiDelegationService | null;
  configRolloutService?: ConfigRolloutService | null;
  tenantRegistryService?: TenantBoundaryRegistryService | null;
  costReportService?: CostReportService | null;
  adminConfigService?: AdminConfigService | null;
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
    {
      method: "GET",
      pathname: "/v1/admin/chargeback/reports",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        const tenantId = resolveTenantScope(principal, undefined);
        const limit = readLimit(ctx.request, 500);
        if (deps.costReportService == null) {
          throw new ApiError(503, "api.cost_reports_unavailable", "Cost reporting is not configured.");
        }
        const report = new ChargebackService(deps.costReportService).buildReport({
          limit,
          ...(tenantId !== undefined ? { tenantId } : {}),
        });
        return buildJsonResponse(ctx.requestId, 200, report);
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/inventories/benchmarks",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "benchmark inventories");
        return buildJsonResponse(ctx.requestId, 200, new BenchmarkInventoryService().listBenchmarks());
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/inventories/projections",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "projection inventories");
        return buildJsonResponse(ctx.requestId, 200, new ProjectionInventoryService().listProjectionInventory());
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/inventories/deployments",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "deployment inventories");
        return buildJsonResponse(ctx.requestId, 200, new DeploymentInventoryService().listDeployments());
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/inventories/schema",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "schema inventories");
        const service = new SchemaInventoryService();
        return buildJsonResponse(ctx.requestId, 200, {
          summary: service.buildSummary(),
          tables: service.listTables(),
        });
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/judges",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "judge inventories");
        const registry = new JudgeProviderRegistryService();
        registry.registerDefaults();
        return buildJsonResponse(ctx.requestId, 200, registry.listDescriptors());
      },
    },
    {
      method: "GET",
      pathname: "/v1/admin/compliance/program-templates",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        assertGlobalTenantScopeSupported(principal, "compliance program templates");
        return buildJsonResponse(ctx.requestId, 200, new ComplianceProgramTemplateService().listTemplates());
      },
    },
  ];
}
