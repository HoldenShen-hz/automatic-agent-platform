/**
 * @fileoverview Replay Sessions Routes - CRUD endpoints for replay sessions.
 *
 * Routes:
 * - GET /api/v1/replay-sessions - List replay sessions
 * - GET /api/v1/replay-sessions/:id - Get single replay session
 * - POST /api/v1/replay-sessions - Create replay session
 * - DELETE /api/v1/replay-sessions/:id - Delete replay session
 *
 * Part of §6 API Endpoints - Missing endpoints implementation
 */

import { z } from "zod";
import { newId, nowIso } from "../../../contracts/types/ids.js";
import type { RouteDefinition } from "./types.js";
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import { buildJsonResponse, readLimit, requirePrincipal, validateTaskId } from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";
import { AppError } from "../../../contracts/errors.js";

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

export interface ReplaySession {
  id: string;
  taskId: string | null;
  workflowId: string | null;
  title: string;
  status: string;
  inputJson: string;
  outputJson: string | null;
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ReplaySessionRouteDeps {
  authService: ApiAuthService | null;
}

// In-memory storage for replay sessions
const replaySessionsStore = new Map<string, ReplaySession>();

const createReplaySessionSchema = z.object({
  taskId: z.string().trim().min(1).optional(),
  workflowId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  status: z.string().trim().min(1).default("created"),
  inputJson: z.string().default("{}"),
  tenantId: z.string().trim().min(1).optional(),
}).strict();

function matchesReplaySessionRoute(segments: string[], expectedTailLength: number): boolean {
  return (
    segments[0] === "v1"
    && segments[1] === "replay-sessions"
    && segments.length === expectedTailLength + 1
  );
}

export function createReplaySessionRoutes(deps: ReplaySessionRouteDeps): RouteDefinition[] {
  return [
    // GET /api/v1/replay-sessions - List replay sessions
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (!matchesReplaySessionRoute(segments, 1)) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const limit = readLimit(ctx.request, 50);
        const sessions = Array.from(replaySessionsStore.values()).slice(0, limit);
        return buildJsonResponse(ctx.requestId, 200, {
          replaySessions: sessions.map((session) => ({
            replaySessionId: session.id,
            taskId: session.taskId,
            workflowId: session.workflowId,
            title: session.title,
            status: session.status,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
          })),
          total: replaySessionsStore.size,
          limit,
        });
      },
    },
    // GET /api/v1/replay-sessions/:id - Get single replay session
    {
      method: "GET",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (!matchesReplaySessionRoute(segments, 2)) {
          return null;
        }
        if ((segments[2] ?? "").length === 0) {
          return null;
        }
        requirePrincipal(ctx.request, deps.authService, "viewer");
        const replaySessionId = validateTaskId(segments[2], "Replay sessions route");
        const session = replaySessionsStore.get(replaySessionId);
        if (!session) {
          throw new ApiError(404, "api.replay_session_not_found", "Replay session not found.");
        }
        return buildJsonResponse(ctx.requestId, 200, {
          replaySessionId: session.id,
          taskId: session.taskId,
          workflowId: session.workflowId,
          title: session.title,
          status: session.status,
          inputJson: session.inputJson,
          outputJson: session.outputJson,
          tenantId: session.tenantId,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          completedAt: session.completedAt,
        });
      },
    },
    // POST /api/v1/replay-sessions - Create replay session
    {
      method: "POST",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (!matchesReplaySessionRoute(segments, 1)) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const body = readValidatedJsonBody(ctx.request.body, (b) => b);
        const payload = createReplaySessionSchema.parse(body);

        const sessionId = newId("replay");
        const now = nowIso();
        const tenantId = payload.tenantId ?? principal.tenantId ?? null;

        const session: ReplaySession = {
          id: sessionId,
          taskId: payload.taskId ?? null,
          workflowId: payload.workflowId ?? null,
          title: payload.title,
          status: payload.status,
          inputJson: payload.inputJson,
          outputJson: null,
          tenantId,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        };

        replaySessionsStore.set(sessionId, session);

        return buildJsonResponse(ctx.requestId, 201, {
          replaySessionId: sessionId,
          taskId: session.taskId,
          workflowId: session.workflowId,
          title: session.title,
          status: session.status,
          tenantId: session.tenantId,
          createdAt: session.createdAt,
        });
      },
    },
    // DELETE /api/v1/replay-sessions/:id - Delete replay session
    {
      method: "DELETE",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (!matchesReplaySessionRoute(segments, 2)) {
          return null;
        }
        if ((segments[2] ?? "").length === 0) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "admin");
        const replaySessionId = validateTaskId(segments[2], "DELETE replay session");
        const session = replaySessionsStore.get(replaySessionId);
        if (!session) {
          throw new ApiError(404, "api.replay_session_not_found", "Replay session not found.");
        }
        replaySessionsStore.delete(replaySessionId);
        return buildJsonResponse(ctx.requestId, 200, { replaySessionId, status: "deleted" });
      },
    },
  ];
}