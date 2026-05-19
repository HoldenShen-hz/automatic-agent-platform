import assert from "node:assert/strict";
import test from "node:test";
import { buildOrgChart, diffOrgCharts, mergeOrgNodes, } from "../../../../src/org-governance/org-model/sync/index.js";
import { buildOrgChangeImpactArtifacts, buildReportingChain, detectOrgChangeEvents, } from "../../../../src/org-governance/org-model/hierarchy/index.js";
import { OrgNodeSchema, OrgNodeTypeSchema, } from "../../../../src/org-governance/org-model/org-node/index.js";
const canonicalNodes = [
    OrgNodeSchema.parse({ orgNodeId: "company", nodeType: "company", displayName: "Acme", parentOrgNodeId: null, ownerUserIds: ["ceo"], active: true, costCenter: "", metadata: {} }),
    OrgNodeSchema.parse({ orgNodeId: "division", nodeType: "division", displayName: "Biz", parentOrgNodeId: "company", ownerUserIds: ["vp"], active: true, costCenter: "", metadata: {} }),
    OrgNodeSchema.parse({ orgNodeId: "dept", nodeType: "department", displayName: "Eng", parentOrgNodeId: "division", ownerUserIds: ["director"], active: true, costCenter: "", metadata: {} }),
    OrgNodeSchema.parse({ orgNodeId: "team", nodeType: "team", displayName: "Runtime", parentOrgNodeId: "dept", ownerUserIds: ["lead"], active: true, costCenter: "", metadata: {} }),
];
test("org-model canonical schema rejects deprecated member node type", () => {
    assert.throws(() => OrgNodeTypeSchema.parse("member"));
});
test("org-model sync builds and diffs org charts", () => {
    const before = buildOrgChart(canonicalNodes, "manual");
    const after = buildOrgChart(mergeOrgNodes(canonicalNodes, [
        { ...canonicalNodes[3], displayName: "Runtime 2" },
    ]), "manual");
    assert.deepEqual(diffOrgCharts(before, after), ["team"]);
});
test("org-model hierarchy builds reporting chain from canonical leaf", () => {
    assert.deepEqual(buildReportingChain(canonicalNodes, "engineer", "team"), ["lead", "director", "vp", "ceo"]);
});
test("org-model detectOrgChangeEvents uses principal assignments for offboarding and onboarding", () => {
    const offboarding = detectOrgChangeEvents(canonicalNodes, canonicalNodes.slice(0, 3), [
        { principalId: "seat-1", userId: "engineer", homeNodeId: "team", managerUserId: "lead", active: true },
    ]);
    assert.ok(offboarding.some((event) => event.type === "employee_offboarding"));
    const onboarding = detectOrgChangeEvents([], [canonicalNodes[3]], [
        { principalId: "seat-2", userId: "new-user", homeNodeId: "team", managerUserId: "lead", active: true },
    ]);
    assert.ok(onboarding.some((event) => event.type === "employee_onboarding"));
});
test("org-model emits change-impact artifacts for orphaned nodes", () => {
    const artifacts = buildOrgChangeImpactArtifacts(canonicalNodes, [
        { ...canonicalNodes[3], parentOrgNodeId: "missing-parent", ownerUserIds: ["lead-2"] },
    ], [
        { principalId: "seat-1", userId: "engineer", homeNodeId: "team", managerUserId: "lead", active: true },
    ]);
    assert.ok(artifacts.orphanAgentFreezePolicies.length > 0);
    assert.ok(artifacts.identityDeprovisioningReports.length > 0);
});
//# sourceMappingURL=org-model.test.js.map