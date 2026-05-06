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
import type { ApiAuthService, ApiPrincipal } from "../api-auth-service.js";
import type { ApprovalService } from "../../../control-plane/approval-center/approval-service.js";
import type { InspectService } from "../../../shared/observability/inspect-service.js";
import { AppError } from "../../../contracts/errors.js";
import type { ApprovalInspectView } from "../../../shared/observability/inspect-service.js";

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
        const approvalId = segments[1];
        if (!approvalId || !isValidApprovalIdFormat(approvalId)) {
          throw new ApiError(400, "api.approval_invalid_id", "Invalid approvalId format.");
        }
        const approvalForAuthz = loadApprovalInspectView(deps.inspectService, approvalId);
        if (!isActorAuthorizedForApproval(principal, approvalForAuthz)) {
          throw new ApiError(403, "api.approval_not_authorized", "Actor not authorized for this approval.");
        }
        const decision = parseApprovalDecisionPayload(
          approvalId,
          actorId,
          readValidatedJsonBody(ctx.request.body, (body) => body),
        );
        deps.approvalService.applyDecision(decision);
        const approval = loadApprovalInspectView(deps.inspectService, approvalId);
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
        const approvalId = segments[2];
        if (!approvalId || !isValidApprovalIdFormat(approvalId)) {
          throw new ApiError(400, "api.approval_invalid_id", "Invalid approvalId format.");
        }
        const approvalForAuthz = loadApprovalInspectView(deps.inspectService, approvalId);
        if (!isActorAuthorizedForApproval(principal, approvalForAuthz)) {
          throw new ApiError(403, "api.approval_not_authorized", "Actor not authorized for this approval.");
        }
        const decision = parseApprovalDecisionPayload(
          approvalId,
          actorId,
          readValidatedJsonBody(ctx.request.body, (body) => body),
        );
        deps.approvalService.applyDecision(decision);
        const approval = loadApprovalInspectView(deps.inspectService, approvalId);
        return buildJsonResponse(ctx.requestId, 200, approval);
      },
    },
  ];
}

function isValidApprovalIdFormat(id: string): boolean {
  // Approval IDs must be non-empty strings with reasonable length
  return id.length > 0 && id.length <= 256 && /^[a-zA-Z0-9_-]+$/.test(id);
}

function loadApprovalInspectView(inspectService: InspectService, approvalId: string): ApprovalInspectView {
  try {
    return inspectService.getApprovalInspectView(approvalId);
  } catch (error) {
    if (
      ((error instanceof AppError) || (typeof error === "object" && error !== null && "code" in error))
      && (((error as { code?: string }).code) === "inspect.approval_not_found"
        || ((error as { code?: string }).code) === "approval.not_found")
    ) {
      throw new ApiError(404, "api.approval_not_found", "Approval not found.");
    }
    throw error;
  }
}

function isActorAuthorizedForApproval(principal: ApiPrincipal, approval: ApprovalInspectView): boolean {
  if (!principal.actorId || typeof principal.actorId !== "string") {
    return false;
  }

  if (principal.roles.includes("admin")) {
    return true;
  }

  const approvalTenantId = approval.task.tenantId ?? null;
  if (principal.tenantId != null && approvalTenantId != null && principal.tenantId !== approvalTenantId) {
    return false;
  }

  const actorAllowList = extractAllowedActorIds(approval);
  if (actorAllowList.length > 0) {
    return actorAllowList.includes(principal.actorId);
  }

  return principal.roles.includes("operator");
}

function extractAllowedActorIds(approval: ApprovalInspectView): string[] {
  const parsed = safeParseJsonRecord(approval.approval.requestJson);
  const context = asRecord(parsed.context);
  const candidates: string[] = [];

  const listLikeKeys = ["allowedActorIds", "approverActorIds", "operatorIds", "reviewerActorIds"] as const;
  for (const key of listLikeKeys) {
    const value = context[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim().length > 0) {
          candidates.push(item.trim());
        }
      }
    }
  }

  const scalarKeys = ["allowedActorId", "operatorId", "reviewerActorId", "requestedBy", "ownerActorId"] as const;
  for (const key of scalarKeys) {
    const value = context[key];
    if (typeof value === "string" && value.trim().length > 0) {
      candidates.push(value.trim());
    }
  }

  if (typeof parsed.sourceAgentId === "string" && parsed.sourceAgentId.trim().length > 0) {
    candidates.push(parsed.sourceAgentId.trim());
  }

  return [...new Set(candidates)];
}

function safeParseJsonRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return asRecord(parsed);
  } catch {
    return {};
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}
