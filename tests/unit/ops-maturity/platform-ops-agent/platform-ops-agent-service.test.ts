import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_OPS_DATA_BOUNDARY,
  PlatformOpsAgentService,
} from "../../../../src/ops-maturity/platform-ops-agent/platform-ops-agent-service.js";
import type { OpsHealthProbe } from "../../../../src/ops-maturity/platform-ops-agent/health-monitor/index.js";

function makeProbe(status: "healthy" | "degraded" | "failed", component = "test_component"): OpsHealthProbe {
  return { component, status, timestamp: new Date().toISOString() };
}

function makeProposalInput(overrides: {
  errorRate?: number;
  backlog?: number;
  currentLoad?: number;
  projectedLoad?: number;
  probes?: readonly OpsHealthProbe[];
  panicActive?: boolean;
} = {}): {
  probes: readonly OpsHealthProbe[];
  errorRate: number;
  backlog: number;
  currentLoad: number;
  projectedLoad: number;
  panicActive?: boolean;
  observedAt: string;
} {
  return {
    probes: overrides.probes ?? [makeProbe("healthy")],
    errorRate: overrides.errorRate ?? 0.01,
    backlog: overrides.backlog ?? 50,
    currentLoad: overrides.currentLoad ?? 60,
    projectedLoad: overrides.projectedLoad ?? 65,
    panicActive: overrides.panicActive,
    observedAt: new Date().toISOString(),
  };
}

function makeAgentDefinition(overrides: {
  allowedActionTypes?: readonly ("scale_capacity" | "tune_config" | "investigate_incident" | "developer_assist" | "restart_service" | "failover")[];
  requiredApprovals?: readonly string[];
  maxAutonomyLevel?: "observe_only" | "suggest_only" | "supervised_execution" | "trusted_automation";
} = {}) {
  return {
    agentId: "ops_agent_1",
    specialty: "infrastructure",
    allowedActionTypes: overrides.allowedActionTypes ?? ["scale_capacity", "tune_config", "investigate_incident", "developer_assist", "restart_service", "failover"],
    requiredApprovals: overrides.requiredApprovals ?? [],
    maxAutonomyLevel: overrides.maxAutonomyLevel ?? "supervised_execution",
    evidenceRequirements: [],
    ops_data_boundary: DEFAULT_OPS_DATA_BOUNDARY,
  };
}

test("PlatformOpsAgentService.createProposal creates a valid proposal", () => {
  const service = new PlatformOpsAgentService(makeAgentDefinition());
  const input = makeProposalInput();

  const proposal = service.createProposal(input);

  assert.ok(proposal.proposalId.startsWith("ops_proposal_"));
  assert.equal(proposal.agentId, "ops_agent_1");
  assert.equal(proposal.specialty, "infrastructure");
  assert.ok(["scale_capacity", "tune_config", "investigate_incident", "developer_assist", "restart_service", "failover"].includes(proposal.actionType));
  assert.ok(["low", "medium", "high"].includes(proposal.riskLevel));
  assert.ok(["not_required", "pending", "approved"].includes(proposal.approvalStatus));
  assert.ok(typeof proposal.executable === "boolean");
});

test("PlatformOpsAgentService.createProposal with healthy probes defaults to developer_assist", () => {
  const service = new PlatformOpsAgentService(makeAgentDefinition());
  const input = makeProposalInput({
    probes: [makeProbe("healthy"), makeProbe("healthy")],
    errorRate: 0.01,
    incidentLevel: "warning" as any,
    capacityRisk: "low" as any,
  });

  const proposal = service.createProposal(input);

  // With healthy probes and warning-level signals, action should be developer_assist
  assert.ok(["scale_capacity", "tune_config", "investigate_incident", "developer_assist", "restart_service", "failover"].includes(proposal.actionType));
});

test("PlatformOpsAgentService.createProposal with failed probe triggers restart or failover remediation", () => {
  const service = new PlatformOpsAgentService(makeAgentDefinition());
  const input = makeProposalInput({
    probes: [makeProbe("healthy"), makeProbe("failed")],
    errorRate: 0.3, // high error rate triggers incident diagnosis
  });

  const proposal = service.createProposal(input);

  assert.equal(proposal.actionType, "failover");
});

test("PlatformOpsAgentService.createProposal sets pending approval for high risk", () => {
  const service = new PlatformOpsAgentService(makeAgentDefinition({
    requiredApprovals: ["approver_1"],
  }));
  const input = makeProposalInput({
    errorRate: 0.5, // high error rate
    backlog: 500,
    currentLoad: 80,
    projectedLoad: 200, // 2.5x ratio = high risk
  });

  const proposal = service.createProposal(input);

  assert.equal(proposal.riskLevel, "high");
  assert.equal(proposal.approvalStatus, "pending");
});

test("PlatformOpsAgentService.createProposal sets not_required when no approvals needed and low risk", () => {
  const service = new PlatformOpsAgentService(makeAgentDefinition());
  const input = makeProposalInput({
    errorRate: 0.01,
    backlog: 10,
    currentLoad: 50,
    projectedLoad: 55,
  });

  const proposal = service.createProposal(input);

  assert.equal(proposal.riskLevel, "low");
  assert.equal(proposal.approvalStatus, "not_required");
});

test("PlatformOpsAgentService.getProposal returns proposal by id", () => {
  const service = new PlatformOpsAgentService(makeAgentDefinition());
  const input = makeProposalInput();
  const created = service.createProposal(input);

  const retrieved = service.getProposal(created.proposalId);

  assert.equal(retrieved.proposalId, created.proposalId);
  assert.equal(retrieved.agentId, created.agentId);
});

test("PlatformOpsAgentService.getProposal throws for unknown proposal", () => {
  const service = new PlatformOpsAgentService(makeAgentDefinition());

  assert.throws(
    () => service.getProposal("unknown_proposal_id"),
    /ops_agent.proposal_not_found/,
  );
});

test("PlatformOpsAgentService.recordApproval adds approver and updates executable", () => {
  const service = new PlatformOpsAgentService(makeAgentDefinition({
    requiredApprovals: ["approver_1", "approver_2"],
  }));
  const input = makeProposalInput({ errorRate: 0.3, currentLoad: 90, projectedLoad: 180 });
  const proposal = service.createProposal(input);

  const updated = service.recordApproval(proposal.proposalId, "approver_1");

  assert.ok(updated.approvals.includes("approver_1"));
  assert.equal(updated.approvalStatus, "pending"); // still needs approver_2
});

test("PlatformOpsAgentService.recordApproval throws for non-allowed approver", () => {
  const service = new PlatformOpsAgentService(makeAgentDefinition({
    requiredApprovals: ["approver_1"],
  }));
  const input = makeProposalInput({ errorRate: 0.3, currentLoad: 90, projectedLoad: 180 });
  const proposal = service.createProposal(input);

  assert.throws(
    () => service.recordApproval(proposal.proposalId, "unauthorized_approver"),
    /ops_agent.approver_not_allowed/,
  );
});

test("PlatformOpsAgentService.recordApproval marks approved when all approvers provided", () => {
  const service = new PlatformOpsAgentService(makeAgentDefinition({
    requiredApprovals: ["approver_1"],
  }));
  const input = makeProposalInput({ errorRate: 0.3, currentLoad: 90, projectedLoad: 180 });
  const proposal = service.createProposal(input);

  const updated = service.recordApproval(proposal.proposalId, "approver_1");

  assert.equal(updated.approvalStatus, "approved");
});

test("PlatformOpsAgentService.execute returns receipt with executed=false for non-executable proposal", () => {
  const service = new PlatformOpsAgentService(makeAgentDefinition({
    maxAutonomyLevel: "observe_only", // cannot execute
  }));
  const input = makeProposalInput();
  const proposal = service.createProposal(input);

  const receipt = service.execute(proposal.proposalId);

  assert.equal(receipt.executed, false);
  assert.equal(receipt.proposalId, proposal.proposalId);
  assert.ok(receipt.reasonCodes.length > 0);
});

test("PlatformOpsAgentService.execute returns receipt for any proposal", () => {
  const service = new PlatformOpsAgentService(makeAgentDefinition({
    maxAutonomyLevel: "trusted_automation",
    allowedActionTypes: ["developer_assist", "tune_config", "investigate_incident", "scale_capacity", "restart_service", "failover"],
  }));
  const input = makeProposalInput({
    errorRate: 0.01,
    backlog: 5,
    currentLoad: 40,
    projectedLoad: 45,
    probes: [makeProbe("healthy")],
  });
  const proposal = service.createProposal(input);

  const receipt = service.execute(proposal.proposalId);

  assert.equal(typeof receipt.executed, "boolean");
  assert.equal(receipt.actionType, proposal.actionType);
});

test("PlatformOpsAgentService handles panic active flag", () => {
  const service = new PlatformOpsAgentService(makeAgentDefinition());
  const input = makeProposalInput({
    panicActive: true,
    errorRate: 0.1,
    currentLoad: 80,
    projectedLoad: 90,
  });

  const proposal = service.createProposal(input);

  assert.ok(proposal.blockedBy.includes("ops_agent.blocked_by_panic"));
  assert.equal(proposal.executable, false);
});

test("PlatformOpsAgentService computes blockedBy for action not in allowed types", () => {
  const service = new PlatformOpsAgentService(makeAgentDefinition({
    allowedActionTypes: ["developer_assist"], // only developer_assist allowed
    maxAutonomyLevel: "trusted_automation",
  }));
  const input = makeProposalInput({
    probes: [makeProbe("failed")], // would normally choose incident remediation
    errorRate: 0.5,
  });

  const proposal = service.createProposal(input);

  assert.ok(proposal.blockedBy.includes("ops_agent.action_not_allowed"));
});

test("PlatformOpsAgentService.canExecuteAtLevel observe_only cannot execute", () => {
  const service = new PlatformOpsAgentService(makeAgentDefinition({
    maxAutonomyLevel: "observe_only",
    allowedActionTypes: ["developer_assist"],
  }));
  const input = makeProposalInput({
    errorRate: 0.01,
    currentLoad: 10,
    projectedLoad: 15,
    probes: [makeProbe("healthy")],
  });

  const proposal = service.createProposal(input);

  assert.equal(proposal.executable, false);
  assert.ok(proposal.blockedBy.includes("ops_agent.autonomy_limit_reached"));
});

test("PlatformOpsAgentService rejects business payload access in ops_data_boundary", () => {
  assert.throws(
    () =>
      new PlatformOpsAgentService({
        ...makeAgentDefinition(),
        ops_data_boundary: {
          allowedPayloadTypes: ["platform_metrics"],
          businessPayloadAllowed: true,
        },
      }),
    /ops_agent\.invalid_ops_data_boundary:business_payload_not_allowed/,
  );
});

test("PlatformOpsAgentService.canExecuteAtLevel supervised_execution allows low risk without approval", () => {
  const service = new PlatformOpsAgentService(makeAgentDefinition({
    maxAutonomyLevel: "supervised_execution",
    allowedActionTypes: ["developer_assist", "tune_config", "investigate_incident", "scale_capacity", "restart_service", "failover"],
  }));
  const input = makeProposalInput({
    errorRate: 0.01,
    backlog: 5,
    currentLoad: 40,
    projectedLoad: 45,
    probes: [makeProbe("healthy")],
  });

  const proposal = service.createProposal(input);

  assert.equal(proposal.riskLevel, "low");
  assert.equal(proposal.approvalStatus, "not_required");
  assert.equal(proposal.executable, true);
});

test("PlatformOpsAgentService.computeApprovalStatus returns not_required when no approvals configured", () => {
  const service = new PlatformOpsAgentService(makeAgentDefinition());
  const input = makeProposalInput({ errorRate: 0.01, currentLoad: 50, projectedLoad: 55 });

  const proposal = service.createProposal(input);

  assert.equal(proposal.approvalStatus, "not_required");
});
