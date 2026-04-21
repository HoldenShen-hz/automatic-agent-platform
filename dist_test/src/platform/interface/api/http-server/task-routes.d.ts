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
import type { RouteDefinition } from "./types.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { InspectService } from "../../../shared/observability/inspect-service.js";
import type { MissionControlService } from "../mission-control-service.js";
import type { AuthoritativeTaskStore } from "../../../state-evidence/truth/authoritative-task-store.js";
export interface TaskRouteDeps {
    authService: ApiAuthService | null;
    inspectService: InspectService;
    missionControlService: MissionControlService;
    taskStore?: AuthoritativeTaskStore;
}
export declare function createTaskRoutes(deps: TaskRouteDeps): RouteDefinition[];
