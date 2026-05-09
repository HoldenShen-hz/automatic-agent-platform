/**
 * @fileoverview Approval Routes - Approval listing and decision endpoints.
 *
 * Routes:
 * - GET /approvals
 * - POST /approvals/:id/decision
 * - GET /v1/approvals
 * - POST /v1/approvals/:id/decision
 *
 * Part of http-api-server.ts split (see src/core/api/http-server/).
 */

import type { RouteDefinition } from "./types.js";
import { readValidatedJsonBody } from "../middleware/input-validation.js";
import { parseApprovalDecisionPayload } from "./schemas.js";
import { buildJsonResponse, requirePrincipal, readLimit, readStatusFilter } from "./utils.js";
import type { ApiAuthService } from "../api-auth-service.js";
import type { ApprovalService } from "../../../control-plane/approval-center/approval-service.js";
import type { InspectService } from "../../../shared/observability/inspect-service.js";
import { AppError } from "../../../contracts/errors.js";
import type { ApiPrincipal } from "../api-auth-service.js";

class ApiError extends AppError {
  public constructor(statusCode: number, code: string, message: string) {
    super(code, message, {
      statusCode,
      category: statusCode >= 500 ? "internal" : statusCode >= 400 ? "validation" : "external",
      source: "policy",
      retryable: statusCode >= 500 || statusCode === 429,
    });
    this.name = "ApiError";
  }
}

export interface ApprovalRouteDeps {
  authService: ApiAuthService | null;
  approvalService: ApprovalService;
  inspectService: InspectService;
}

const MAX_APPROVAL_ID_LENGTH = 128;
const APPROVAL_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function validateApprovalId(approvalId: string | undefined): string {
  if (!approvalId || typeof approvalId !== "string") {
    throw new ApiError(404, "api.approval_not_found", "Approval route requires approvalId.");
  }
  if (approvalId.length > MAX_APPROVAL_ID_LENGTH) {
    throw new ApiError(400, "api.invalid_approval_id", `approvalId exceeds maximum length of ${MAX_APPROVAL_ID_LENGTH}.`);
  }
  if (!APPROVAL_ID_PATTERN.test(approvalId)) {
    throw new ApiError(400, "api.invalid_approval_id", "Invalid approvalId format.");
  }
  return approvalId;
}

function parseAllowedActorIds(approvalView: unknown): readonly string[] {
  const requestJson = (approvalView as { approval?: { requestJson?: unknown } })?.approval?.requestJson;
  if (typeof requestJson !== "string" || requestJson.trim().length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(requestJson) as { context?: { allowedActorIds?: unknown } };
    return Array.isArray(parsed.context?.allowedActorIds)
      ? parsed.context.allowedActorIds.filter((value): value is string => typeof value === "string" && value.length > 0)
      : [];
  } catch {
    return [];
  }
}

function assertApprovalAccess(
  principal: ApiPrincipal,
  actorId: string,
  approvalView: unknown,
): void {
  if (principal.roles.includes("admin")) {
    return;
  }

  const resourceTenantId = (approvalView as { task?: { tenantId?: string | null } })?.task?.tenantId ?? null;
  if (principal.tenantId != null && resourceTenantId !== null && principal.tenantId !== resourceTenantId) {
    throw new ApiError(403, "api.approval_forbidden", "Actor not authorized for this approval.");
  }

  const allowedActorIds = parseAllowedActorIds(approvalView);
  if (allowedActorIds.length > 0 && !allowedActorIds.includes(actorId)) {
    throw new ApiError(403, "api.approval_forbidden", "Actor not authorized for this approval.");
  }
}

function getAuthorizedApprovalView(
  deps: ApprovalRouteDeps,
  principal: ApiPrincipal,
  actorId: string,
  approvalId: string,
): unknown {
  try {
    const approvalView = deps.inspectService.getApprovalInspectView(approvalId);
    assertApprovalAccess(principal, actorId, approvalView);
    return approvalView;
  } catch (error) {
    if ((error as { code?: string })?.code === "inspect.approval_not_found") {
      throw new ApiError(404, "api.approval_not_found", `Approval not found: ${approvalId}`);
    }
    throw error;
  }
}

export function createApprovalRoutes(deps: ApprovalRouteDeps): RouteDefinition[] {
  return [
    // ── Non-v1 (backward-compatible) ──────────────────────────────────────────
    {
      method: "GET",
      pathname: "/approvals",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const limit = readLimit(ctx.request, 25);
        const status = readStatusFilter(ctx.request);
        const approvals = deps.inspectService.queryDecisionInspectSummaries({
          decisionType: "approval",
          limit,
          ...(principal.tenantId != null ? { tenantId: principal.tenantId } : {}),
          ...(status ? { status } : {}),
        });
        return buildJsonResponse(ctx.requestId, 200, { approvals });
      },
    },
    {
      method: "POST",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (
          segments[0] !== "approvals"
          || segments.length !== 3
          || segments[2] !== "decision"
        ) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const actorId = principal.actorId;
        const approvalId = validateApprovalId(segments[1]);
        getAuthorizedApprovalView(deps, principal, actorId, approvalId);
        const decision = parseApprovalDecisionPayload(
          approvalId,
          actorId,
          readValidatedJsonBody(ctx.request.body, (body) => body),
        );
        deps.approvalService.applyDecision(decision);
        const approval = deps.inspectService.getApprovalInspectView(approvalId);
        return buildJsonResponse(ctx.requestId, 200, approval);
      },
    },
    // ── v1 ───────────────────────────────────────────────────────────────────
    {
      method: "GET",
      pathname: "/v1/approvals",
      handler: (ctx) => {
        const principal = requirePrincipal(ctx.request, deps.authService, "viewer");
        const limit = readLimit(ctx.request, 25);
        const status = readStatusFilter(ctx.request);
        const approvals = deps.inspectService.queryDecisionInspectSummaries({
          decisionType: "approval",
          limit,
          ...(principal.tenantId != null ? { tenantId: principal.tenantId } : {}),
          ...(status ? { status } : {}),
        });
        return buildJsonResponse(ctx.requestId, 200, { approvals });
      },
    },
    {
      method: "POST",
      pathname: null,
      segments: true,
      handler: (ctx) => {
        const { segments } = ctx.route;
        if (
          segments[0] !== "v1"
          || segments[1] !== "approvals"
          || segments.length !== 4
          || segments[3] !== "decision"
        ) {
          return null;
        }
        const principal = requirePrincipal(ctx.request, deps.authService, "operator");
        const actorId = principal.actorId;
        const approvalId = validateApprovalId(segments[2]);
        getAuthorizedApprovalView(deps, principal, actorId, approvalId);
        const decision = parseApprovalDecisionPayload(
          approvalId,
          actorId,
          readValidatedJsonBody(ctx.request.body, (body) => body),
        );
        deps.approvalService.applyDecision(decision);
        const approval = deps.inspectService.getApprovalInspectView(approvalId);
        return buildJsonResponse(ctx.requestId, 200, approval);
      },
    },
  ];
}
