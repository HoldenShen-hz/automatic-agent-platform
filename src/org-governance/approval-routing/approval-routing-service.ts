import { buildGovernanceAuditRecord, type GovernanceAuditRecord } from "../compliance-engine/audit-enforcer/index.js";
import { type ApprovalDelegation, resolveDelegatedApprover } from "./delegation/index.js";
import { type ApprovalEscalationRule, shouldEscalateApproval } from "./escalation/index.js";
import { resolveApprovalRoute, type ApprovalRouteDecision, type ApprovalRouteRequest } from "./route-engine/index.js";
import type { OrgNode } from "../org-model/org-node/index.js";

export interface ApprovalRoutingResult extends ApprovalRouteDecision {
  readonly escalatedTo: string | null;
  readonly auditRecord: GovernanceAuditRecord;
}

export interface ApprovalRoutingServiceOptions {
  readonly orgNodes: readonly OrgNode[];
  readonly delegations?: readonly ApprovalDelegation[];
  readonly escalationRules?: readonly ApprovalEscalationRule[];
}

export class ApprovalRoutingService {
  private readonly orgNodes: readonly OrgNode[];
  private readonly delegations: readonly ApprovalDelegation[];
  private readonly escalationRules: readonly ApprovalEscalationRule[];

  public constructor(options: ApprovalRoutingServiceOptions) {
    this.orgNodes = options.orgNodes;
    this.delegations = options.delegations ?? [];
    this.escalationRules = options.escalationRules ?? [];
  }

  public route(request: ApprovalRouteRequest, createdAtIso: string, nowIso: string): ApprovalRoutingResult {
    const delegationMap = this.buildDelegationMap(request.orgNodeId, nowIso);
    const base = resolveApprovalRoute(this.orgNodes, request, delegationMap);
    const escalatedTo = this.resolveEscalation(createdAtIso, nowIso, request.riskLevel);
    const approverChain = escalatedTo != null && !base.approverChain.includes(escalatedTo)
      ? [...base.approverChain, escalatedTo]
      : [...base.approverChain];

    return {
      matchedOrgNodeId: base.matchedOrgNodeId,
      approverChain,
      delegated: base.delegated,
      escalatedTo,
      auditRecord: buildGovernanceAuditRecord({
        recordId: `audit_${request.requesterId}_${request.orgNodeId}`,
        action: "approval.route",
        actorId: request.requesterId,
        orgNodeId: base.matchedOrgNodeId,
        allowed: approverChain.length > 0,
        reasonCodes: [
          ...(base.delegated ? ["approval.delegated"] : ["approval.direct_route"]),
          ...(escalatedTo != null ? ["approval.escalated"] : []),
        ],
        occurredAt: nowIso,
      }),
    };
  }

  private buildDelegationMap(orgNodeId: string, nowIso: string): Record<string, string> {
    const node = this.orgNodes.find((item) => item.orgNodeId === orgNodeId) ?? null;
    const owners = node?.ownerUserIds ?? [];
    return owners.reduce<Record<string, string>>((acc, approverId) => {
      acc[approverId] = resolveDelegatedApprover(this.delegations, approverId, orgNodeId, nowIso);
      return acc;
    }, {});
  }

  private resolveEscalation(
    createdAtIso: string,
    nowIso: string,
    riskLevel: ApprovalRouteRequest["riskLevel"],
  ): string | null {
    const matchedRule = this.escalationRules.find((rule) =>
      shouldEscalateApproval(rule, createdAtIso, nowIso, riskLevel));
    return matchedRule?.escalateToApproverId ?? null;
  }
}
