import test from "node:test";
import assert from "node:assert/strict";
test("protocol exports HarnessDecisionAction type", () => {
    const action = "accept";
    assert.equal(action, "accept");
});
test("protocol exports HarnessRole type", () => {
    const role = "evaluator";
    assert.equal(role, "evaluator");
});
test("protocol exports HarnessRunStatus type", () => {
    const status = "created";
    assert.equal(status, "created");
});
test("protocol exports FeedbackEnvelope type", () => {
    const envelope = {
        feedbackId: "test-123",
        signals: ["signal-1"],
        learnedActions: [],
        createdAt: "2026-04-23T00:00:00Z",
    };
    assert.equal(envelope.feedbackId, "test-123");
    assert.ok(Array.isArray(envelope.signals));
});
test("protocol exports HarnessDecision type", () => {
    const decision = {
        decisionId: "dec-1",
        action: "accept",
        reasonCodes: ["code-1"],
        confidence: 0.85,
        createdAt: "2026-04-23T00:00:00Z",
    };
    assert.equal(decision.action, "accept");
});
test("protocol exports HarnessStep type", () => {
    const step = {
        stepId: "step-1",
        role: "planner",
        stage: "plan",
        iteration: 1,
        semanticPhase: "plan",
        inputs: {},
        outputs: {},
        startedAt: "2026-04-23T00:00:00Z",
        completedAt: "2026-04-23T00:00:01Z",
    };
    assert.equal(step.role, "planner");
});
test("protocol exports ContextSnapshot type", () => {
    const snapshot = {
        snapshotId: "snap-1",
        runId: "run-1",
        domainId: "domain-1",
        iteration: 1,
        stepCount: 5,
        lastDecisionId: null,
        capturedAt: "2026-04-23T00:00:00Z",
    };
    assert.equal(snapshot.iteration, 1);
});
test("protocol exports RecoveryCheckpoint type", () => {
    const checkpoint = {
        checkpointId: "cp-1",
        runId: "run-1",
        lastCompletedStepId: null,
        statusBeforeRecovery: "running",
        createdAt: "2026-04-23T00:00:00Z",
    };
    assert.equal(checkpoint.statusBeforeRecovery, "running");
});
test("protocol exports WorkflowSleepLease type", () => {
    const lease = {
        leaseId: "lease-1",
        runId: "run-1",
        reason: "test",
        resumeAt: "2026-04-23T00:01:00Z",
        createdAt: "2026-04-23T00:00:00Z",
    };
    assert.equal(lease.leaseId, "lease-1");
});
test("protocol exports HarnessTimelineEvent type", () => {
    const event = {
        eventId: "event-1",
        runId: "run-1",
        type: "run_created",
        payload: {},
        recordedAt: "2026-04-23T00:00:00Z",
    };
    assert.equal(event.type, "run_created");
});
test("protocol exports HarnessLoopInput type", () => {
    const input = {
        taskId: "task-1",
        domainId: "domain-1",
        constraintPack: {
            policyIds: [],
            approvalMode: "none",
            autonomyMode: "auto",
            toolPolicy: { allowedTools: [] },
            risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
            output_policy: { requiredEvidence: [], redactSensitiveData: false },
            budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
        },
        plannerOutput: {},
        generatorOutput: {},
        evaluatorOutput: {},
        evaluatorScore: 0.85,
    };
    assert.equal(input.taskId, "task-1");
});
test("protocol exports PlanBundle type", () => {
    const bundle = {
        planId: "plan-1",
        summary: "Test plan",
        checkpoints: ["step-1"],
        policyIds: [],
    };
    assert.equal(bundle.planId, "plan-1");
});
test("protocol exports WorkProduct type", () => {
    const product = {
        artifactRefs: ["artifact-1"],
        output: { result: "ok" },
        promptLineage: [],
    };
    assert.ok(Array.isArray(product.artifactRefs));
});
test("protocol exports EvaluationReport type", () => {
    const report = {
        verdict: "accept",
        score: 0.9,
        evidenceRefs: [],
    };
    assert.equal(report.verdict, "accept");
});
//# sourceMappingURL=protocol.test.js.map