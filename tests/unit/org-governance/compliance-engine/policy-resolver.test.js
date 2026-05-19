import test from "node:test";
import assert from "node:assert/strict";
import { resolveCompliancePolicyForNode } from "../../../../src/org-governance/compliance-engine/policy-resolver/index.js";
test("resolveCompliancePolicyForNode returns merged policy for a leaf node", () => {
    const nodes = [
        { orgNodeId: "root", nodeType: "company", displayName: "Acme Corp", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        { orgNodeId: "dept", nodeType: "department", displayName: "Engineering", parentOrgNodeId: "root", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        { orgNodeId: "team", nodeType: "team", displayName: "Backend", parentOrgNodeId: "dept", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        { orgNodeId: "member", nodeType: "member", displayName: "Alice", parentOrgNodeId: "team", ownerUserIds: ["user-1"], active: true, costCenter: "", metadata: {} },
    ];
    const policiesByNodeId = {
        root: [{ policyId: "root_policy", rules: { level: "company" } }],
        dept: [{ policyId: "dept_policy", rules: { dataClassification: "standard" } }],
        team: [{ policyId: "team_policy", rules: { encryptionRequired: true } }],
        member: [],
    };
    const result = resolveCompliancePolicyForNode(nodes, "member", policiesByNodeId);
    assert.strictEqual(result.level, "company");
    assert.strictEqual(result.dataClassification, "standard");
    assert.strictEqual(result.encryptionRequired, true);
});
test("resolveCompliancePolicyForNode returns company-level policy for company node", () => {
    const nodes = [
        { orgNodeId: "root", nodeType: "company", displayName: "Acme Corp", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
    ];
    const policiesByNodeId = {
        root: [{ policyId: "root_policy", rules: { complianceMode: "strict" } }],
    };
    const result = resolveCompliancePolicyForNode(nodes, "root", policiesByNodeId);
    assert.strictEqual(result.complianceMode, "strict");
});
test("resolveCompliancePolicyForNode returns merged policy for intermediate node", () => {
    const nodes = [
        { orgNodeId: "root", nodeType: "company", displayName: "Acme Corp", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        { orgNodeId: "dept", nodeType: "department", displayName: "Sales", parentOrgNodeId: "root", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
    ];
    const policiesByNodeId = {
        root: [{ policyId: "p1", rules: { retentionDays: 90 } }],
        dept: [{ policyId: "p2", rules: { retentionDays: 30 } }],
    };
    const result = resolveCompliancePolicyForNode(nodes, "dept", policiesByNodeId);
    assert.strictEqual(result.retentionDays, 30);
});
test("resolveCompliancePolicyForNode returns empty object when node has no policies in lineage", () => {
    const nodes = [
        { orgNodeId: "root", nodeType: "company", displayName: "Acme Corp", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
        { orgNodeId: "dept", nodeType: "department", displayName: "IT", parentOrgNodeId: "root", ownerUserIds: [], active: true, costCenter: "", metadata: {} },
    ];
    const policiesByNodeId = {};
    const result = resolveCompliancePolicyForNode(nodes, "dept", policiesByNodeId);
    assert.deepStrictEqual(result, { _denyByDefault: true });
    assert.strictEqual(result.denyByDefault, true);
});
test("resolveCompliancePolicyForNode handles node with no parent", () => {
    const nodes = [
        { orgNodeId: "member", nodeType: "member", displayName: "Bob", parentOrgNodeId: null, ownerUserIds: ["user-2"], active: true, costCenter: "", metadata: {} },
    ];
    const policiesByNodeId = {
        member: [{ policyId: "member_policy", rules: { auditEnabled: true } }],
    };
    const result = resolveCompliancePolicyForNode(nodes, "member", policiesByNodeId);
    assert.strictEqual(result.auditEnabled, true);
});
test("resolveCompliancePolicyForNode returns multiple policies from single node", () => {
    const nodes = [
        { orgNodeId: "root", nodeType: "company", displayName: "Acme Corp", parentOrgNodeId: null, ownerUserIds: [], active: true, costCenter: "", metadata: {} },
    ];
    const policiesByNodeId = {
        root: [
            { policyId: "p1", rules: { ruleA: 1 } },
            { policyId: "p2", rules: { ruleB: 2 } },
        ],
    };
    const result = resolveCompliancePolicyForNode(nodes, "root", policiesByNodeId);
    assert.strictEqual(result.ruleA, 1);
    assert.strictEqual(result.ruleB, 2);
});
//# sourceMappingURL=policy-resolver.test.js.map
