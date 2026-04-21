import { nowIso } from "../../platform/contracts/types/ids.js";
import { buildGovernanceAuditRecord, } from "./audit-enforcer/index.js";
import { resolveCompliancePolicyForNode } from "./policy-resolver/index.js";
export class ComplianceGovernanceService {
    nodes;
    policiesByNodeId;
    constructor(nodes, policiesByNodeId) {
        this.nodes = nodes;
        this.policiesByNodeId = policiesByNodeId;
    }
    evaluate(input) {
        const effectivePolicy = resolveCompliancePolicyForNode(this.nodes, input.orgNodeId, this.policiesByNodeId);
        const requiredKeys = input.requiredPolicyKeys ?? [];
        const missingKeys = requiredKeys.filter((key) => !(key in effectivePolicy));
        const allowed = missingKeys.length === 0;
        return {
            orgNodeId: input.orgNodeId,
            effectivePolicy,
            allowed,
            missingKeys,
            auditRecord: buildGovernanceAuditRecord({
                recordId: `audit_${input.orgNodeId}_${input.action}`,
                action: input.action,
                actorId: input.actorId,
                orgNodeId: input.orgNodeId,
                allowed,
                reasonCodes: allowed ? ["compliance.policy_resolved"] : missingKeys.map((key) => `compliance.missing:${key}`),
                occurredAt: input.occurredAt ?? nowIso(),
            }),
        };
    }
}
//# sourceMappingURL=compliance-governance-service.js.map