import { STRIDE_CATEGORIES, validateThreatMatrix, } from "./stride-framework.js";
const DEFAULT_ENTRIES = [
    {
        threatId: "tm_spoofing_principal_identity",
        category: "SPOOFING",
        title: "Principal spoofing on control-plane entrypoints",
        scenario: "Forged identities attempt to impersonate operators, services, or workers.",
        mitigations: ["JWT and workspace identity verification", "challenge-based worker registration", "secret lease validation"],
        implementationRefs: [
            "src/platform/control-plane/iam/policy-engine.ts",
            "src/platform/control-plane/iam/secret-management-service.ts",
            "src/platform/state-evidence/truth/sqlite/repositories/worker-repository.ts",
        ],
        residualRisk: "medium",
    },
    {
        threatId: "tm_tampering_audit_chain",
        category: "TAMPERING",
        title: "Audit or event history tampering",
        scenario: "Attackers modify audit trails, integrity hashes, or persisted evidence.",
        mitigations: ["audit hash chaining", "integrity repository verification", "append-only state evidence flows"],
        implementationRefs: [
            "src/platform/control-plane/iam/audit-event-integrity.ts",
            "src/platform/control-plane/iam/audit-integrity-repository.ts",
            "src/platform/state-evidence/events/transactional-event-appender.ts",
        ],
        residualRisk: "low",
    },
    {
        threatId: "tm_repudiation_operator_actions",
        category: "REPUDIATION",
        title: "Operators deny performing governance actions",
        scenario: "Approvals, overrides, or recovery actions lack enough evidence to attribute responsibility.",
        mitigations: ["handoff package evidence", "integrity-protected audit trail", "structured incident timeline exports"],
        implementationRefs: [
            "src/platform/control-plane/incident-control/enterprise-governance-service.ts",
            "src/platform/control-plane/iam/audit-event-integrity.ts",
            "src/platform/shared/observability/diagnostics-service.js",
        ],
        residualRisk: "medium",
    },
    {
        threatId: "tm_information_disclosure_secret_egress",
        category: "INFORMATION_DISCLOSURE",
        title: "Secret or tenant data disclosure",
        scenario: "Sensitive data leaks through outbound requests, logs, or storage surfaces.",
        mitigations: ["field encryption", "network egress policies", "outbound URL allowlisting", "secret masking"],
        implementationRefs: [
            "src/platform/control-plane/iam/field-encryption.ts",
            "src/platform/control-plane/iam/network-egress-policy.ts",
            "src/platform/control-plane/iam/outbound-url-policy.ts",
            "src/platform/control-plane/iam/secret-management-service.ts",
        ],
        residualRisk: "medium",
    },
    {
        threatId: "tm_dos_runtime_exhaustion",
        category: "DENIAL_OF_SERVICE",
        title: "Runtime exhaustion and provider saturation",
        scenario: "High load, backlog growth, or external provider failures degrade service availability.",
        mitigations: ["SLO alerting", "queue and lease runbooks", "budget and rollout freeze controls"],
        implementationRefs: [
            "src/platform/shared/observability/slo-alerting-service.ts",
            "src/platform/control-plane/incident-control/operations-governance-service.ts",
            "src/platform/shared/observability/rollout-freeze-manager.js",
        ],
        residualRisk: "medium",
    },
    {
        threatId: "tm_eop_capability_escalation",
        category: "ELEVATION_OF_PRIVILEGE",
        title: "Capability escalation through sandbox or policy misconfiguration",
        scenario: "Tasks or plugins obtain permissions beyond their approved scope.",
        mitigations: ["sandbox policy enforcement", "workspace write policy creation", "policy engine risk evaluation"],
        implementationRefs: [
            "src/platform/control-plane/iam/sandbox-policy.ts",
            "src/platform/control-plane/iam/policy-engine.ts",
            "src/platform/execution/plugin-executor/plugin-executor.service.ts",
        ],
        residualRisk: "high",
    },
];
export class ThreatMatrixRegistry {
    matrix;
    constructor(matrix) {
        this.matrix = matrix ?? {
            version: "2026.04",
            updatedAt: "2026-04-23T00:00:00.000Z",
            owner: "platform_security",
            entries: DEFAULT_ENTRIES,
        };
    }
    getMatrix() {
        return {
            ...this.matrix,
            entries: this.matrix.entries.map((entry) => ({ ...entry, mitigations: [...entry.mitigations], implementationRefs: [...entry.implementationRefs] })),
        };
    }
    listCategories() {
        return STRIDE_CATEGORIES;
    }
    listByCategory(category) {
        return this.matrix.entries.filter((entry) => entry.category === category);
    }
    validate() {
        return validateThreatMatrix(this.matrix);
    }
}
export const defaultThreatMatrixRegistry = new ThreatMatrixRegistry();
//# sourceMappingURL=threat-matrix-registry.js.map