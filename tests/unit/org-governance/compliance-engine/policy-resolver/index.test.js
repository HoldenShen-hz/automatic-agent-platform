import assert from "node:assert/strict";
import test from "node:test";
import { resolveCompliancePolicyForNode } from "../../../../../src/org-governance/compliance-engine/policy-resolver/index.js";
function createMockOrgNode(id, parentId) {
    return {
        orgNodeId: id,
        parentOrgNodeId: parentId,
        active: true,
        nodeType: "team",
    };
}
test("resolveCompliancePolicyForNode returns empty object for unknown node", () => {
    const nodes = [
        createMockOrgNode("node1", null),
    ];
    const policies = {};
    const result = resolveCompliancePolicyForNode(nodes, "unknown_node", policies);
    assert.deepEqual(result, { _denyByDefault: true });
    assert.equal(result.denyByDefault, true);
});
test("resolveCompliancePolicyForNode returns policy for single node without parent", () => {
    const nodes = [
        createMockOrgNode("company", null),
    ];
    const policies = {
        company: [{ policyId: "p1", rules: { accessLevel: "admin" } }],
    };
    const result = resolveCompliancePolicyForNode(nodes, "company", policies);
    assert.deepEqual(result, { accessLevel: "admin", _denyByDefault: false });
    assert.equal(result.denyByDefault, false);
});
test("resolveCompliancePolicyForNode merges policies from lineage", () => {
    const nodes = [
        createMockOrgNode("company", null),
        createMockOrgNode("division", "company"),
        createMockOrgNode("department", "division"),
    ];
    const policies = {
        company: [{ policyId: "p1", rules: { level: "company_level" } }],
        division: [{ policyId: "p2", rules: { level: "division_level" } }],
        department: [{ policyId: "p3", rules: { level: "department_level" } }],
    };
    const result = resolveCompliancePolicyForNode(nodes, "department", policies);
    // inheritPolicyLayers merges in order, so last one wins
    assert.equal(result["level"], "department_level");
});
test("resolveCompliancePolicyForNode uses fallback when node has no policy", () => {
    const nodes = [
        createMockOrgNode("company", null),
        createMockOrgNode("team", "company"),
    ];
    const policies = {
        company: [{ policyId: "p1", rules: { inherited: "yes" } }],
        // team has no policy
    };
    const result = resolveCompliancePolicyForNode(nodes, "team", policies);
    assert.deepEqual(result, { inherited: "yes", _denyByDefault: false });
    assert.equal(result.denyByDefault, false);
});
test("resolveCompliancePolicyForNode handles missing parent gracefully", () => {
    const nodes = [
        createMockOrgNode("child", "nonexistent_parent"),
    ];
    const policies = {
        child: [{ policyId: "p1", rules: { value: 42 } }],
    };
    const result = resolveCompliancePolicyForNode(nodes, "child", policies);
    assert.deepEqual(result, { value: 42, _denyByDefault: false });
    assert.equal(result.denyByDefault, false);
});
test("resolveCompliancePolicyForNode handles empty nodes array", () => {
    const nodes = [];
    const policies = {};
    const result = resolveCompliancePolicyForNode(nodes, "any_node", policies);
    assert.deepEqual(result, { _denyByDefault: true });
    assert.equal(result.denyByDefault, true);
});
//# sourceMappingURL=index.test.js.map
