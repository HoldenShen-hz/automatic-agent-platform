import assert from "node:assert/strict";
import test from "node:test";

import { PlatformOpsAgentService } from "../../../src/ops-maturity/platform-ops-agent/platform-ops-agent-service.js";

test("PlatformOpsAgentService requires approval before high-risk proposals become executable", () => {
  const service = new PlatformOpsAgentService({
    agentId: "agent_ops_1",
    specialty: "incident_response",
    allowedActionTypes: ["investigate_incident", "scale_capacity"],
    requiredApprovals: ["sre_manager"],
    maxAutonomyLevel: "supervised_execution",
    evidenceRequirements: ["runbook:incident"],
  });

  const proposal = service.createProposal({
    probes: [{ component: "queue", status: "failed" }],
    errorRate: 0.3,
    backlog: 1200,
    currentLoad: 100,
    projectedLoad: 260,
    observedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(proposal.actionType, "investigate_incident");
  assert.equal(proposal.approvalStatus, "pending");
  assert.equal(proposal.executable, false);

  const approved = service.recordApproval(proposal.proposalId, "sre_manager");
  assert.equal(approved.approvalStatus, "approved");
  assert.equal(approved.executable, true);
  assert.equal(service.execute(proposal.proposalId).executed, true);
});

test("PlatformOpsAgentService respects panic and action allow-list guardrails", () => {
  const service = new PlatformOpsAgentService({
    agentId: "agent_ops_2",
    specialty: "config",
    allowedActionTypes: ["developer_assist"],
    requiredApprovals: [],
    maxAutonomyLevel: "trusted_automation",
    evidenceRequirements: ["playbook:config"],
  });

  const proposal = service.createProposal({
    probes: [{ component: "workers", status: "degraded" }],
    errorRate: 0.01,
    backlog: 10,
    currentLoad: 100,
    projectedLoad: 160,
    panicActive: true,
    observedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.deepEqual(proposal.blockedBy, ["ops_agent.action_not_allowed", "ops_agent.blocked_by_panic"]);
  assert.equal(service.execute(proposal.proposalId).executed, false);
});
