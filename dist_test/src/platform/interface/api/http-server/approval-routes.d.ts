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
import type { ApiAuthService } from "../api-auth-service.js";
import type { ApprovalService } from "../../../control-plane/approval-center/approval-service.js";
import type { InspectService } from "../../../shared/observability/inspect-service.js";
export interface ApprovalRouteDeps {
    authService: ApiAuthService | null;
    approvalService: ApprovalService;
    inspectService: InspectService;
}
export declare function createApprovalRoutes(deps: ApprovalRouteDeps): RouteDefinition[];
