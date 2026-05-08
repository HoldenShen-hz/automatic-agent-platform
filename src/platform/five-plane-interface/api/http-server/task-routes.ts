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
import type { RouteDefinition, ApiRequestLike } from "./types.js";
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
import type { TaskStatus } from "../../../contracts/types/status.js";
import type { IntakeAdmissionService } from "../../../orchestration/harness/runtime/intake-admission-service.js";
import type { PrincipalRef, RiskPreview, BudgetIntent, TaskInputSource, JsonValue } from "../../../contracts/executable-contracts/index.js";
import { createPrincipalRef } from "../../../contracts/executable-contracts/index.js";
import { RuntimeEntryGuard } from "../../../five-plane-orchestration/harness/runtime/runtime-entry-guard.js";
import { minimalWorkflowToPlanGraphBundle } from "../../../five-plane-orchestration/oapeflir/runtime-execute-bridge.js";
import { execute as executeQuery } from "../../../state-evidence/truth/sqlite/query-helper.js";
import {
  WorkflowBuilderService,
  type CreateWorkflowRequest,
  type UpdateWorkflowRequest,
  type ValidateWorkflowRequest,
  type PublishWorkflowRequest,
} from "../../../../interaction/ux/workflow-builder-service.js";
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

/**
 * Idempotency-Key header extractor for task routes.
 * §6.2 requires Idempotency-Key for all write operations.
 */
function extractIdempotencyKeyFromRequest(req: ApiRequestLike): string | undefined {
  const getHeader = (name: string): string | undefined => {
    const value = req.headers[name];
    if (Array.isArray(value)) return value[0];
    return value;
  };
  return getHeader("Idempotency-Key") ?? getHeader("idempotency-key");
}

export interface TaskRouteDeps {
  authService: ApiAuthService | null;
  inspectService: InspectService;
  missionControlService: MissionControlService;
  taskStore?: AuthoritativeTaskStore;
  intakeAdmissionService?: IntakeAdmissionService;
  workflowBuilderService?: WorkflowBuilderService;
}

interface PaginationCursor {
  readonly updatedAt: string;
  readonly taskId: string;
}

const workflowNodeSchema = z.object({
  nodeId: z.string().min(1),
  label: z.string().min(1),
  componentId: z.string().min(1).optional(),
}).strict();

const workflowEdgeSchema = z.object({
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
}).strict();

const createWorkflowRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
  divisionId: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(),
}).strict();

const updateWorkflowRequestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  nodes: z.array(workflowNodeSchema).optional(),
  edges: z.array(workflowEdgeSchema).optional(),
}).strict();

const validateWorkflowRequestSchema = z.object({
  nodes: z.array(workflowNodeSchema.pick({ nodeId: true, label: true })),
  edges: z.array(workflowEdgeSchema),
}).strict();

const publishWorkflowRequestSchema = z.object({
  version: z.string().min(1).optional(),
}).strict();

export function createTaskRoutes(deps: TaskRouteDeps): RouteDefinition[] {
  const workflowBuilderService = deps.workflowBuilderService ?? new WorkflowBuilderService();
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
      pathname: "/api/v1/workflows/builder",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const limit = readLimit(ctx.request, 25);
        return buildJsonResponse(ctx.requestId, 200, {
          workflows: workflowBuilderService.listWorkflows(limit),
          limit,
        });
      },
    },
    {
      method: "POST",
      pathname: "/api/v1/workflows/builder",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "operator");
        const payload = readValidatedJsonBody(ctx.request.body, createWorkflowRequestSchema.parse);
        let workflow;
        try {
          workflow = workflowBuilderService.createWorkflow(payload as CreateWorkflowRequest);
        } catch (error) {
          if (error instanceof Error && error.message.startsWith("workflow_builder.invalid_graph:")) {
            throw new ApiError(400, "api.workflow_builder_invalid_graph", error.message);
          }
          throw error;
        }
        return buildJsonResponse(ctx.requestId, 201, { workflow });
      },
    },
    {
      method: "POST",
      pathname: "/api/v1/workflows/builder/validate",
      handler: (ctx) => {
        requirePrincipal(ctx.request, deps.authService, "operator");
        const payload = readValidatedJsonBody(ctx.request.body, validateWorkflowRequestSchema.parse);
        const validation = workflowBuilderService.validateWorkflow(payload as ValidateWorkflowRequest);
        return buildJsonResponse(ctx.requestId, 200, { validation });
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
          || segments[3] !== "builder"
          || segments.length !== 5
        ) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const workflow = workflowBuilderService.getWorkflow(segments[4] ?? "");
        if (workflow == null) {
          throw new ApiError(404, "api.workflow_builder_not_found", "Workflow builder definition not found.");
        }
        return buildJsonResponse(ctx.requestId, 200, { workflow });
      },
    },
    {
      method: "PUT",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (
          segments[0] !== "api"
          || segments[1] !== "v1"
          || segments[2] !== "workflows"
          || segments[3] !== "builder"
          || segments.length !== 5
        ) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "operator");
        const payload = readValidatedJsonBody(ctx.request.body, updateWorkflowRequestSchema.parse);
        let workflow;
        try {
          workflow = workflowBuilderService.updateWorkflow({
            workflowId: segments[4] ?? "",
            ...(payload as Omit<UpdateWorkflowRequest, "workflowId">),
          });
        } catch (error) {
          if (error instanceof Error && error.message.startsWith("workflow_builder.invalid_graph:")) {
            throw new ApiError(400, "api.workflow_builder_invalid_graph", error.message);
          }
          throw error;
        }
        if (workflow == null) {
          throw new ApiError(404, "api.workflow_builder_not_found", "Workflow builder definition not found.");
        }
        return buildJsonResponse(ctx.requestId, 200, { workflow });
      },
    },
    {
      method: "DELETE",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (
          segments[0] !== "api"
          || segments[1] !== "v1"
          || segments[2] !== "workflows"
          || segments[3] !== "builder"
          || segments.length !== 5
        ) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "operator");
        const removed = workflowBuilderService.deleteWorkflow(segments[4] ?? "");
        if (!removed) {
          throw new ApiError(404, "api.workflow_builder_not_found", "Workflow builder definition not found.");
        }
        return buildJsonResponse(ctx.requestId, 200, { removed: true, workflowId: segments[4] ?? "" });
      },
    },
    {
      method: "POST",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (
          segments[0] !== "api"
          || segments[1] !== "v1"
          || segments[2] !== "workflows"
          || segments[3] !== "builder"
          || segments.length !== 6
          || segments[5] !== "publish"
        ) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "operator");
        const payload = readValidatedJsonBody(ctx.request.body, publishWorkflowRequestSchema.parse);
        const workflow = workflowBuilderService.publishWorkflow({
          workflowId: segments[4] ?? "",
          ...(payload as Omit<PublishWorkflowRequest, "workflowId">),
        });
        if (workflow == null) {
          throw new ApiError(404, "api.workflow_builder_not_found", "Workflow builder definition not found.");
        }
        return buildJsonResponse(ctx.requestId, 200, { workflow });
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
        if (
          segments[0] !== "api"
          || segments[1] !== "v1"
          || segments[2] !== "workflows"
          || segments.length !== 4
        ) {
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
    {
      method: "POST",
      pathname: "/api/v1/tasks",
      handler: async (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const payload = parseCreateTaskPayload(readValidatedJsonBody(ctx.request.body, (b) => b));

        // R6-16: Validate required task spec fields before creation
        // Required fields per platform architecture: taskId, domainId, principal
        // title is required, divisionId maps to domainId for routing
        if (!payload.title || payload.title.trim().length === 0) {
          throw new ApiError(400, "api.missing_required_field", "title is required.");
        }
        const correlationId = ctx.requestId;
        // R7-13: Extract Idempotency-Key from request headers for safe retries
        const requestIdempotencyKey = extractIdempotencyKeyFromRequest(ctx.request);
        const now = nowIso();
        const tenantId = principal.tenantId ?? null;
        const missionControlTenantId = tenantId ?? undefined;
        const divisionId = payload.divisionId?.trim().length
          ? payload.divisionId.trim()
          : "general";
        const source: TaskInputSource = payload.source === "perception"
          ? "external_event"
          : payload.source === "system"
            ? "scheduler"
            : "ui";

        // R7-13: Use request Idempotency-Key if provided, otherwise generate one
        // This enables safe retries of mutating operations per §6.2
        const idempotencyKey = requestIdempotencyKey
          ?? `${principal.actorId ?? "unknown"}:${payload.title}:${divisionId}:${now.split("T")[0]}`;

        const principalRef: PrincipalRef = createPrincipalRef({
          principalId: principal.actorId ?? "unknown",
          tenantId: tenantId ?? "global",
          roles: principal.roles,
          authorizationLevel: principal.roles.includes("admin")
            ? "admin"
            : principal.roles.includes("operator")
              ? "operator"
              : "viewer",
        });

        const defaultRiskPreview: RiskPreview = {
          riskClass: "low",
          reasons: [],
        };
        const defaultBudgetIntent: BudgetIntent = {
          amount: 100,
          currency: "USD",
          resourceKinds: ["compute", "tool"],
        };

        let parsedInputs: Record<string, unknown> = {};
        if (payload.inputJson) {
          try {
            parsedInputs = JSON.parse(payload.inputJson) as Record<string, unknown>;
          } catch {
            throw new ApiError(400, "api.invalid_input_json", "inputJson must be valid JSON.");
          }
        }

        // R4-26 (INV-GRAPH-001): Create PlanGraphBundle as P3→P4 contract
        // All execution paths must use PlanGraphBundle as the authoritative entry point
        const minimalWorkflow = {
          workflowId: newId("workflow"),
          divisionId,
          steps: [{
            nodeId: "step-1",
            stepId: "step-1",
            roleId: "general_executor",
            outputKey: "result",
            timeoutMs: 300000,
            maxAttempts: 3,
          }] as const,
        };
        const harnessRunId = newId("harness_run");
        const planGraphBundle = minimalWorkflowToPlanGraphBundle(minimalWorkflow, harnessRunId);
        const entryGuard = new RuntimeEntryGuard();
        const guardResult = entryGuard.assertPlanGraphBundleOnly(planGraphBundle);
        // R4-26 (INV-GRAPH-001): Extract validated PlanGraphBundle from guard result
        const validatedPlanGraphBundle = guardResult.planGraphBundle;
        // R4-26 (INV-GRAPH-001): Derive taskId from PlanGraphBundle instead of independent newId("task")
        const taskId = validatedPlanGraphBundle.planGraphBundleId;

        const admissionResult = deps.intakeAdmissionService
          ? deps.intakeAdmissionService.admit({
            tenantId: tenantId ?? "global",
            principal: principalRef,
            source,
            domainId: divisionId,
            goal: payload.title,
            inputs: parsedInputs as unknown as JsonValue,
            riskPreview: defaultRiskPreview,
            constraintPackRef: `constraints:${divisionId}`,
            budgetIntent: defaultBudgetIntent,
            idempotencyKey,
            traceId: correlationId,
          })
          : { events: [] };

        if (!deps.taskStore) {
          throw new ApiError(503, "api.task_store_unavailable", "Task store is not configured.");
        }
        const taskStore = deps.taskStore;
        const newTask = {
          id: taskId,
          parentId: payload.parentId ?? null,
          rootId: taskId,
          divisionId,
          tenantId,
          title: payload.title,
          status: "queued" as TaskStatus,
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
        };

        const persistTask = () => {
          // R4-26 (INV-GRAPH-001): Insert plan_graph_bundles record alongside task creation
          // This establishes the P3→P4 contract as the authoritative execution entry point
          if ("db" in taskStore && taskStore.db && typeof taskStore.db.transaction === "function") {
            // Insert plan_graph_bundle first within the same transaction
            executeQuery(
              taskStore.db.connection,
              `INSERT INTO plan_graph_bundles (
                plan_graph_bundle_id, harness_run_id, graph_version, graph_json, validation_report_json, created_at
              ) VALUES (?, ?, ?, ?, ?, ?)`,
              validatedPlanGraphBundle.planGraphBundleId,
              harnessRunId,
              validatedPlanGraphBundle.graphVersion,
              JSON.stringify(validatedPlanGraphBundle.graph),
              JSON.stringify(validatedPlanGraphBundle.validationReport),
              validatedPlanGraphBundle.createdAt,
            );
          }
          taskStore.task.insertTask({
            ...newTask,
          });
          if ("event" in taskStore && taskStore.event && typeof taskStore.event.insertEvent === "function") {
            for (const event of admissionResult.events) {
              taskStore.event.insertEvent({
                id: event.eventId,
                taskId,
                executionId: null,
                eventType: event.eventType,
                eventTier: "tier_1",
                payloadJson: JSON.stringify(event),
                traceId: event.traceId,
                createdAt: event.occurredAt,
              });
            }
          }
        };
        if ("db" in taskStore && taskStore.db && typeof taskStore.db.transaction === "function") {
          taskStore.db.transaction(() => {
            persistTask();
          });
        } else {
          persistTask();
        }

        const cockpit = deps.missionControlService.getTaskCockpit(taskId, missionControlTenantId);
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
        if (segments[0] !== "api" || segments[1] !== "v1" || segments[2] !== "tasks" || segments.length !== 4) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const taskId = validateTaskId(segments[3], "PATCH task");
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
          // R29-27: When updating task title, merge with existing inputJson before calling updateTaskInput
          let mergedInputJson = existing.inputJson;
          if (payload.inputJson != null) {
            try {
              const existingInput = JSON.parse(existing.inputJson || "{}");
              const newInput = JSON.parse(payload.inputJson);
              mergedInputJson = JSON.stringify({ ...existingInput, ...newInput });
            } catch {
              throw new ApiError(400, "api.invalid_input_json", "inputJson must be valid JSON.");
            }
          }
          // R29-27: Also update inputJson title field to keep it in sync
          let titleSyncInputJson = mergedInputJson;
          try {
            const parsed = JSON.parse(mergedInputJson || "{}");
            parsed.title = payload.title;
            titleSyncInputJson = JSON.stringify(parsed);
          } catch {
            // If merging fails, use the original merged input
          }
          deps.taskStore.task.updateTaskTitle(taskId, payload.title, now);
          deps.taskStore.task.updateTaskInput(
            taskId,
            titleSyncInputJson,
            titleSyncInputJson,
            now,
          );
        }
        if (payload.status != null) {
          deps.taskStore.task.updateTaskStatus(taskId, payload.status, now, null, null);
        }
        if (payload.outputJson != null) {
          deps.taskStore.task.updateTaskOutput(taskId, existing.status, payload.outputJson, now);
        }
        // R14-13: inputJson partial update — must parse and persist like CREATE does
        // R29-27: Only process inputJson here if title was not also being updated (title path handles merging above)
        if (payload.inputJson != null && payload.title == null) {
          try {
            const existingInput = JSON.parse(existing.inputJson || "{}");
            const newInput = JSON.parse(payload.inputJson);
            const mergedInput = { ...existingInput, ...newInput };
            deps.taskStore.task.updateTaskInput(
              taskId,
              JSON.stringify(mergedInput),
              JSON.stringify(mergedInput),
              now,
            );
          } catch {
            throw new ApiError(400, "api.invalid_input_json", "inputJson must be valid JSON.");
          }
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
        if (segments[0] !== "api" || segments[1] !== "v1" || segments[2] !== "tasks" || segments.length !== 4) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        const taskId = validateTaskId(segments[3], "DELETE task");

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
