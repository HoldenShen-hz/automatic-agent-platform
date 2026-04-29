/**
 * @fileoverview Task Routes - Task and workflow listing, retrieval, creation, update and deletion endpoints.
 *
 * Routes:
 * - GET /api/v1/tasks
 * - GET /api/v1/tasks/:id
 * - GET /api/v1/tasks/:id/events
 * - GET /api/v1/tasks/:id/inspect
 * - POST /api/v1/tasks
 * - PATCH /api/v1/tasks/:id
 * - DELETE /api/v1/tasks/:id
 * - GET /api/v1/workflows
 * - GET /api/v1/workflows/:id
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */

import { newId, nowIso } from "../../../contracts/types/ids.js";
import type { RouteDefinition } from "./types.js";
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import { parseCreateTaskPayload, parseUpdateTaskPayload } from "./schemas.js";
import {
  assertTaskTenantAccess,
  buildJsonResponse,
  decodeOpaqueCursor,
  encodeOpaqueCursor,
  readCursor,
  readLimit,
  requirePrincipal,
  validateTaskId,
} from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { InspectService } from "../../../shared/observability/inspect-service.js";
import type { MissionControlService } from "../mission-control-service.js";
import type { AuthoritativeTaskStore } from "../../../state-evidence/truth/authoritative-task-store.js";
import { AppError } from "../../../contracts/errors.js";
import type { IntakeAdmissionService } from "../../orchestration/harness/runtime/intake-admission-service.js";
import type { PrincipalRef, RiskPreview, BudgetIntent, TaskInputSource } from "../../contracts/executable-contracts/index.js";
import { createPrincipalRef } from "../../contracts/executable-contracts/index.js";

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

export interface TaskRouteDeps {
  authService: ApiAuthService | null;
  inspectService: InspectService;
  missionControlService: MissionControlService;
  taskStore?: AuthoritativeTaskStore;
  intakeAdmissionService?: IntakeAdmissionService;
}

interface PaginationCursor {
  readonly updatedAt: string;
  readonly taskId: string;
}

export function createTaskRoutes(deps: TaskRouteDeps): RouteDefinition[] {
  return [
    // ── api/v1 ───────────────────────────────────────────────────────────────────
    {
      method: "GET",
      pathname: "/api/v1/tasks",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const limit = principal.tenantId != null
          ? 25
          : readLimit(ctx.request, 25);
        const tasks = deps.inspectService.queryTaskInspectSummaries({
          limit,
          ...(principal.tenantId != null ? { tenantId: principal.tenantId } : {}),
        });
        const page = paginateByCursor(tasks, limit, readCursor(ctx.request));
        return buildJsonResponse(ctx.requestId, 200, {
          tasks: page.items,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
          limit: page.limit,
        });
      },
    },
    {
      method: "GET",
      pathname: "/api/v1/workflows",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const limit = principal.tenantId != null
          ? 25
          : readLimit(ctx.request, 25);
        const workflows = deps.missionControlService.listWorkflowCockpits(
          200,
          principal.tenantId != null ? principal.tenantId : undefined,
        );
        const page = paginateByCursor(workflows, limit, readCursor(ctx.request));
        return buildJsonResponse(ctx.requestId, 200, {
          workflows: page.items,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
          limit: page.limit,
        });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (segments[0] !== "api" || segments[1] !== "v1" || segments[2] !== "tasks" || segments.length !== 4) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const taskId = validateTaskId(segments[3], "Task route");
        const cockpit = deps.missionControlService.getTaskCockpit(
          taskId,
          principal.tenantId != null ? principal.tenantId : undefined,
        );
        assertTaskTenantAccess(principal, cockpit.snapshot.task.tenantId ?? null, "api.task_not_found", "Task not found.");
        return buildJsonResponse(ctx.requestId, 200, cockpit);
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (
          segments[0] !== "api"
          || segments[1] !== "v1"
          || segments[2] !== "tasks"
          || segments.length !== 5
          || segments[4] !== "events"
        ) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const taskId = validateTaskId(segments[3], "Task events route");
        const cockpit = deps.missionControlService.getTaskCockpit(
          taskId,
          principal.tenantId != null ? principal.tenantId : undefined,
        );
        assertTaskTenantAccess(principal, cockpit.snapshot.task.tenantId ?? null, "api.task_not_found", "Task not found.");
        return buildJsonResponse(ctx.requestId, 200, { events: cockpit.snapshot.events });
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (
          segments[0] !== "api"
          || segments[1] !== "v1"
          || segments[2] !== "tasks"
          || segments.length !== 4
          || segments[3] !== "inspect"
        ) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const taskId = validateTaskId(segments[2], "Task inspect route");
        const inspect = deps.inspectService.getTaskInspectView(
          taskId,
          principal.tenantId != null ? principal.tenantId : undefined,
        );
        assertTaskTenantAccess(principal, inspect.task.tenantId ?? null, "api.task_not_found", "Task not found.");
        return buildJsonResponse(ctx.requestId, 200, inspect);
      },
    },
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (
          segments[0] !== "api"
          || segments[1] !== "v1"
          || segments[2] !== "workflows"
          || segments.length !== 3
        ) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const taskId = validateTaskId(segments[2], "Workflow route");
        const cockpit = deps.missionControlService.getWorkflowCockpit(
          taskId,
          principal.tenantId != null ? principal.tenantId : undefined,
        );
        assertTaskTenantAccess(principal, cockpit.inspect.task.tenantId ?? null, "api.workflow_not_found", "Workflow not found.");
        return buildJsonResponse(ctx.requestId, 200, cockpit);
      },
    },
    // ── Task Write Operations ─────────────────────────────────────────────────
    {
      method: "POST",
      pathname: "/api/v1/tasks",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const payload = parseCreateTaskPayload(readValidatedJsonBody(ctx.request.body, (b) => b));

        // R6-16: Validate required task spec fields before creation
        // Required fields per platform architecture: taskId, domainId, principal
        // title is required, divisionId maps to domainId for routing
        if (!payload.title || payload.title.trim().length === 0) {
          throw new ApiError(400, "api.missing_required_field", "title is required.");
        }
        if (!payload.divisionId || payload.divisionId.trim().length === 0) {
          throw new ApiError(400, "api.missing_required_field", "divisionId is required for routing.");
        }

        const taskId = newId("task");
        const now = nowIso();
        const tenantId = principal.tenantId ?? null;

        // Build principal ref from API principal
        const principalRef: PrincipalRef = createPrincipalRef({
          principalId: principal.userId ?? principal.actorId ?? "unknown",
          tenantId: tenantId ?? "global",
          roles: principal.roles,
        });

        // R6-16: Route through intake pipeline - this is REQUIRED
        // This provides proper task spec validation, risk classification, and admission control
        if (!deps.intakeAdmissionService) {
          throw new ApiError(503, "api.intake_pipeline_unavailable", "Intake pipeline is not configured. Task creation requires the intake admission service.");
        }
        const defaultRiskPreview: RiskPreview = {
          riskClass: "low",
          reasons: [],
        };
        const defaultBudgetIntent: BudgetIntent = {
          amount: 100,
          currency: "USD",
          resourceKinds: ["compute", "storage"],
        };
        const source: TaskInputSource = (payload.source as TaskInputSource) ?? "user";

        deps.intakeAdmissionService.admit({
          tenantId: tenantId ?? "global",
          principal: principalRef,
          source,
          goal: payload.title,
          inputs: payload.inputJson ? JSON.parse(payload.inputJson) : {},
          riskPreview: defaultRiskPreview,
          constraintPackRef: `constraints:${payload.divisionId}`,
          budgetIntent: defaultBudgetIntent,
          idempotencyKey: taskId,
          traceId: ctx.requestId,
        });

        // Store the task using the authoritative task store
        if (!deps.taskStore) {
          throw new ApiError(503, "api.task_store_unavailable", "Task store is not configured.");
        }
        deps.taskStore.task.insertTask({
          id: taskId,
          parentId: payload.parentId ?? null,
          rootId: taskId,
          divisionId: payload.divisionId,
          tenantId,
          title: payload.title,
          status: "queued",
          source: payload.source ?? "user",
          priority: payload.priority ?? "normal",
          inputJson: payload.inputJson ?? "{}",
          normalizedInputJson: null,
          outputJson: null,
          estimatedCostUsd: null,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });

        const cockpit = deps.missionControlService.getTaskCockpit(taskId, tenantId);
        return buildJsonResponse(ctx.requestId, 201, cockpit);
      },
    },
    // ── Task Write Operations (R5-39: fixed to use /api/v1 prefix) ────────────
    {
      method: "PATCH",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (segments[0] !== "api" || segments[1] !== "v1" || segments[2] !== "tasks" || segments.length !== 3) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const taskId = validateTaskId(segments[2], "PATCH task");
        const payload = parseUpdateTaskPayload(readValidatedJsonBody(ctx.request.body, (b) => b));

        if (!deps.taskStore) {
          throw new ApiError(503, "api.task_store_unavailable", "Task store is not configured.");
        }
        const existing = deps.taskStore.task.getTask(taskId);
        if (!existing) {
          throw new ApiError(404, "api.task_not_found", "Task not found.");
        }
        assertTaskTenantAccess(principal, existing.tenantId ?? null, "api.task_not_found", "Task not found.");

        const now = nowIso();
        if (payload.title != null) {
          deps.taskStore.task.updateTaskTitle(taskId, payload.title, now);
        }
        if (payload.inputJson != null) {
          deps.taskStore.task.updateTaskInput(taskId, payload.inputJson, existing.normalizedInputJson ?? existing.inputJson, now);
        }
        if (payload.status != null) {
          deps.taskStore.task.updateTaskStatus(taskId, payload.status, now, null, null);
        }
        if (payload.outputJson != null) {
          deps.taskStore.task.updateTaskOutput(taskId, payload.outputJson, now);
        }

        const cockpit = deps.missionControlService.getTaskCockpit(taskId, principal.tenantId ?? undefined);
        return buildJsonResponse(ctx.requestId, 200, cockpit);
      },
    },
    {
      method: "DELETE",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (segments[0] !== "api" || segments[1] !== "v1" || segments[2] !== "tasks" || segments.length !== 3) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        const taskId = validateTaskId(segments[2], "DELETE task");

        if (!deps.taskStore) {
          throw new ApiError(503, "api.task_store_unavailable", "Task store is not configured.");
        }
        const existing = deps.taskStore.task.getTask(taskId);
        if (!existing) {
          throw new ApiError(404, "api.task_not_found", "Task not found.");
        }
        assertTaskTenantAccess(principal, existing.tenantId ?? null, "api.task_not_found", "Task not found.");

        const now = nowIso();
        deps.taskStore.task.updateTaskStatus(taskId, "cancelled", now, null, now);

        return buildJsonResponse(ctx.requestId, 200, { taskId, status: "cancelled" });
      },
    },
  ];
}

function paginateByCursor<T extends { updatedAt: string; taskId: string }>(
  items: readonly T[],
  limit: number,
  cursor: string | undefined,
): {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
  readonly limit: number;
} {
  const sorted = [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.taskId.localeCompare(right.taskId));
  const decodedCursor = cursor == null ? null : decodeOpaqueCursor<PaginationCursor>(cursor);
  const startIndex = cursor == null
    ? 0
    : sorted.findIndex((item) => decodedCursor != null && (item.updatedAt < decodedCursor.updatedAt || (item.updatedAt === decodedCursor.updatedAt && item.taskId > decodedCursor.taskId)));
  const normalizedStartIndex = startIndex < 0 ? sorted.length : startIndex;
  const pageItems = sorted.slice(normalizedStartIndex, normalizedStartIndex + limit);
  const hasMore = normalizedStartIndex + limit < sorted.length;
  const nextCursor = hasMore && pageItems.length > 0
    ? encodeOpaqueCursor({
        updatedAt: pageItems.at(-1)?.updatedAt ?? null,
        taskId: pageItems.at(-1)?.taskId ?? null,
      })
    : null;

  return {
    items: pageItems,
    nextCursor,
    hasMore,
    limit,
  };
}
