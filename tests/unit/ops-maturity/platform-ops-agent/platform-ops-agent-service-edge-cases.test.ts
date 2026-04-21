/**
 * Unit tests for PlatformOpsAgentService - edge cases and additional coverage
 *
 * @see src/ops-maturity/platform-ops-agent/platform-ops-agent-service.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { PlatformOpsAgentService } from "../../../../src/ops-maturity/platform-ops-agent/platform-ops-agent-service.js";

function createService(overrides: Partial<Parameters<typeof PlatformOpsAgentService>[0]> = {}) {
  return new PlatformOpsAgentService({
    agentId: "test_ops_agent",
    specialty: "test_specialty",
    allowedActionTypes: ["investigate_incident", "scale_capacity", "tune_config", "developer_assist"],
    requiredApprovals: [],
    maxAutonomyLevel: "trusted_automation",
    evidenceRequirements: ["evidence:test"],
    ...overrides,
  });
}

describe("PlatformOpsAgentService - Edge Cases", () => {
  describe("createProposal", () => {
    test("warning-level incident with no capacity risk returns developer_assist action", () => {
      const service = createService();
      const proposal = service.createProposal({
        probes: [{ component: "workers", status: "healthy" }],
        errorRate: 0.01,
        backlog: 50,
        currentLoad: 100,
        projectedLoad: 110,
      });

      assert.equal(proposal.actionType, "developer_assist");
      assert.equal(proposal.incidentLevel, "warning");
      assert.equal(proposal.capacityRisk, "low");
      assert.equal(proposal.healthStatus, "healthy");
    });

    test("incident-level error rate triggers investigate_incident", () => {
      const service = createService();
      const proposal = service.createProposal({
        probes: [{ component: "db", status: "degraded" }],
        errorRate: 0.08,
        backlog: 100,
        currentLoad: 80,
        projectedLoad: 90,
      });

      assert.equal(proposal.actionType, "investigate_incident");
      assert.equal(proposal.incidentLevel, "incident");
    });

    test("critical incident with high error rate returns critical_incident level", () => {
      const service = createService();
      const proposal = service.createProposal({
        probes: [{ component: "queue", status: "failed" }],
        errorRate: 0.25,
        backlog: 1500,
        currentLoad: 100,
        projectedLoad: 200,
      });

      assert.equal(proposal.incidentLevel, "critical_incident");
      assert.equal(proposal.actionType, "investigate_incident");
    });

    test("high capacity ratio triggers scale_capacity action", () => {
      const service = createService();
      const proposal = service.createProposal({
        probes: [{ component: "workers", status: "healthy" }],
        errorRate: 0.01,
        backlog: 50,
        currentLoad: 50,
        projectedLoad: 150,
      });

      assert.equal(proposal.actionType, "scale_capacity");
      assert.equal(proposal.capacityRisk, "high");
    });

    test("degraded health status with warning incident triggers tune_config", () => {
      const service = createService();
      const proposal = service.createProposal({
        probes: [{ component: "workers", status: "degraded" }],
        errorRate: 0.01,
        backlog: 50,
        currentLoad: 100,
        projectedLoad: 110,
      });

      assert.equal(proposal.actionType, "tune_config");
      assert.equal(proposal.healthStatus, "degraded");
    });

    test("elevated error rate adds signal reason code", () => {
      const service = createService();
      const proposal = service.createProposal({
        probes: [{ component: "api", status: "degraded" }],
        errorRate: 0.06,
        backlog: 100,
        currentLoad: 100,
        projectedLoad: 100,
      });

      assert.ok(proposal.reasonCodes.includes("ops_agent.signal.error_rate_elevated"));
    });

    test("elevated backlog adds signal reason code", () => {
      const service = createService();
      const proposal = service.createProposal({
        probes: [{ component: "queue", status: "degraded" }],
        errorRate: 0.01,
        backlog: 250,
        currentLoad: 100,
        projectedLoad: 100,
      });

      assert.ok(proposal.reasonCodes.includes("ops_agent.signal.backlog_elevated"));
    });

    test("high risk level requires approval when requiredApprovals is non-empty", () => {
      const service = createService({
        requiredApprovals: ["manager"],
        maxAutonomyLevel: "supervised_execution",
      });
      const proposal = service.createProposal({
        probes: [{ component: "db", status: "failed" }],
        errorRate: 0.3,
        backlog: 1200,
        currentLoad: 100,
        projectedLoad: 300,
      });

      assert.equal(proposal.riskLevel, "high");
      assert.equal(proposal.approvalStatus, "pending");
    });

    test("medium risk level triggers medium risk classification", () => {
      const service = createService();
      const proposal = service.createProposal({
        probes: [{ component: "workers", status: "degraded" }],
        errorRate: 0.01,
        backlog: 50,
        currentLoad: 100,
        projectedLoad: 130,
      });

      assert.equal(proposal.riskLevel, "medium");
    });

    test("proposal stores agent definition specialty and agentId", () => {
      const service = createService({ agentId: "custom_agent_id", specialty: "custom_specialty" });
      const proposal = service.createProposal({
        probes: [],
        errorRate: 0.01,
        backlog: 50,
        currentLoad: 100,
        projectedLoad: 110,
      });

      assert.equal(proposal.agentId, "custom_agent_id");
      assert.equal(proposal.specialty, "custom_specialty");
    });

    test("observedAt defaults to nowIso when not provided", () => {
      const service = createService();
      const before = new Date().toISOString();
      const proposal = service.createProposal({
        probes: [],
        errorRate: 0.01,
        backlog: 50,
        currentLoad: 100,
        projectedLoad: 110,
      });
      const after = new Date().toISOString();

      assert.ok(proposal.observedAt >= before);
      assert.ok(proposal.observedAt <= after);
    });

    test("observedAt uses provided value when given", () => {
      const service = createService();
      const proposal = service.createProposal({
        probes: [],
        errorRate: 0.01,
        backlog: 50,
        currentLoad: 100,
        projectedLoad: 110,
        observedAt: "2026-01-01T00:00:00.000Z",
      });

      assert.equal(proposal.observedAt, "2026-01-01T00:00:00.000Z");
    });
  });

  describe("getProposal", () => {
    test("throws Error with proposal_not_found code for unknown id", () => {
      const service = createService();
      assert.throws(
        () => service.getProposal("nonexistent_id"),
        /ops_agent\.proposal_not_found/,
      );
    });

    test("returns same proposal that was created", () => {
      const service = createService();
      const created = service.createProposal({
        probes: [],
        errorRate: 0.01,
        backlog: 50,
        currentLoad: 100,
        projectedLoad: 110,
      });

      const retrieved = service.getProposal(created.proposalId);
      assert.equal(retrieved.proposalId, created.proposalId);
      assert.equal(retrieved.actionType, created.actionType);
    });
  });

  describe("recordApproval", () => {
    test("throws when approver is not in requiredApprovals list", () => {
      const service = createService({ requiredApprovals: ["manager", "director"] });
      const proposal = service.createProposal({
        probes: [{ component: "db", status: "failed" }],
        errorRate: 0.3,
        backlog: 1200,
        currentLoad: 100,
        projectedLoad: 300,
      });

      assert.throws(
        () => service.recordApproval(proposal.proposalId, "unauthorized_user"),
        /ops_agent\.approver_not_allowed/,
      );
    });

    test("same approver recorded twice does not duplicate approvals", () => {
      const service = createService({ requiredApprovals: ["manager", "director"] });
      const proposal = service.createProposal({
        probes: [{ component: "db", status: "failed" }],
        errorRate: 0.3,
        backlog: 1200,
        currentLoad: 100,
        projectedLoad: 300,
      });

      const first = service.recordApproval(proposal.proposalId, "manager");
      const second = service.recordApproval(proposal.proposalId, "manager");

      assert.equal(second.approvals.length, first.approvals.length);
    });

    test("approvalStatus becomes approved when all required approvers have approved", () => {
      const service = createService({ requiredApprovals: ["manager", "director"] });
      const proposal = service.createProposal({
        probes: [{ component: "db", status: "failed" }],
        errorRate: 0.3,
        backlog: 1200,
        currentLoad: 100,
        projectedLoad: 300,
      });

      assert.equal(proposal.approvalStatus, "pending");
      const afterManager = service.recordApproval(proposal.proposalId, "manager");
      assert.equal(afterManager.approvalStatus, "pending");
      const afterDirector = service.recordApproval(proposal.proposalId, "director");
      assert.equal(afterDirector.approvalStatus, "approved");
    });
  });

  describe("execute", () => {
    test("executed is false when proposal is not executable", () => {
      const service = createService({ maxAutonomyLevel: "observe_only" });
      const proposal = service.createProposal({
        probes: [{ component: "db", status: "failed" }],
        errorRate: 0.3,
        backlog: 1200,
        currentLoad: 100,
        projectedLoad: 200,
      });

      const receipt = service.execute(proposal.proposalId);
      assert.equal(receipt.executed, false);
    });

    test("executed is true when proposal is executable", () => {
      const service = createService({
        allowedActionTypes: ["investigate_incident"],
        requiredApprovals: [],
        maxAutonomyLevel: "trusted_automation",
      });
      const proposal = service.createProposal({
        probes: [{ component: "db", status: "failed" }],
        errorRate: 0.3,
        backlog: 1200,
        currentLoad: 100,
        projectedLoad: 200,
      });

      const receipt = service.execute(proposal.proposalId);
      assert.equal(receipt.executed, true);
    });

    test("executedAt is a valid ISO timestamp", () => {
      const service = createService();
      const proposal = service.createProposal({
        probes: [{ component: "workers", status: "healthy" }],
        errorRate: 0.01,
        backlog: 50,
        currentLoad: 100,
        projectedLoad: 110,
      });

      const before = new Date().toISOString();
      const receipt = service.execute(proposal.proposalId);
      const after = new Date().toISOString();

      assert.ok(receipt.executedAt >= before);
      assert.ok(receipt.executedAt <= after);
    });
  });

  describe("OpsMaturityLevel autonomy limits", () => {
    test("observe_only never allows execution", () => {
      const service = createService({ maxAutonomyLevel: "observe_only" });
      const proposal = service.createProposal({
        probes: [{ component: "workers", status: "healthy" }],
        errorRate: 0.01,
        backlog: 10,
        currentLoad: 100,
        projectedLoad: 110,
      });

      assert.equal(proposal.executable, false);
    });

    test("suggest_only never allows execution", () => {
      const service = createService({ maxAutonomyLevel: "suggest_only" });
      const proposal = service.createProposal({
        probes: [{ component: "workers", status: "healthy" }],
        errorRate: 0.01,
        backlog: 10,
        currentLoad: 100,
        projectedLoad: 110,
      });

      assert.equal(proposal.executable, false);
    });

    test("supervised_execution only allows low-risk execution", () => {
      const service = createService({ maxAutonomyLevel: "supervised_execution" });
      const lowRiskProposal = service.createProposal({
        probes: [{ component: "workers", status: "healthy" }],
        errorRate: 0.01,
        backlog: 10,
        currentLoad: 100,
        projectedLoad: 110,
      });

      assert.equal(lowRiskProposal.executable, true);
    });

    test("trusted_automation allows medium-risk but not high-risk", () => {
      const service = createService({ maxAutonomyLevel: "trusted_automation" });
      const mediumProposal = service.createProposal({
        probes: [{ component: "workers", status: "degraded" }],
        errorRate: 0.01,
        backlog: 50,
        currentLoad: 100,
        projectedLoad: 130,
      });

      assert.equal(mediumProposal.riskLevel, "medium");
      assert.equal(mediumProposal.executable, true);

      const highProposal = service.createProposal({
        probes: [{ component: "db", status: "failed" }],
        errorRate: 0.3,
        backlog: 1200,
        currentLoad: 100,
        projectedLoad: 300,
      });

      assert.equal(highProposal.riskLevel, "high");
      assert.equal(highProposal.executable, false);
    });
  });

  describe("blockedBy", () => {
    test("action not in allowedActionTypes adds blocker", () => {
      const service = createService({ allowedActionTypes: ["developer_assist"] });
      const proposal = service.createProposal({
        probes: [{ component: "db", status: "failed" }],
        errorRate: 0.3,
        backlog: 1200,
        currentLoad: 100,
        projectedLoad: 200,
      });

      assert.ok(proposal.blockedBy.includes("ops_agent.action_not_allowed"));
    });

    test("panicActive adds blocker", () => {
      const service = createService();
      const proposal = service.createProposal({
        probes: [{ component: "workers", status: "healthy" }],
        errorRate: 0.01,
        backlog: 50,
        currentLoad: 100,
        projectedLoad: 110,
        panicActive: true,
      });

      assert.ok(proposal.blockedBy.includes("ops_agent.blocked_by_panic"));
    });

    test("autonomy limit reached adds blocker", () => {
      const service = createService({ maxAutonomyLevel: "supervised_execution" });
      const proposal = service.createProposal({
        probes: [{ component: "db", status: "failed" }],
        errorRate: 0.3,
        backlog: 1200,
        currentLoad: 100,
        projectedLoad: 200,
      });

      assert.ok(proposal.blockedBy.includes("ops_agent.autonomy_limit_reached"));
    });

    test("multiple blockers can be present", () => {
      const service = createService({ allowedActionTypes: ["developer_assist"] });
      const proposal = service.createProposal({
        probes: [{ component: "db", status: "failed" }],
        errorRate: 0.3,
        backlog: 1200,
        currentLoad: 100,
        projectedLoad: 200,
        panicActive: true,
      });

      assert.ok(proposal.blockedBy.length >= 2);
    });
  });
});
