import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOrgChart,
  diffOrgCharts,
} from "../../../../src/org-governance/org-model/sync/index.js";
import {
  buildReportingChain,
  detectOrgChangeEvents,
  validateOrgHierarchy,
} from "../../../../src/org-governance/org-model/hierarchy/index.js";
import {
  OrgNodeSchema,
  createCrossOrgCollaborator,
} from "../../../../src/org-governance/org-model/org-node/index.js";

const nodes = [
  OrgNodeSchema.parse({ orgNodeId: "tenant", nodeType: "tenant", displayName: "Acme", parentOrgNodeId: null, ownerUserIds: ["ceo"], active: true, costCenter: "", metadata: {} }),
  OrgNodeSchema.parse({ orgNodeId: "division", nodeType: "division", displayName: "Biz", parentOrgNodeId: "tenant", ownerUserIds: ["vp"], active: true, costCenter: "", metadata: {} }),
  OrgNodeSchema.parse({ orgNodeId: "dept", nodeType: "department", displayName: "Eng", parentOrgNodeId: "division", ownerUserIds: ["director"], active: true, costCenter: "", metadata: {} }),
  OrgNodeSchema.parse({ orgNodeId: "team", nodeType: "team", displayName: "Runtime", parentOrgNodeId: "dept", ownerUserIds: ["lead"], active: true, costCenter: "", metadata: {} }),
];

test("org-model-service smoke validates hierarchy and reporting chain", () => {
  assert.deepEqual(validateOrgHierarchy(nodes), []);
  assert.deepEqual(buildReportingChain(nodes, "engineer", "team"), ["lead", "director", "vp", "ceo"]);
});

test("org-model-service smoke diffs canonical org charts", () => {
  const before = buildOrgChart(nodes, "manual");
  const after = buildOrgChart([{ ...nodes[3]!, ownerUserIds: ["lead-2"] }, ...nodes.slice(0, 3)], "manual");
  assert.deepEqual(diffOrgCharts(before, after), ["team"]);
});

test("org-model-service smoke detects principal offboarding and transfers", () => {
  const offboarding = detectOrgChangeEvents(nodes, nodes.slice(0, 3), [
    { principalId: "seat-1", userId: "engineer", homeNodeId: "team", managerUserId: "lead", active: true },
  ]);
  assert.ok(offboarding.some((event) => event.type === "employee_offboarding"));
});

test("org-model-service smoke creates cross-org collaborator records", () => {
  const collaborator = createCrossOrgCollaborator({
    userId: "user-1",
    homeOrgNodeId: "tenant-a",
    targetOrgNodeId: "team",
    role: "consultant",
    scope: {
      targetOrgNodeId: "team",
      allowedDomains: ["runtime"],
      allowedActions: ["view", "execute"],
      expiresAt: null,
    },
    grantedBy: "admin-1",
  });
  assert.equal(collaborator.targetOrgNodeId, "team");
});
