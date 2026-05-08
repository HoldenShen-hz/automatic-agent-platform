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
        const actorId = requirePrincipal(ctx.request, deps.authService, "operator").actorId;
        const approvalId = segments[1];
        if (!approvalId) {
          throw new ApiError(404, "api.approval_not_found", "Approval route requires approvalId.");
        }
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
        const actorId = requirePrincipal(ctx.request, deps.authService, "operator").actorId;
        const approvalId = segments[2];
        if (!approvalId) {
          throw new ApiError(404, "api.approval_not_found", "Approval route requires approvalId.");
        }
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
