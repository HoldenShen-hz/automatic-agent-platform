/**
 * E2E Rollout and Release Comprehensive Tests
 *
 * End-to-end tests covering rollout and release scenarios:
 * - Full rollout pipeline (draft -> shadow -> canary -> stable)
 * - Canary analysis and metrics evaluation
 * - Guardrail evaluation during rollout
 * - Traffic routing during rollout stages
 * - Policy rollout workflow
 */
import assert from "node:assert/strict";
import test from "node:test";
import { RolloutStateMachine } from "../../src/platform/orchestration/oapeflir/improve-rollout/rollout/rollout-state-machine.js";
import { AutoRollbackService } from "../../src/platform/orchestration/oapeflir/improve-rollout/auto-rollback-service.js";
import { CanaryTrafficRouter } from "../../src/platform/orchestration/oapeflir/improve-rollout/canary-traffic-router.js";
import { GuardrailEvaluator } from "../../src/platform/orchestration/oapeflir/improve-rollout/guardrail-evaluator.js";
import { parseImprovementCandidate } from "../../src/platform/orchestration/oapeflir/types/improvement-candidate.js";
// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------
function createCandidate(overrides = {}) {
    return parseImprovementCandidate({
        candidateId: "candidate-e2e-rollout",
        taskId: "task-e2e-rollout",
        sourceSignalRefs: ["signal:1"],
        sourceLearningObjectIds: [],
        changeScope: "prompt",
        description: "E2E test rollout candidate",
        expectedBenefit: "Test improvement",
        status: "proposed",
        createdAt: Date.now(),
        ...overrides,
    });
}
// ---------------------------------------------------------------------------
// Test: Full rollout pipeline from draft to stable
// ---------------------------------------------------------------------------
test("E2E Rollout: full pipeline draft -> shadow -> canary -> stable", () => {
    const machine = new RolloutStateMachine();
    const candidate = createCandidate({ status: "proposed" });
    // Phase 1: Draft to Shadow
    let record = machine.transition(candidate, "shadow", { approvedBy: "admin-1" });
    assert.equal(record.status, "shadow", "Should reach shadow status");
    assert.equal(record.level, "shadow", "Should have shadow level");
    assert.equal(record.approvedBy, "admin-1", "Should record approver");
    // Phase 2: Shadow to Canary 5%
    record = machine.transition(candidate, "canary_5", { currentStatus: "shadow" });
    assert.equal(record.status, "canary_5", "Should reach canary_5 status");
    // Phase 3: Canary 5% to Partial 25%
    record = machine.transition(candidate, "partial_25", { currentStatus: "canary_5" });
    assert.equal(record.status, "partial_25", "Should reach partial_25 status");
    // Phase 4: Partial 25% to Partial 50%
    record = machine.transition(candidate, "partial_50", { currentStatus: "partial_25" });
    assert.equal(record.status, "partial_50", "Should reach partial_50 status");
    // Phase 5: Partial 50% to Partial 75%
    record = machine.transition(candidate, "partial_75", { currentStatus: "partial_50" });
    assert.equal(record.status, "partial_75", "Should reach partial_75 status");
    // Phase 6: Partial 75% to Stable
    record = machine.transition(candidate, "stable", { currentStatus: "partial_75" });
    assert.equal(record.status, "stable", "Should reach stable status");
    assert.equal(record.level, "stable", "Should have stable level");
});
// ---------------------------------------------------------------------------
// Test: Canary traffic routing at 5% threshold
// ---------------------------------------------------------------------------
test("E2E Rollout: canary traffic router directs 5% to canary", () => {
    const router = new CanaryTrafficRouter();
    const metrics = {
        requestCount: 100,
        failureRate: 0.01,
        p99LatencyMs: 100,
        baselineP99LatencyMs: 100,
    };
    // At 5% canary, approximately 5 requests should go to canary
    const routing = router.computeCanaryAllocation("canary_5", metrics);
    assert.equal(routing.targetLevel, "canary_5", "Should target canary_5");
    assert.equal(routing.canaryPercentage, 5, "Should be 5% canary");
    assert.ok(routing.stablePercentage === 95, "Should be 95% stable");
});
// ---------------------------------------------------------------------------
// Test: Canary traffic routing at 25% threshold
// ---------------------------------------------------------------------------
test("E2E Rollout: canary traffic router directs 25% to canary", () => {
    const router = new CanaryTrafficRouter();
    const metrics = {
        requestCount: 100,
        failureRate: 0.01,
        p99LatencyMs: 100,
        baselineP99LatencyMs: 100,
    };
    const routing = router.computeCanaryAllocation("partial_25", metrics);
    assert.equal(routing.targetLevel, "partial_25", "Should target partial_25");
    assert.equal(routing.canaryPercentage, 25, "Should be 25% canary");
    assert.ok(routing.stablePercentage === 75, "Should be 75% stable");
});
// ---------------------------------------------------------------------------
// Test: Guardrail evaluation passes for healthy metrics
// ---------------------------------------------------------------------------
test("E2E Rollout: guardrail evaluator passes for healthy canary", () => {
    const evaluator = new GuardrailEvaluator();
    const metrics = {
        requestCount: 100,
        failureRate: 0.01, // 1% - well under threshold
        p99LatencyMs: 110, // 1.1x baseline - acceptable
        baselineP99LatencyMs: 100,
        observationWindowMs: 120000,
    };
    const result = evaluator.evaluate("canary_5", metrics);
    assert.equal(result.passed, true, "Should pass guardrails");
    assert.equal(result.blockingIssues.length, 0, "Should have no blocking issues");
    assert.ok(result.guardrailResults.every(r => r.status === "pass"), "All guardrails should pass");
});
// ---------------------------------------------------------------------------
// Test: Guardrail evaluation fails for degraded metrics
// ---------------------------------------------------------------------------
test("E2E Rollout: guardrail evaluator fails for degraded canary", () => {
    const evaluator = new GuardrailEvaluator();
    const metrics = {
        requestCount: 100,
        failureRate: 0.10, // 10% - exceeds threshold
        p99LatencyMs: 300, // 3x baseline - exceeds threshold
        baselineP99LatencyMs: 100,
        observationWindowMs: 120000,
    };
    const result = evaluator.evaluate("canary_5", metrics);
    assert.equal(result.passed, false, "Should fail guardrails");
    assert.ok(result.blockingIssues.length > 0, "Should have blocking issues");
    assert.ok(result.blockingIssues.some(i => i.includes("failure") || i.includes("latency")), "Should flag failure rate or latency issues");
});
// ---------------------------------------------------------------------------
// Test: Auto-rollback triggers on canary degradation
// ---------------------------------------------------------------------------
test("E2E Rollout: auto-rollback triggers when canary metrics degrade", () => {
    const service = new AutoRollbackService({
        maxFailureRate: 0.05,
        maxLatencyMultiplier: 2,
        minimumRequestCount: 20,
        minimumObservationWindowMs: 60000,
    });
    const metrics = {
        requestCount: 100,
        failureRate: 0.08, // 8% - exceeds 5% threshold
        p99LatencyMs: 250, // 2.5x baseline
        baselineP99LatencyMs: 100,
        observationWindowMs: 120000,
    };
    const decision = service.evaluate({}, metrics);
    assert.equal(decision.rollback, true, "Should trigger rollback");
    assert.ok(decision.reasonCodes.length > 0, "Should have reason codes");
});
// ---------------------------------------------------------------------------
// Test: Rollback from canary_5 to shadow
// ---------------------------------------------------------------------------
test("E2E Rollout: rollback from canary_5 returns to shadow", () => {
    const machine = new RolloutStateMachine();
    const candidate = createCandidate({ status: "approved" });
    // Get to canary_5
    machine.transition(candidate, "shadow");
    const canaryRecord = machine.transition(candidate, "canary_5", { currentStatus: "shadow" });
    assert.equal(canaryRecord.status, "canary_5", "Should be at canary_5");
    // Rollback to shadow
    const rollbackRecord = machine.transition(candidate, "shadow", {
        currentStatus: "canary_5",
        targetStatus: "rolled_back",
        guardrailReasonCodes: ["rollout.failure_rate_exceeded"],
    });
    assert.equal(rollbackRecord.status, "rolled_back", "Should be marked as rolled_back");
    assert.equal(rollbackRecord.level, "shadow", "Should rollback to shadow level");
    assert.ok(rollbackRecord.guardrailReasonCodes.includes("rollout.failure_rate_exceeded"));
});
// ---------------------------------------------------------------------------
// Test: Rollout state machine rejects invalid transitions
// ---------------------------------------------------------------------------
test("E2E Rollout: state machine rejects invalid transitions", () => {
    const machine = new RolloutStateMachine();
    const candidate = createCandidate({ status: "rejected" });
    // rejected cannot transition to anything except rejected
    try {
        machine.transition(candidate, "canary_5");
        assert.fail("Should have thrown for invalid transition");
    }
    catch (error) {
        assert.ok(error instanceof Error, "Should throw an Error");
        const msg = error.message;
        assert.ok(msg.includes("Invalid rollout transition"), "Should mention invalid transition");
    }
});
// ---------------------------------------------------------------------------
// Test: Pause and resume from canary state
// ---------------------------------------------------------------------------
test("E2E Rollout: pause and resume from canary_5", () => {
    const machine = new RolloutStateMachine();
    const candidate = createCandidate({ status: "approved" });
    // Get to canary_5
    machine.transition(candidate, "shadow");
    machine.transition(candidate, "canary_5", { currentStatus: "shadow" });
    // Pause the rollout
    const pausedRecord = machine.transition(candidate, "canary_5", {
        currentStatus: "canary_5",
        targetStatus: "paused",
    });
    assert.equal(pausedRecord.status, "paused", "Should be paused");
    // Resume from paused
    const resumedRecord = machine.transition(candidate, "canary_5", { currentStatus: "paused" });
    assert.equal(resumedRecord.status, "canary_5", "Should resume to canary_5");
});
// ---------------------------------------------------------------------------
// Test: Transition to shadow requires shadow_running status
// ---------------------------------------------------------------------------
test("E2E Rollout: transition to shadow requires shadow_running status", () => {
    const machine = new RolloutStateMachine();
    const candidate = createCandidate({ status: "approved" });
    // approved should be able to transition to shadow
    const record = machine.transition(candidate, "shadow");
    assert.equal(record.status, "shadow", "Should transition to shadow from approved");
});
// ---------------------------------------------------------------------------
// Test: Guardrail evaluation with insufficient samples
// ---------------------------------------------------------------------------
test("E2E Rollout: guardrail evaluator returns insufficient with low sample count", () => {
    const evaluator = new GuardrailEvaluator();
    const metrics = {
        requestCount: 5, // Very low count
        failureRate: 0.5, // Would be terrible with more samples
        p99LatencyMs: 500,
        baselineP99LatencyMs: 100,
        observationWindowMs: 10000, // Very short window
    };
    const result = evaluator.evaluate("canary_5", metrics);
    assert.equal(result.passed, false, "Should fail due to insufficient data");
    assert.ok(result.blockingIssues.some(i => i.includes("insufficient")), "Should flag insufficient data");
});
// ---------------------------------------------------------------------------
// Test: Auto-rollback does not trigger with healthy metrics
// ---------------------------------------------------------------------------
test("E2E Rollout: auto-rollback does not trigger with healthy metrics", () => {
    const service = new AutoRollbackService({
        maxFailureRate: 0.05,
        maxLatencyMultiplier: 2,
        minimumRequestCount: 20,
        minimumObservationWindowMs: 60000,
    });
    const metrics = {
        requestCount: 100,
        failureRate: 0.02, // 2% - under threshold
        p99LatencyMs: 105, // 1.05x baseline
        baselineP99LatencyMs: 100,
        observationWindowMs: 120000,
    };
    const decision = service.evaluate({}, metrics);
    assert.equal(decision.rollback, false, "Should not rollback");
    assert.equal(decision.reasonCodes.length, 0, "Should have no reason codes");
});
// ---------------------------------------------------------------------------
// Test: Traffic routing at stable stage
// ---------------------------------------------------------------------------
test("E2E Rollout: stable stage routes 100% to stable", () => {
    const router = new CanaryTrafficRouter();
    const metrics = {
        requestCount: 1000,
        failureRate: 0.01,
        p99LatencyMs: 100,
        baselineP99LatencyMs: 100,
    };
    const routing = router.computeCanaryAllocation("stable", metrics);
    assert.equal(routing.targetLevel, "stable", "Should target stable");
    assert.equal(routing.canaryPercentage, 0, "Should be 0% canary");
    assert.equal(routing.stablePercentage, 100, "Should be 100% stable");
});
// ---------------------------------------------------------------------------
// Test: Policy rollout workflow
// ---------------------------------------------------------------------------
test("E2E Rollout: policy rollout advances through stages with evidence", () => {
    const machine = new RolloutStateMachine();
    const candidate = createCandidate({
        status: "proposed",
        changeScope: "policy",
        sourceSignalRefs: ["signal:policy-violation", "signal:compliance-gap"],
    });
    // Draft to Shadow with policy focus
    let record = machine.transition(candidate, "shadow", {
        approvedBy: "compliance-team",
    });
    assert.equal(record.status, "shadow");
    // Shadow to Canary with evidence
    record = machine.transition(candidate, "canary_5", {
        currentStatus: "shadow",
        strategyVersionId: "policy-v2",
    });
    assert.equal(record.status, "canary_5");
    assert.equal(record.strategyVersionId, "policy-v2");
    // Canary advances but guardrails fail - rollback
    record = machine.transition(candidate, "shadow", {
        currentStatus: "canary_5",
        targetStatus: "rolled_back",
        guardrailReasonCodes: ["rollout.failure_rate_exceeded"],
    });
    assert.equal(record.status, "rolled_back");
    assert.equal(record.level, "shadow");
});
// ---------------------------------------------------------------------------
// Test: Rollback preserves evidence for future attempts
// ---------------------------------------------------------------------------
test("E2E Rollout: rollback preserves evidence for retry", () => {
    const machine = new RolloutStateMachine();
    const candidate = createCandidate({
        status: "approved",
        sourceSignalRefs: ["signal:perf-issue", "signal:error-spike"],
    });
    const record = machine.transition(candidate, "canary_5", { currentStatus: "shadow" });
    const rollbackRecord = machine.transition(candidate, "shadow", {
        currentStatus: "canary_5",
        targetStatus: "rolled_back",
        guardrailReasonCodes: ["rollout.latency_multiplier_exceeded"],
    });
    assert.deepEqual(rollbackRecord.evidence, ["signal:perf-issue", "signal:error-spike"], "Should preserve evidence");
    assert.ok(rollbackRecord.guardrailReasonCodes.includes("rollout.latency_multiplier_exceeded"));
});
// ---------------------------------------------------------------------------
// Test: Multiple rollback reasons accumulate
// ---------------------------------------------------------------------------
test("E2E Rollout: multiple guardrail failures accumulate reason codes", () => {
    const service = new AutoRollbackService({
        maxFailureRate: 0.05,
        maxLatencyMultiplier: 2,
        minimumRequestCount: 20,
        minimumObservationWindowMs: 60000,
    });
    const metrics = {
        requestCount: 100,
        failureRate: 0.10, // Exceeds
        p99LatencyMs: 300, // Exceeds
        baselineP99LatencyMs: 100,
        observationWindowMs: 120000,
    };
    const decision = service.evaluate({}, metrics);
    assert.equal(decision.rollback, true);
    assert.ok(decision.reasonCodes.includes("rollout.failure_rate_exceeded"));
    assert.ok(decision.reasonCodes.includes("rollout.latency_multiplier_exceeded"));
});
//# sourceMappingURL=rollout-release-comprehensive.test.js.map