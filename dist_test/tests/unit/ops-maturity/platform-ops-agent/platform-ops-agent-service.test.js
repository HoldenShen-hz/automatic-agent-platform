/**
 * Unit tests for PlatformOpsAgentService
 */
import assert from "node:assert/strict";
import test from "node:test";
import { PlatformOpsAgentService, } from "../../../../src/ops-maturity/platform-ops-agent/platform-ops-agent-service.js";
function createHealthProbe(overrides = {}) {
    return {
        component: "test-component",
        status: "healthy",
        ...overrides,
    };
}
function createOpsAgentDefinition(overrides = {}) {
    return {
        agentId: "ops_agent_1",
        specialty: "platform_operations",
        allowedActionTypes: ["scale_capacity", "tune_config", "investigate_incident", "developer_assist"],
        requiredApprovals: [],
        maxAutonomyLevel: "supervised_execution",
        evidenceRequirements: ["health_check", "error_rate"],
        ...overrides,
    };
}
function createOpsSignalInput(overrides = {}) {
    return {
        probes: [createHealthProbe()],
        errorRate: 0.01,
        backlog: 10,
        currentLoad: 50,
        projectedLoad: 60,
        ...overrides,
    };
}
test("PlatformOpsAgentService creates proposal for warning-level incident", () => {
    const service = new PlatformOpsAgentService(createOpsAgentDefinition());
    const input = createOpsSignalInput({
        probes: [createHealthProbe({ status: "degraded" })],
        errorRate: 0.05,
        backlog: 100,
    });
    const proposal = service.createProposal(input);
    assert.equal(proposal.actionType, "investigate_incident");
    assert.equal(proposal.riskLevel, "medium");
    assert.equal(proposal.incidentLevel, "incident");
    assert.ok(proposal.executable);
});
test("PlatformOpsAgentService creates proposal for capacity scaling", () => {
    const service = new PlatformOpsAgentService(createOpsAgentDefinition());
    const input = createOpsSignalInput({
        currentLoad: 90,
        projectedLoad: 120,
    });
    const proposal = service.createProposal(input);
    assert.equal(proposal.actionType, "scale_capacity");
    assert.equal(proposal.riskLevel, "medium");
});
test("PlatformOpsAgentService creates proposal for config tuning", () => {
    const service = new PlatformOpsAgentService(createOpsAgentDefinition());
    const input = createOpsSignalInput({
        configTarget: {
            key: "pool_size",
            currentValue: 10,
            recommendedValue: 20,
        },
    });
    const proposal = service.createProposal(input);
    assert.equal(proposal.actionType, "tune_config");
    assert.equal(proposal.riskLevel, "medium");
});
test("PlatformOpsAgentService blocks execution when panic is active", () => {
    const service = new PlatformOpsAgentService(createOpsAgentDefinition());
    const input = createOpsSignalInput({ panicActive: true });
    const proposal = service.createProposal(input);
    assert.ok(proposal.blockedBy.includes("ops_agent.blocked_by_panic"));
    assert.equal(proposal.executable, false);
});
test("PlatformOpsAgentService marks high-risk proposals as pending approval", () => {
    const service = new PlatformOpsAgentService(createOpsAgentDefinition({
        requiredApprovals: ["ops_admin"],
    }));
    const input = createOpsSignalInput({
        errorRate: 0.5,
        backlog: 1000,
    });
    const proposal = service.createProposal(input);
    assert.equal(proposal.riskLevel, "high");
    assert.equal(proposal.approvalStatus, "pending");
    assert.equal(proposal.executable, false);
});
test("PlatformOpsAgentService records approval and updates executable status", () => {
    const service = new PlatformOpsAgentService(createOpsAgentDefinition({
        requiredApprovals: ["ops_admin"],
        maxAutonomyLevel: "supervised_execution",
    }));
    const input = createOpsSignalInput({
        errorRate: 0.3,
        backlog: 500,
    });
    const proposal = service.createProposal(input);
    assert.equal(proposal.executable, false);
    assert.equal(proposal.approvalStatus, "pending");
    const updated = service.recordApproval(proposal.proposalId, "ops_admin");
    assert.equal(updated.approvalStatus, "approved");
    assert.equal(updated.executable, true);
});
test("PlatformOpsAgentService observe_only agent cannot execute", () => {
    const service = new PlatformOpsAgentService(createOpsAgentDefinition({
        maxAutonomyLevel: "observe_only",
    }));
    const input = createOpsSignalInput();
    const proposal = service.createProposal(input);
    assert.ok(proposal.blockedBy.includes("ops_agent.observe_only"));
    assert.equal(proposal.executable, false);
});
test("PlatformOpsAgentService suggest_only agent cannot execute", () => {
    const service = new PlatformOpsAgentService(createOpsAgentDefinition({
        maxAutonomyLevel: "suggest_only",
    }));
    const input = createOpsSignalInput();
    const proposal = service.createProposal(input);
    assert.ok(proposal.blockedBy.includes("ops_agent.observe_only"));
    assert.equal(proposal.executable, false);
});
test("PlatformOpsAgentService supervised_execution agent can only execute low-risk", () => {
    const service = new PlatformOpsAgentService(createOpsAgentDefinition({
        maxAutonomyLevel: "supervised_execution",
    }));
    const lowRiskInput = createOpsSignalInput({
        errorRate: 0.001,
        backlog: 5,
    });
    const lowRiskProposal = service.createProposal(lowRiskInput);
    assert.equal(lowRiskProposal.riskLevel, "low");
    assert.equal(lowRiskProposal.executable, true);
    const highRiskInput = createOpsSignalInput({
        errorRate: 0.5,
        backlog: 1000,
    });
    const highRiskProposal = service.createProposal(highRiskInput);
    assert.equal(highRiskProposal.riskLevel, "high");
    assert.equal(highRiskProposal.executable, false);
});
test("PlatformOpsAgentService trusted_automation can execute medium-risk", () => {
    const service = new PlatformOpsAgentService(createOpsAgentDefinition({
        maxAutonomyLevel: "trusted_automation",
    }));
    const mediumRiskInput = createOpsSignalInput({
        errorRate: 0.1,
        backlog: 200,
    });
    const proposal = service.createProposal(mediumRiskInput);
    assert.equal(proposal.riskLevel, "medium");
    assert.equal(proposal.maturityLevel, "trusted_automation");
    assert.equal(proposal.executable, true);
});
test("PlatformOpsAgentService execute returns receipt with reason codes", () => {
    const service = new PlatformOpsAgentService(createOpsAgentDefinition());
    const input = createOpsSignalInput();
    const proposal = service.createProposal(input);
    const receipt = service.execute(proposal.proposalId);
    assert.equal(receipt.executed, true);
    assert.deepEqual(receipt.reasonCodes, ["ops_agent.executed"]);
});
test("PlatformOpsAgentService execute fails for non-executable proposal", () => {
    const service = new PlatformOpsAgentService(createOpsAgentDefinition({
        maxAutonomyLevel: "observe_only",
    }));
    const input = createOpsSignalInput();
    const proposal = service.createProposal(input);
    const receipt = service.execute(proposal.proposalId);
    assert.equal(receipt.executed, false);
    assert.ok(receipt.reasonCodes.some((code) => code.includes("ops_agent.observe_only")));
});
test("PlatformOpsAgentService getProposal returns stored proposal", () => {
    const service = new PlatformOpsAgentService(createOpsAgentDefinition());
    const input = createOpsSignalInput();
    const original = service.createProposal(input);
    const retrieved = service.getProposal(original.proposalId);
    assert.ok(retrieved !== null);
    assert.equal(retrieved?.proposalId, original.proposalId);
    assert.equal(retrieved?.actionType, original.actionType);
});
test("PlatformOpsAgentService critical incident has high risk", () => {
    const service = new PlatformOpsAgentService(createOpsAgentDefinition());
    const input = createOpsSignalInput({
        errorRate: 0.8,
        backlog: 5000,
    });
    const proposal = service.createProposal(input);
    assert.equal(proposal.riskLevel, "high");
    assert.equal(proposal.incidentLevel, "critical_incident");
});
test("PlatformOpsAgentService throws for missing proposal", () => {
    const service = new PlatformOpsAgentService(createOpsAgentDefinition());
    assert.throws(() => service.recordApproval("nonexistent_id", "admin"), /ops_agent.proposal_not_found/);
});
//# sourceMappingURL=platform-ops-agent-service.test.js.map