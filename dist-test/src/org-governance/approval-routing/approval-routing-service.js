import { buildGovernanceAuditRecord } from "../compliance-engine/audit-enforcer/index.js";
import { resolveDelegatedApprover } from "./delegation/index.js";
import { shouldEscalateApproval } from "./escalation/index.js";
import { resolveApprovalRoute, } from "./route-engine/index.js";
export class ApprovalRoutingService {
    orgNodes;
    delegations;
    escalationRules;
    amountThresholdRules;
    constructor(options) {
        this.orgNodes = options.orgNodes;
        this.delegations = options.delegations ?? [];
        this.escalationRules = options.escalationRules ?? [];
        this.amountThresholdRules = options.amountThresholdRules ?? [];
    }
    route(request, createdAtIso, nowIso) {
        const delegationMap = this.buildDelegationMap(request.orgNodeId, nowIso);
        const base = resolveApprovalRoute(this.orgNodes, request, delegationMap, this.amountThresholdRules);
        const escalatedTo = this.resolveEscalation(createdAtIso, nowIso, request.riskLevel);
        const approverChain = escalatedTo != null && !base.approverChain.includes(escalatedTo)
            ? [...base.approverChain, escalatedTo]
            : [...base.approverChain];
        return {
            matchedOrgNodeId: base.matchedOrgNodeId,
            approverChain,
            delegated: base.delegated,
            routingStrategy: base.routingStrategy,
            escalatedTo,
            auditRecord: buildGovernanceAuditRecord({
                recordId: `audit_${request.requesterId}_${request.orgNodeId}`,
                action: "approval.route",
                actorId: request.requesterId,
                orgNodeId: base.matchedOrgNodeId,
                allowed: approverChain.length > 0,
                reasonCodes: [
                    ...(base.delegated ? ["approval.delegated"] : ["approval.direct_route"]),
                    `approval.routing.${base.routingStrategy}`,
                    ...(escalatedTo != null ? ["approval.escalated"] : []),
                ],
                occurredAt: nowIso,
            }),
        };
    }
    buildDelegationMap(orgNodeId, nowIso) {
        const node = this.orgNodes.find((item) => item.orgNodeId === orgNodeId) ?? null;
        const owners = node?.ownerUserIds ?? [];
        return owners.reduce((acc, approverId) => {
            acc[approverId] = resolveDelegatedApprover(this.delegations, approverId, orgNodeId, nowIso);
            return acc;
        }, {});
    }
    resolveEscalation(createdAtIso, nowIso, riskLevel) {
        const matchedRule = this.escalationRules.find((rule) => shouldEscalateApproval(rule, createdAtIso, nowIso, riskLevel));
        return matchedRule?.escalateToApproverId ?? null;
    }
}
//# sourceMappingURL=approval-routing-service.js.map