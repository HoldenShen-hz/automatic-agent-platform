import assert from "node:assert/strict";
import test from "node:test";
import { PromotionGate, DEFAULT_PROMOTION_GATE_CONFIG } from "../../../../src/ops-maturity/drift-detection/promotion-gate.js";
function createProposal(overrides = {}) {
    return {
        id: "prop_1",
        title: "Test Proposal",
        description: "Test description",
        kind: "tool_routing_rule",
        target: "test",
        patch: "test patch",
        rationale: "test rationale",
        risk: "low",
        evidenceIds: [],
        status: "proposed",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        ...overrides,
    };
}
function createReport(overrides = {}) {
    return {
        proposalId: "prop_1",
        benchmarkCases: 10,
        successRateBefore: 0.7,
        successRateAfter: 0.75,
        regressionRate: 0,
        avgCostDelta: 0,
        avgLatencyDelta: 0,
        safetyViolations: 0,
        decision: "promote",
        createdAt: "2026-04-14T00:00:00.000Z",
        ...overrides,
    };
}
test("PromotionGate uses DEFAULT_PROMOTION_GATE_CONFIG values", () => {
    assert.equal(DEFAULT_PROMOTION_GATE_CONFIG.minSuccessLift, 0.03);
    assert.equal(DEFAULT_PROMOTION_GATE_CONFIG.maxRegressionRate, 0.01);
    assert.equal(DEFAULT_PROMOTION_GATE_CONFIG.maxCostIncrease, 0.10);
    assert.equal(DEFAULT_PROMOTION_GATE_CONFIG.maxLatencyIncrease, 0.15);
    assert.equal(DEFAULT_PROMOTION_GATE_CONFIG.maxSafetyViolations, 0);
});
test("PromotionGate.decide allows promotion with positive metrics", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ risk: "low" });
    const report = createReport({
        successRateBefore: 0.7,
        successRateAfter: 0.75,
        avgCostDelta: 0.05,
        avgLatencyDelta: 0.10,
    });
    const decision = gate.decide(proposal, report, false);
    assert.equal(decision.allowed, true);
    assert.equal(decision.reasons.length, 0);
});
test("PromotionGate.decide rejects frozen proposals", () => {
    const gate = new PromotionGate();
    const proposal = createProposal();
    const report = createReport();
    const decision = gate.decide(proposal, report, true);
    assert.equal(decision.allowed, false);
    assert.ok(decision.reasons.includes("Evolution system is frozen"));
    assert.equal(decision.stage, "rejected");
});
test("PromotionGate.decide rejects high-risk proposals", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ risk: "high" });
    const report = createReport();
    const decision = gate.decide(proposal, report, false);
    assert.equal(decision.allowed, false);
    assert.ok(decision.reasons.includes("High-risk proposals require manual approval"));
    assert.equal(decision.stage, "rejected");
});
test("PromotionGate.decide rejects insufficient success lift", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ risk: "low" });
    const report = createReport({
        successRateBefore: 0.7,
        successRateAfter: 0.72, // Only 2% lift, less than 3% required
    });
    const decision = gate.decide(proposal, report, false);
    assert.equal(decision.allowed, false);
    assert.ok(decision.reasons.some(r => r.includes("Insufficient success lift")));
});
test("PromotionGate.decide rejects high regression rate", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ risk: "low" });
    const report = createReport({
        regressionRate: 0.05, // 5% regression, greater than 1% max
    });
    const decision = gate.decide(proposal, report, false);
    assert.equal(decision.allowed, false);
    assert.ok(decision.reasons.some(r => r.includes("Regression rate too high")));
});
test("PromotionGate.decide rejects high cost increase", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ risk: "low" });
    const report = createReport({
        avgCostDelta: 0.15, // 15% increase, greater than 10% max
    });
    const decision = gate.decide(proposal, report, false);
    assert.equal(decision.allowed, false);
    assert.ok(decision.reasons.some(r => r.includes("Cost increase too high")));
});
test("PromotionGate.decide rejects high latency increase", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ risk: "low" });
    const report = createReport({
        avgLatencyDelta: 0.20, // 20% increase, greater than 15% max
    });
    const decision = gate.decide(proposal, report, false);
    assert.equal(decision.allowed, false);
    assert.ok(decision.reasons.some(r => r.includes("Latency increase too high")));
});
test("PromotionGate.decide rejects safety violations", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ risk: "low" });
    const report = createReport({
        safetyViolations: 1,
    });
    const decision = gate.decide(proposal, report, false);
    assert.equal(decision.allowed, false);
    assert.ok(decision.reasons.some(r => r.includes("Safety violations detected")));
});
test("PromotionGate.decide advances stage from testing to canary", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ risk: "low" });
    const report = createReport();
    const decision = gate.decide(proposal, report, false, "testing");
    assert.equal(decision.allowed, true);
    assert.equal(decision.stage, "canary");
});
test("PromotionGate.decide advances stage from canary to active", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ risk: "low" });
    const report = createReport();
    const decision = gate.decide(proposal, report, false, "canary");
    assert.equal(decision.allowed, true);
    assert.equal(decision.stage, "active");
});
test("PromotionGate.decide starts from testing when no currentStage", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ risk: "low" });
    const report = createReport();
    const decision = gate.decide(proposal, report, false);
    assert.equal(decision.allowed, true);
    assert.equal(decision.stage, "testing");
});
test("PromotionGate.canAutoPromote returns true for low-risk proposals", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ risk: "low" });
    assert.equal(gate.canAutoPromote(proposal), true);
});
test("PromotionGate.canAutoPromote returns false for high-risk proposals", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ risk: "high" });
    assert.equal(gate.canAutoPromote(proposal), false);
});
test("PromotionGate.canAutoPromote returns false for medium-risk proposals", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ risk: "medium" });
    assert.equal(gate.canAutoPromote(proposal), false);
});
test("PromotionGate.requiresManualGate returns true for high-risk proposals", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ risk: "high" });
    assert.equal(gate.requiresManualGate(proposal), true);
});
test("PromotionGate.requiresManualGate returns true for prompt_patch", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ kind: "prompt_patch" });
    assert.equal(gate.requiresManualGate(proposal), true);
});
test("PromotionGate.requiresManualGate returns true for workflow_template", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ kind: "workflow_template" });
    assert.equal(gate.requiresManualGate(proposal), true);
});
test("PromotionGate.requiresManualGate returns true for threshold_tuning", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ kind: "threshold_tuning" });
    assert.equal(gate.requiresManualGate(proposal), true);
});
test("PromotionGate.requiresManualGate returns false for tool_routing_rule", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ kind: "tool_routing_rule" });
    assert.equal(gate.requiresManualGate(proposal), false);
});
test("PromotionGate.requiresManualGate returns false for skill_doc", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ kind: "skill_doc" });
    assert.equal(gate.requiresManualGate(proposal), false);
});
test("PromotionGate uses custom config", () => {
    const customConfig = {
        minSuccessLift: 0.10, // 10% required
        maxRegressionRate: 0.05,
        maxCostIncrease: 0.20,
        maxLatencyIncrease: 0.25,
        maxSafetyViolations: 2,
    };
    const gate = new PromotionGate(customConfig);
    const proposal = createProposal({ risk: "low" });
    const report = createReport({
        successRateBefore: 0.7,
        successRateAfter: 0.78, // 8% lift - passes 10% threshold with custom config
    });
    const decision = gate.decide(proposal, report, false);
    // With custom config requiring 10% lift, 8% should fail
    assert.equal(decision.allowed, false);
});
test("PromotionGate.decide accumulates multiple reasons", () => {
    const gate = new PromotionGate();
    const proposal = createProposal({ risk: "low" });
    const report = createReport({
        successRateBefore: 0.7,
        successRateAfter: 0.71, // Only 1% lift - fails
        avgCostDelta: 0.15, // 15% cost increase - fails
        avgLatencyDelta: 0.20, // 20% latency increase - fails
    });
    const decision = gate.decide(proposal, report, false);
    assert.equal(decision.allowed, false);
    assert.ok(decision.reasons.length >= 3);
});
//# sourceMappingURL=promotion-gate.test.js.map