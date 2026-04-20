import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalRoutingService } from "../../../src/org-governance/approval-routing/approval-routing-service.js";
import type { OrgNode } from "../../../src/org-governance/org-model/org-node/index.js";

const orgNodes: OrgNode[] = [
  {
    orgNodeId: "dept_1",
    nodeType: "department",
    displayName: "Platform",
    parentOrgNodeId: null,
    ownerUserIds: ["director"],
    active: true,
  },
];

test("ApprovalRoutingService applies delegation and escalation", () => {
  const service = new ApprovalRoutingService({
    orgNodes,
    delegations: [
      {
        delegationId: "del_1",
        approverId: "director",
        delegateApproverId: "backup_director",
        scopeNodeIds: ["dept_1"],
        startsAt: "2026-04-20T00:00:00.000Z",
        expiresAt: "2026-04-21T00:00:00.000Z",
        active: true,
      },
    ],
    escalationRules: [
      {
        ruleId: "esc_1",
        triggerAfterMinutes: 30,
        escalateToApproverId: "vp_ops",
        appliesToRiskLevels: ["high", "critical"],
      },
    ],
  });

  const result = service.route({
    requesterId: "user_1",
    orgNodeId: "dept_1",
    riskLevel: "high",
    amountUsd: 1000,
  }, "2026-04-20T00:00:00.000Z", "2026-04-20T01:00:00.000Z");

  assert.deepEqual(result.approverChain, ["backup_director", "vp_ops"]);
  assert.equal(result.delegated, true);
  assert.equal(result.escalatedTo, "vp_ops");
  assert.ok(result.auditRecord.reasonCodes?.includes("approval.escalated"));
});
