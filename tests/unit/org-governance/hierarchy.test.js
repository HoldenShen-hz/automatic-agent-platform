import assert from "node:assert/strict";
import test from "node:test";
import { buildOrgChangeImpactArtifacts, buildReportingChain, detectOrgChangeEvents, findRootNode, getNodeDepth, getNodesAtLevel, } from "../../../src/org-governance/org-model/hierarchy/index.js";
const hierarchy = [
    { orgNodeId: "company", nodeType: "company", displayName: "Acme", parentOrgNodeId: null, ownerUserIds: ["ceo"], active: true, costCenter: "", metadata: {} },
    { orgNodeId: "division", nodeType: "division", displayName: "Biz", parentOrgNodeId: "company", ownerUserIds: ["vp"], active: true, costCenter: "", metadata: {} },
    { orgNodeId: "dept", nodeType: "department", displayName: "Eng", parentOrgNodeId: "division", ownerUserIds: ["director"], active: true, costCenter: "", metadata: {} },
    { orgNodeId: "team", nodeType: "team", displayName: "Runtime", parentOrgNodeId: "dept", ownerUserIds: ["lead"], active: true, costCenter: "", metadata: {} },
];
test("hierarchy helpers resolve root and levels for canonical org tree", () => {
    assert.equal(findRootNode(hierarchy)?.orgNodeId, "company");
    assert.deepEqual(getNodesAtLevel(hierarchy, 1).map((node) => node.orgNodeId), ["division"]);
    assert.equal(getNodeDepth(hierarchy, "team"), 3);
});
test("hierarchy reporting chain starts with team owner", () => {
    assert.deepEqual(buildReportingChain(hierarchy, "engineer", "team"), ["lead", "director", "vp", "ceo"]);
});
test("hierarchy detectOrgChangeEvents supports principal assignment onboarding", () => {
    const events = detectOrgChangeEvents([], [{ ...hierarchy[3] }], [
        { principalId: "seat-1", userId: "engineer", homeNodeId: "team", managerUserId: "lead", active: true },
    ]);
    assert.ok(events.some((event) => event.type === "employee_onboarding"));
});
test("hierarchy buildOrgChangeImpactArtifacts freezes reroute and deprovision outputs", () => {
    const artifacts = buildOrgChangeImpactArtifacts(hierarchy, [
        { orgNodeId: "team", nodeType: "team", displayName: "Runtime", parentOrgNodeId: "missing", ownerUserIds: ["lead-2"], active: true, costCenter: "", metadata: {}, legalEntityBoundary: { boundaryId: "le-2", legalEntityId: "entity-2", jurisdictionCountry: "US", dataResidencyRegion: "us-east", crossBorderTransferPolicy: "approval_required", crossEntityApprovalRoles: ["legal_reviewer"], restrictedDataClasses: [] } },
    ], [
        { principalId: "seat-1", userId: "engineer", homeNodeId: "team", managerUserId: "lead", active: true },
    ]);
    assert.ok(artifacts.approvalReroutes.length > 0);
    assert.ok(artifacts.orphanAgentFreezePolicies.length > 0);
});
//# sourceMappingURL=hierarchy.test.js.map