import assert from "node:assert/strict";
import test from "node:test";

import { PlatformPanicService } from "../../../src/ops-maturity/emergency/platform-panic-service.js";
import { PlatformOpsAgentService } from "../../../src/ops-maturity/platform-ops-agent/platform-ops-agent-service.js";

test("integration: panic blocks ops execution until resume and approval complete", () => {
  const panicService = new PlatformPanicService();
  const opsService = new PlatformOpsAgentService({
    agentId: "agent_ops_platform",
    specialty: "runtime",
    allowedActionTypes: ["investigate_incident", "scale_capacity"],
    requiredApprovals: ["sre_manager"],
    maxAutonomyLevel: "supervised_execution",
    evidenceRequirements: ["runbook:runtime"],
  });

  panicService.activate({
    scope: "platform/runtime",
    reasonCode: "security.compromise",
    activeIncidents: 2,
    issuedBy: "security_lead",
    issuedAt: "2026-04-20T00:00:00.000Z",
  });

  const blockedProposal = opsService.createProposal({
    probes: [{ component: "runtime", status: "failed" }],
    errorRate: 0.4,
    backlog: 1500,
    currentLoad: 100,
    projectedLoad: 220,
    panicActive: panicService.evaluateExecution({
      scope: "platform/runtime",
      mode: "automation",
    }).blocked,
    observedAt: "2026-04-20T00:01:00.000Z",
  });
  assert.equal(blockedProposal.executable, false);
  assert.ok(blockedProposal.blockedBy.includes("ops_agent.blocked_by_panic"));

  panicService.resume("platform/runtime", {
    scope: "platform/runtime",
    approvedBy: ["sre_manager", "security_lead"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  }, "2026-04-20T00:10:00.000Z");

  const activePanic = panicService.evaluateExecution({
    scope: "platform/runtime",
    mode: "automation",
  }).blocked;
  assert.equal(activePanic, false);

  const resumableProposal = opsService.createProposal({
    probes: [{ component: "runtime", status: "failed" }],
    errorRate: 0.4,
    backlog: 1500,
    currentLoad: 100,
    projectedLoad: 220,
    panicActive: activePanic,
    observedAt: "2026-04-20T00:11:00.000Z",
  });
  const approved = opsService.recordApproval(resumableProposal.proposalId, "sre_manager");
  assert.equal(approved.executable, true);
  assert.equal(opsService.execute(resumableProposal.proposalId).executed, true);
});
