import { nowIso } from "../../platform/contracts/types/ids.js";
import { DEFAULT_COMPLIANCE_FRAMEWORKS, } from "./framework-catalog.js";
import { buildGovernanceAuditRecord, } from "./audit-enforcer/index.js";
import { ComplianceEvidenceCollector } from "./evidence-collector.js";
import { resolveCompliancePolicyForNode } from "./policy-resolver/index.js";
export class ComplianceGovernanceService {
    nodes;
    policiesByNodeId;
    frameworks = new Map();
    bindings = new Map();
    evidenceCollector = new ComplianceEvidenceCollector();
    constructor(nodes, policiesByNodeId, frameworks = DEFAULT_COMPLIANCE_FRAMEWORKS, bindings = []) {
        this.nodes = nodes;
        this.policiesByNodeId = policiesByNodeId;
        for (const framework of frameworks) {
            this.frameworks.set(framework.frameworkId, framework);
        }
        for (const binding of bindings) {
            this.attachFrameworks(binding);
        }
    }
    registerFramework(framework) {
        this.frameworks.set(framework.frameworkId, framework);
        return framework;
    }
    attachFrameworks(binding) {
        this.bindings.set(binding.orgNodeId, [...(this.bindings.get(binding.orgNodeId) ?? []), binding]);
        return binding;
    }
    collectEvidence(input) {
        return this.evidenceCollector.collect(input);
    }
    listEvidence(frameworkId) {
        return this.evidenceCollector.list(frameworkId);
    }
    evaluate(input) {
        const effectivePolicy = resolveCompliancePolicyForNode(this.nodes, input.orgNodeId, this.policiesByNodeId);
        const requiredKeys = input.requiredPolicyKeys ?? [];
        const missingKeys = requiredKeys.filter((key) => !(key in effectivePolicy));
        const applicableFrameworks = this.resolveFrameworks(input.orgNodeId);
        const missingControls = applicableFrameworks.flatMap((framework) => framework.controlIds.filter((controlId) => !(controlId in effectivePolicy)));
        const missingFrameworkPolicies = applicableFrameworks.flatMap((framework) => Object.entries(framework.minimumPolicies)
            .filter(([key, value]) => !matchesFrameworkRequirement(effectivePolicy[key], value))
            .map(([key]) => key));
        const allowed = missingKeys.length === 0 && missingControls.length === 0 && missingFrameworkPolicies.length === 0;
        return {
            orgNodeId: input.orgNodeId,
            effectivePolicy,
            allowed,
            missingKeys,
            applicableFrameworks,
            missingControls: [...new Set([...missingControls, ...missingFrameworkPolicies])],
            auditRecord: buildGovernanceAuditRecord({
                recordId: `audit_${input.orgNodeId}_${input.action}`,
                action: input.action,
                actorId: input.actorId,
                orgNodeId: input.orgNodeId,
                allowed,
                reasonCodes: allowed
                    ? ["compliance.policy_resolved"]
                    : [
                        ...missingKeys.map((key) => `compliance.missing:${key}`),
                        ...missingControls.map((controlId) => `compliance.control_missing:${controlId}`),
                        ...missingFrameworkPolicies.map((key) => `compliance.framework_policy_missing:${key}`),
                    ],
                occurredAt: input.occurredAt ?? nowIso(),
            }),
        };
    }
    listFrameworks() {
        return [...this.frameworks.values()];
    }
    resolveFrameworks(orgNodeId) {
        const lineage = new Set();
        let current = this.nodes.find((item) => item.orgNodeId === orgNodeId) ?? null;
        while (current != null) {
            lineage.add(current.orgNodeId);
            current = current.parentOrgNodeId == null
                ? null
                : this.nodes.find((item) => item.orgNodeId === current?.parentOrgNodeId) ?? null;
        }
        const frameworkIds = [...lineage]
            .flatMap((nodeId) => this.bindings.get(nodeId) ?? [])
            .flatMap((binding) => binding.frameworkIds);
        return [...new Set(frameworkIds)]
            .map((frameworkId) => this.frameworks.get(frameworkId))
            .filter((item) => item != null);
    }
}
function matchesFrameworkRequirement(observed, required) {
    if (typeof required === "boolean") {
        return observed === required;
    }
    if (typeof required === "number") {
        return typeof observed === "number" && observed >= required;
    }
    if (typeof required === "string") {
        return observed === required;
    }
    return observed != null;
}
//# sourceMappingURL=compliance-governance-service.js.map