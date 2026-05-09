/**
 * @fileoverview Task Routes - Task and workflow listing, retrieval, creation, update and deletion endpoints.
 *
 * Routes:
 * - GET /v1/tasks
 * - GET /v1/tasks/:id
 * - GET /v1/tasks/:id/events
 * - GET /v1/tasks/:id/inspect
 * - POST /v1/tasks
 * - PATCH /v1/tasks/:id
 * - DELETE /v1/tasks/:id
 * - GET /v1/workflows
 * - GET /v1/workflows/:id
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
import type { IntakeAdmissionService } from "../../../five-plane-orchestration/harness/runtime/intake-admission-service.js";
import { AppError } from "../../../contracts/errors.js";
import type { TaskInputSource } from "../../../contracts/executable-contracts/index.js";

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
  // R6-16 FIX: IntakeAdmissionService for §5.3 intake pipeline routing
  intakeAdmissionService?: IntakeAdmissionService;
}

interface PaginationCursor {
  readonly updatedAt: string;
  readonly taskId: string;
}

export function createTaskRoutes(deps: TaskRouteDeps): RouteDefinition[] {
  // R29-37: Internal default limit - extracted to constant for maintainability
  const DEFAULT_TASK_LIMIT = 25;
  const INTERNAL_TASK_LIMIT = 200;

  return [
    // ── api/v1/tasks (§6 canonical API prefix) ────────────────────────────────
    {
      method: "GET",
      pathname: "/api/v1/tasks",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        // R29-37: For internal/tenant users, use higher limit within bounds
        const limit = principal.tenantId != null
          ? Math.min(INTERNAL_TASK_LIMIT, readLimit(ctx.request, DEFAULT_TASK_LIMIT))
          : readLimit(ctx.request, DEFAULT_TASK_LIMIT);
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
          limit,
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
          || segments.length !== 5
          || segments[4] !== "inspect"
        ) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const taskId = validateTaskId(segments[3], "Task inspect route");
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
        if (segments[0] !== "api" || segments[1] !== "v1" || segments[2] !== "workflows" || segments.length !== 4) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const taskId = validateTaskId(segments[3], "Workflow route");
        const cockpit = deps.missionControlService.getWorkflowCockpit(
          taskId,
          principal.tenantId != null ? principal.tenantId : undefined,
        );
        assertTaskTenantAccess(principal, cockpit.inspect.task.tenantId ?? null, "api.workflow_not_found", "Workflow not found.");
        return buildJsonResponse(ctx.requestId, 200, cockpit);
      },
    },
    // ── Task Write Operations ─────────────────────────────────────────────────
    /**
     * POST /v1/tasks - Create a new task.
     *
     * R6-16 FIX: When intakeAdmissionService is available, routes through §5.3 intake
     * pipeline for proper admission, risk evaluation, and policy checks. The intake
     * pipeline creates the full TaskDraft -> ConfirmedTaskSpec -> RequestEnvelope -> HarnessRun chain.
     *
     * When intakeAdmissionService is not configured (legacy fallback), creates a lightweight
     * Task entity directly in the task store for simple task creation use cases where:
     * - Full harness execution is not required
     * - The task will be executed via external means
     * - Quick task creation is needed without the overhead of admission checks
     */
    {
      method: "POST",
      pathname: "/v1/tasks",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const payload = parseCreateTaskPayload(readValidatedJsonBody(ctx.request.body, (b) => b));
        const tenantId = principal.tenantId ?? null;

        // R6-16 FIX: Route through intake pipeline when available per §5.3
        if (deps.intakeAdmissionService) {
          // Use canonical intake pipeline for proper task admission
          const result = deps.intakeAdmissionService.admit({
            tenantId: tenantId ?? "",
            principal: { principalId: principal.actorId, tenantId: tenantId ?? "", roles: principal.roles ?? [], authorizationLevel: principal.roles?.includes("admin") ? "admin" : principal.roles?.includes("operator") ? "operator" : "viewer" },
            source: (payload.source ?? "ui") as TaskInputSource,
            domainId: payload.divisionId ?? "",
            goal: payload.title,
            inputs: payload.inputJson ?? "{}",
            riskPreview: { riskClass: "low" as const, reasons: [] },
            constraintPackRef: "",
            budgetIntent: { amount: 0, currency: "USD", resourceKinds: [] },
            idempotencyKey: `task:${newId("idempotency")}`,
            traceId: ctx.requestId,
          });

          const taskId = result.harnessRun.confirmedTaskSpecId;
          const cockpit = deps.missionControlService.getTaskCockpit(taskId, tenantId);
          return buildJsonResponse(ctx.requestId, 201, cockpit);
        }

        // Legacy fallback: direct task store insertion without intake pipeline
        const taskId = newId("task");
        const now = nowIso();

        if (!deps.taskStore) {
          throw new ApiError(503, "api.task_store_unavailable", "Task store is not configured.");
        }
        deps.taskStore.task.insertTask({
          id: taskId,
          parentId: payload.parentId ?? null,
          rootId: taskId,
          divisionId: payload.divisionId ?? null,
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
    {
      method: "PATCH",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (segments[0] !== "v1" || segments[1] !== "tasks" || segments.length !== 3) {
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
        if (segments[0] !== "v1" || segments[1] !== "tasks" || segments.length !== 3) {
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
