/**
 * @fileoverview Task Routes - Task and workflow listing, retrieval, creation, update and deletion endpoints.
 *
 * Routes:
 * - GET /tasks
 * - GET /tasks/:id
 * - POST /tasks
 * - PATCH /tasks/:id
 * - DELETE /tasks/:id
 * - GET /tasks/:id/events
 * - GET /tasks/:id/inspect
 * - GET /workflows
 * - GET /workflows/:id
 * - GET /v1/tasks
 * - GET /v1/tasks/:id
 * - POST /v1/tasks
 * - PATCH /v1/tasks/:id
 * - DELETE /v1/tasks/:id
 * - GET /v1/tasks/:id/events
 * - GET /v1/tasks/:id/inspect
 * - GET /v1/workflows
 * - GET /v1/workflows/:id
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */
import { newId, nowIso } from "../../../contracts/types/ids.js";
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import { parseCreateTaskPayload, parseUpdateTaskPayload } from "./schemas.js";
import { buildJsonResponse, requirePrincipal, assertTaskTenantAccess, validateTaskId, readLimit } from "./utils.js";
import { AppError } from "../../../contracts/errors.js";
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
export function createTaskRoutes(deps) {
    return [
        // ── Non-v1 (backward-compatible) ──────────────────────────────────────────
        {
            method: "GET",
            pathname: "/tasks",
            handler: (ctx) => {
                const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
                const limit = principal.tenantId != null
                    ? 25
                    : readLimit(ctx.request, 25);
                const tasks = deps.inspectService.queryTaskInspectSummaries({
                    limit,
                    ...(principal.tenantId != null ? { tenantId: principal.tenantId } : {}),
                });
                return buildJsonResponse(ctx.requestId, 200, { tasks });
            },
        },
        {
            method: "GET",
            pathname: "/workflows",
            handler: (ctx) => {
                const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
                const limit = principal.tenantId != null
                    ? 25
                    : readLimit(ctx.request, 25);
                return buildJsonResponse(ctx.requestId, 200, {
                    workflows: deps.missionControlService.listWorkflowCockpits(limit, principal.tenantId != null ? principal.tenantId : undefined),
                });
            },
        },
        {
            method: "GET",
            pathname: null,
            segments: true,
            handler: (ctx) => {
                const { segments } = ctx.route;
                if (segments[0] !== "tasks" || segments.length !== 2) {
                    return null;
                }
                const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
                const taskId = validateTaskId(segments[1], "Task route");
                const cockpit = deps.missionControlService.getTaskCockpit(taskId, principal.tenantId != null ? principal.tenantId : undefined);
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
                if (segments[0] !== "tasks" || segments.length !== 3 || segments[2] !== "events") {
                    return null;
                }
                const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
                const taskId = validateTaskId(segments[1], "Task events route");
                const cockpit = deps.missionControlService.getTaskCockpit(taskId, principal.tenantId != null ? principal.tenantId : undefined);
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
                if (segments[0] !== "tasks" || segments.length !== 3 || segments[2] !== "inspect") {
                    return null;
                }
                const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
                const taskId = validateTaskId(segments[1], "Task inspect route");
                const inspect = deps.inspectService.getTaskInspectView(taskId, principal.tenantId != null ? principal.tenantId : undefined);
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
                if (segments[0] !== "workflows" || segments.length !== 2) {
                    return null;
                }
                const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
                const taskId = validateTaskId(segments[1], "Workflow route");
                const cockpit = deps.missionControlService.getWorkflowCockpit(taskId, principal.tenantId != null ? principal.tenantId : undefined);
                assertTaskTenantAccess(principal, cockpit.inspect.task.tenantId ?? null, "api.workflow_not_found", "Workflow not found.");
                return buildJsonResponse(ctx.requestId, 200, cockpit);
            },
        },
        // ── v1 ───────────────────────────────────────────────────────────────────
        {
            method: "GET",
            pathname: "/v1/tasks",
            handler: (ctx) => {
                const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
                const limit = principal.tenantId != null
                    ? 25
                    : readLimit(ctx.request, 25);
                const tasks = deps.inspectService.queryTaskInspectSummaries({
                    limit,
                    ...(principal.tenantId != null ? { tenantId: principal.tenantId } : {}),
                });
                return buildJsonResponse(ctx.requestId, 200, { tasks });
            },
        },
        {
            method: "GET",
            pathname: "/v1/workflows",
            handler: (ctx) => {
                const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
                const limit = principal.tenantId != null
                    ? 25
                    : readLimit(ctx.request, 25);
                return buildJsonResponse(ctx.requestId, 200, {
                    workflows: deps.missionControlService.listWorkflowCockpits(limit, principal.tenantId != null ? principal.tenantId : undefined),
                });
            },
        },
        {
            method: "GET",
            pathname: null,
            segments: true,
            handler: (ctx) => {
                const { segments } = ctx.route;
                if (segments[0] !== "v1" || segments[1] !== "tasks" || segments.length !== 3) {
                    return null;
                }
                const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
                const taskId = validateTaskId(segments[2], "Task route");
                const cockpit = deps.missionControlService.getTaskCockpit(taskId, principal.tenantId != null ? principal.tenantId : undefined);
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
                if (segments[0] !== "v1"
                    || segments[1] !== "tasks"
                    || segments.length !== 4
                    || segments[3] !== "events") {
                    return null;
                }
                const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
                const taskId = validateTaskId(segments[2], "Task events route");
                const cockpit = deps.missionControlService.getTaskCockpit(taskId, principal.tenantId != null ? principal.tenantId : undefined);
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
                if (segments[0] !== "v1"
                    || segments[1] !== "tasks"
                    || segments.length !== 4
                    || segments[3] !== "inspect") {
                    return null;
                }
                const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
                const taskId = validateTaskId(segments[2], "Task inspect route");
                const inspect = deps.inspectService.getTaskInspectView(taskId, principal.tenantId != null ? principal.tenantId : undefined);
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
                if (segments[0] !== "v1" || segments[1] !== "workflows" || segments.length !== 3) {
                    return null;
                }
                const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
                const taskId = validateTaskId(segments[2], "Workflow route");
                const cockpit = deps.missionControlService.getWorkflowCockpit(taskId, principal.tenantId != null ? principal.tenantId : undefined);
                assertTaskTenantAccess(principal, cockpit.inspect.task.tenantId ?? null, "api.workflow_not_found", "Workflow not found.");
                return buildJsonResponse(ctx.requestId, 200, cockpit);
            },
        },
        // ── Task Write Operations ─────────────────────────────────────────────────
        {
            method: "POST",
            pathname: "/tasks",
            handler: (ctx) => {
                const principal = requirePrincipal(ctx.request, deps.authService, "operator");
                const payload = parseCreateTaskPayload(readValidatedJsonBody(ctx.request.body, (b) => b));
                const taskId = newId("task");
                const now = nowIso();
                const tenantId = principal.tenantId ?? null;
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
            method: "POST",
            pathname: "/v1/tasks",
            handler: (ctx) => {
                const principal = requirePrincipal(ctx.request, deps.authService, "operator");
                const payload = parseCreateTaskPayload(readValidatedJsonBody(ctx.request.body, (b) => b));
                const taskId = newId("task");
                const now = nowIso();
                const tenantId = principal.tenantId ?? null;
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
                if (segments[0] !== "tasks" || segments.length !== 2) {
                    return null;
                }
                const principal = requirePrincipal(ctx.request, deps.authService, "operator");
                const taskId = validateTaskId(segments[1], "PATCH task");
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
                    deps.taskStore.task.updateTaskInput(taskId, existing.inputJson, existing.normalizedInputJson ?? existing.inputJson, now);
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
                    deps.taskStore.task.updateTaskInput(taskId, existing.inputJson, existing.normalizedInputJson ?? existing.inputJson, now);
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
                if (segments[0] !== "tasks" || segments.length !== 2) {
                    return null;
                }
                const principal = requirePrincipal(ctx.request, deps.authService, "admin");
                const taskId = validateTaskId(segments[1], "DELETE task");
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
//# sourceMappingURL=task-routes.js.map