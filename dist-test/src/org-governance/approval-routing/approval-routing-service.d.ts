import { type GovernanceAuditRecord } from "../compliance-engine/audit-enforcer/index.js";
import { type ApprovalDelegation } from "./delegation/index.js";
import { type ApprovalEscalationRule } from "./escalation/index.js";
import { type AmountThresholdRule, type ApprovalRouteDecision, type ApprovalRouteRequest } from "./route-engine/index.js";
import type { OrgNode } from "../org-model/org-node/index.js";
export interface ApprovalRoutingResult extends ApprovalRouteDecision {
    readonly escalatedTo: string | null;
    readonly auditRecord: GovernanceAuditRecord;
}
export interface ApprovalRoutingServiceOptions {
    readonly orgNodes: readonly OrgNode[];
    readonly delegations?: readonly ApprovalDelegation[];
    readonly escalationRules?: readonly ApprovalEscalationRule[];
    readonly amountThresholdRules?: readonly AmountThresholdRule[];
}
export declare class ApprovalRoutingService {
    private readonly orgNodes;
    private readonly delegations;
    private readonly escalationRules;
    private readonly amountThresholdRules;
    constructor(options: ApprovalRoutingServiceOptions);
    route(request: ApprovalRouteRequest, createdAtIso: string, nowIso: string): ApprovalRoutingResult;
    private buildDelegationMap;
    private resolveEscalation;
}
