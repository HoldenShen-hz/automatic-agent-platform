import assert from "node:assert/strict";
import test from "node:test";
import { ComplianceGovernanceService } from "../../../src/org-governance/compliance-engine/compliance-governance-service.js";
test("ComplianceGovernanceService resolves inherited policy and records audit", () => {
    const service = new ComplianceGovernanceService([
        {
            orgNodeId: "root",
            nodeType: "company",
            displayName: "Root",
            parentOrgNodeId: null,
            ownerUserIds: ["ceo"],
            active: true,
            metadata: {},
            costCenter: "",
        },
        {
            orgNodeId: "dept_finance",
            nodeType: "department",
            displayName: "Finance",
            parentOrgNodeId: "root",
            ownerUserIds: ["finance_director"],
            active: true,
            metadata: {},
            costCenter: "FIN-001",
        },
    ], {
        root: [{ policyId: "p_root", rules: { approvalRequired: true } }],
        dept_finance: [{ policyId: "p_finance", rules: { retentionDays: 365 } }],
    });
    const result = service.evaluate({
        actorId: "finance_director",
        orgNodeId: "dept_finance",
        action: "finance.export",
        requiredPolicyKeys: ["approvalRequired", "retentionDays"],
        occurredAt: "2026-04-20T00:00:00.000Z",
    });
    assert.equal(result.allowed, true);
    assert.equal(result.effectivePolicy.approvalRequired, true);
    assert.equal(result.effectivePolicy.retentionDays, 365);
    assert.equal(result.auditRecord.allowed, true);
});
//# sourceMappingURL=compliance-governance-service.test.js.map