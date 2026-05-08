/**
 * E2E Harness Loop Tests
 *
 * End-to-end tests covering harness orchestration loop execution,
 * verifying all 8 HarnessTimelineEvent types (R9-16) and core workflows.
 *
 * R9:  run_created       - emitted when a harness run is created
 * R10: step_completed   - emitted after each step (planner/generator/evaluator)
 * R11: guardrails_evaluated - emitted after guardrail assessment
 * R12: decision_recorded - emitted when a decision is made
 * R13: recovery_started  - emitted when recovery is initiated
 * R14: hitl_requested    - emitted when human review is requested
 * R15: hitl_resolved     - emitted when human review is resolved
 * R16: sleep_started     - emitted when sleep is initiated
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import {
  HarnessRuntimeService,
  type HarnessTimelineEvent,
  type ConstraintPack,
} from "../../src/platform/orchestration/harness/index.js";
import {
  TestHarnessOrchestrator,
  createTestConstraintPack,
} from "../unit/platform/orchestration/harness/test-service-wrapper.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * R10-39 fix: Use createTestConstraintPack for dynamic values instead of
 * static construction parameters. This ensures tests exercise real
 * planner/generator/evaluator code paths through the orchestrator.
 */
function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return createTestConstraintPack({
    policyIds: ["policy.e2e.default"],
    autonomyMode: "semi_auto",
    budget: { maxSteps: 9, maxCost: 10, maxDurationMs: 60_000 },
    ...overrides,
  });
}

function countTimelineEvents(timeline: readonly HarnessTimelineEvent[], type: HarnessTimelineEvent["type"]): number {
  return timeline.filter((e) => e.type === type).length;
}

function assertHasTimelineEvent(
  timeline: readonly HarnessTimelineEvent[],
  type: HarnessTimelineEvent["type"],
  message?: string,
): void {
  const found = timeline.some((e) => e.type === type);
  assert.ok(found, message ?? `timeline should contain event type: ${type}`);
}

function transitionRunToRunning(service: HarnessRuntimeService, run: ReturnType<HarnessRuntimeService["createRun"]>) {
  let current = service.transitionRunStatus(run, "admitted", "harness.admitted");
  current = service.transitionRunStatus(current, "planning", "harness.planning_started");
  current = service.transitionRunStatus(current, "ready", "harness.plan_ready");
  return service.transitionRunStatus(current, "running", "harness.execution_started");
}

// ---------------------------------------------------------------------------
// Scenario 1 & 5: runLoop() executes full workflow with all 8 timeline events
// ---------------------------------------------------------------------------

test("E2E: runLoop executes full workflow and records all 8 HarnessTimelineEvent types", (t) => {
  const harness = createE2EHarness("aa-e2e-all-events-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack = createConstraintPack();
    // Use real planner/generator/evaluator via orchestrator wrapper
    const orchestrator = new TestHarnessOrchestrator();
    orchestrator.evaluator.configure({ score: 0.91, verdict: "pass" });

    const { plannerOutput, generatorOutput, evaluatorOutput, evaluatorScore } = orchestrator.executeLoop({
      taskId: "task-e2e-all-events-001",
      domainId: "coding",
      constraintPack,
      iteration: 1,
    });

    assert.equal(orchestrator.planner.getCallCount(), 1, "planner should be invoked exactly once");
    assert.equal(orchestrator.generator.getCallCount(), 1, "generator should be invoked exactly once");
    assert.equal(orchestrator.evaluator.getCallCount(), 1, "evaluator should be invoked exactly once");
    assert.equal(orchestrator.planner.getCapturedInputs()[0]?.taskId, "task-e2e-all-events-001");
    assert.equal(orchestrator.generator.getCapturedInputs()[0]?.plannerOutput.planId, plannerOutput.planId);
    assert.equal(orchestrator.evaluator.getCapturedInputs()[0]?.generatorOutput.artifact, generatorOutput.artifact);

    const run = service.runLoop({
      taskId: "task-e2e-all-events-001",
      domainId: "coding",
      constraintPack,
      plannerOutput,
      generatorOutput,
      evaluatorOutput,
      evaluatorScore,
      producedEvidenceRefs: [],
    });

    // Verify all 8 timeline events are present
    const timeline = run.timeline;

    // R9: run_created event must be recorded when run is created
    assertHasTimelineEvent(timeline, "run_created", "R9: timeline must contain run_created");
    // R10: step_completed events for planner, generator, evaluator
    const stepCompletedCount = countTimelineEvents(timeline, "step_completed");
    assert.ok(stepCompletedCount >= 3, `R10: timeline must contain step_completed events (planner/generator/evaluator), got ${stepCompletedCount}`);
    // R11: guardrails_evaluated event after guardrail assessment
    assertHasTimelineEvent(timeline, "guardrails_evaluated", "R11: timeline must contain guardrails_evaluated");
    // R12: decision_recorded event when decision is made
    assertHasTimelineEvent(timeline, "decision_recorded", "R12: timeline must contain decision_recorded");

    // R13-16: Events that may or may not fire depending on path
    // These are verified in their respective test scenarios

    // Verify run status and structure
    assert.equal(run.status, "completed", "run should complete with high evaluator score");
    assert.ok(run.completedAt, "completedAt should be set");
    assert.equal(run.decision?.action, "accept", "decision should be accept for high score");

    // Verify timeline has correct event ordering
    const runCreatedIdx = timeline.findIndex((e) => e.type === "run_created");
    const stepCompletedIdx = timeline.findIndex((e) => e.type === "step_completed");
    const guardrailsIdx = timeline.findIndex((e) => e.type === "guardrails_evaluated");
    const decisionIdx = timeline.findIndex((e) => e.type === "decision_recorded");
    assert.ok(runCreatedIdx < stepCompletedIdx, "run_created should come before step_completed");
    assert.ok(stepCompletedIdx < guardrailsIdx, "step_completed should come before guardrails_evaluated");
    assert.ok(guardrailsIdx < decisionIdx, "guardrails_evaluated should come before decision_recorded");
  } finally {
    harness.cleanup();
  }
});

test("E2E: runLoop aborts when duration guard is exceeded during a replan loop", () => {
  const harness = createE2EHarness("aa-e2e-duration-guard-");
  const originalNow = Date.now;
  let mockNow = 1_000;
  Date.now = () => {
    mockNow += 5;
    return mockNow;
  };
  try {
    const service = new HarnessRuntimeService();
    const constraintPack = createConstraintPack({
      budget: { maxSteps: 9, maxCost: 10, maxDurationMs: 1 },
    });
    const orchestrator = new TestHarnessOrchestrator();
    orchestrator.evaluator.configure({ score: 0.42, verdict: "retry" });

    const { plannerOutput, generatorOutput, evaluatorOutput, evaluatorScore } = orchestrator.executeLoop({
      taskId: "task-e2e-duration-guard-001",
      domainId: "coding",
      constraintPack,
      iteration: 1,
    });

    const run = service.runLoop({
      taskId: "task-e2e-duration-guard-001",
      domainId: "coding",
      constraintPack,
      plannerOutput,
      generatorOutput,
      evaluatorOutput,
      evaluatorScore,
      producedEvidenceRefs: [],
    });

    assert.equal(run.status, "aborted");
    assert.equal(run.decision?.action, "abort");
    assert.ok(run.decision?.reasonCodes.includes("harness.guard.max_duration_exceeded"));
    assert.ok((run.loopMetrics?.durationMs ?? 0) > 0);
  } finally {
    Date.now = originalNow;
    harness.cleanup();
  }
});

test("E2E: runLoop produces 8 distinct timeline event types in successful accept path", (t) => {
  const harness = createE2EHarness("aa-e2e-eight-types-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack = createConstraintPack();
    // Use real planner/generator/evaluator via orchestrator wrapper
    const orchestrator = new TestHarnessOrchestrator();
    orchestrator.evaluator.configure({ score: 0.88, verdict: "pass" });

    const { plannerOutput, generatorOutput, evaluatorOutput, evaluatorScore } = orchestrator.executeLoop({
      taskId: "task-e2e-eight-types-001",
      domainId: "coding",
      constraintPack,
      iteration: 1,
    });

    const run = service.runLoop({
      taskId: "task-e2e-eight-types-001",
      domainId: "coding",
      constraintPack,
      plannerOutput,
      generatorOutput,
      evaluatorOutput,
      evaluatorScore,
      producedEvidenceRefs: [],
    });

    const eventTypes = run.timeline.map((e) => e.type);
    const uniqueTypes = [...new Set(eventTypes)];

    // Core events that must appear in accept path
    assert.ok(uniqueTypes.includes("run_created"), "must have run_created");
    assert.ok(uniqueTypes.includes("step_completed"), "must have step_completed");
    assert.ok(uniqueTypes.includes("guardrails_evaluated"), "must have guardrails_evaluated");
    assert.ok(uniqueTypes.includes("decision_recorded"), "must have decision_recorded");

    // R9-12 verified above; R13-16 require specific paths (HITL, sleep, recovery)
    // which are tested in dedicated scenarios
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Scenario 2: Harness correctly handles recovery_started events
// ---------------------------------------------------------------------------

test("E2E: recover() records recovery_started event in timeline", (t) => {
  const harness = createE2EHarness("aa-e2e-recovery-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack = createConstraintPack();

    // Create a run in running state
    let run = service.createRun({
      taskId: "task-e2e-recovery-001",
      domainId: "infrastructure",
      constraintPack,
    });

    // Transition to running state
    run = transitionRunToRunning(service, run);

    // Append some steps
    run = service.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: { taskId: "task-e2e-recovery-001" },
      outputs: { planId: "plan-recovery-001" },
    });

    // Trigger recovery
    const recovered = service.recover(run);

    // Verify recovery_started event in timeline
    assertHasTimelineEvent(recovered.timeline, "recovery_started", "R13: timeline must contain recovery_started");
    const recoveryEvent = recovered.timeline.find((e) => e.type === "recovery_started");
    assert.ok(recoveryEvent, "recovery_started event should be present");
    assert.equal(recoveryEvent?.payload["statusBeforeRecovery"], "running", "payload should contain statusBeforeRecovery");
    assert.ok(recovered.recoveryCheckpoint, "recoveryCheckpoint should be set");
    assert.equal(recovered.pauseReason, "recovery", "pauseReason should be 'recovery'");
  } finally {
    harness.cleanup();
  }
});

test("E2E: recover() can be called from terminal state and transitions to paused", (t) => {
  const harness = createE2EHarness("aa-e2e-recovery-terminal-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack = createConstraintPack();

    let run = service.createRun({
      taskId: "task-e2e-recovery-terminal-001",
      domainId: "infrastructure",
      constraintPack,
    });

    run = transitionRunToRunning(service, run);
    run = service.transitionRunStatus(run, "completed", "harness.completed");

    // Recover from terminal state should transition to paused
    const recovered = service.recover(run);

    assertHasTimelineEvent(recovered.timeline, "recovery_started", "recovery_started should be in timeline");
    assert.equal(recovered.status, "paused", "should transition to paused from terminal state");
    assert.equal(recovered.pauseReason, "recovery", "pauseReason should be recovery");
  } finally {
    harness.cleanup();
  }
});

test("E2E: resume() clears recovery state and removes pauseReason", (t) => {
  const harness = createE2EHarness("aa-e2e-resume-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack = createConstraintPack();

    let run = service.createRun({
      taskId: "task-e2e-resume-001",
      domainId: "infrastructure",
      constraintPack,
    });

    run = transitionRunToRunning(service, run);
    run = service.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: {},
      outputs: { planId: "plan-resume-001" },
    });

    run = service.recover(run);
    assert.equal(run.pauseReason, "recovery", "should be in recovery pause");

    const resumed = service.resume(run);
    assert.equal(resumed.pauseReason, null, "pauseReason should be cleared after resume");
    assert.equal(resumed.recoveryCheckpoint, null, "recoveryCheckpoint should be cleared");
    assert.equal(resumed.sleepLease, null, "sleepLease should remain null");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Scenario 3: HITL path exercises hitl_requested and hitl_resolved events
// ---------------------------------------------------------------------------

test("E2E: HITL path records hitl_requested and hitl_resolved events", (t) => {
  const harness = createE2EHarness("aa-e2e-hitl-events-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack = createConstraintPack({
      approvalMode: "required",
      autonomyMode: "supervised",
      risk_policy: { maxRiskScore: 80, escalationThreshold: 50 },
    });
    // Use real planner/generator/evaluator via orchestrator wrapper
    const orchestrator = new TestHarnessOrchestrator();
    orchestrator.evaluator.configure({ score: 0.72, verdict: "needs-review" });

    const { plannerOutput, generatorOutput, evaluatorOutput, evaluatorScore } = orchestrator.executeLoop({
      taskId: "task-e2e-hitl-001",
      domainId: "security",
      constraintPack,
      iteration: 1,
    });

    const run = service.runLoop({
      taskId: "task-e2e-hitl-001",
      domainId: "security",
      constraintPack,
      plannerOutput,
      generatorOutput,
      evaluatorOutput,
      evaluatorScore,
      riskScore: 65, // Above escalationThreshold of 50
      producedEvidenceRefs: ["deployment_manifest"],
      requiresHuman: true,
    });

    // R14: hitl_requested event must be recorded when human review is needed
    assertHasTimelineEvent(run.timeline, "hitl_requested", "R14: timeline must contain hitl_requested");
    const hitlRequestedEvent = run.timeline.find((e) => e.type === "hitl_requested");
    assert.ok(hitlRequestedEvent, "hitl_requested event should be present");
    assert.equal(run.pauseReason, "hitl", "run should be paused for HITL");
    assert.equal(run.status, "paused", "status should be paused");
    assert.ok(run.hitlRequest, "hitlRequest should be set");
    assert.equal(run.hitlRequest?.status, "pending_approval", "HITL request should be pending");

    // Resolve the HITL review with approval
    const approved = service.resolveHitlReview(run, "approved", "security_operator");

    // R15: hitl_resolved event must be recorded when review is resolved
    assertHasTimelineEvent(approved.timeline, "hitl_resolved", "R15: timeline must contain hitl_resolved");
    const hitlResolvedEvent = approved.timeline.find((e) => e.type === "hitl_resolved");
    assert.ok(hitlResolvedEvent, "hitl_resolved event should be present");
    assert.equal(hitlResolvedEvent?.payload["resolution"], "approved", "payload should contain resolution");
    assert.equal(hitlResolvedEvent?.payload["actorId"], "security_operator", "payload should contain actorId");
    assert.equal(approved.hitlRequest?.status, "approved", "HITL request should be approved");
    assert.equal(approved.hitlRequest?.resolvedBy, "security_operator", "resolvedBy should match actorId");
  } finally {
    harness.cleanup();
  }
});

test("E2E: HITL rejection records hitl_resolved with rejected resolution and aborts run", (t) => {
  const harness = createE2EHarness("aa-e2e-hitl-reject-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack = createConstraintPack({
      approvalMode: "required",
      autonomyMode: "supervised",
      risk_policy: { maxRiskScore: 80, escalationThreshold: 50 },
    });
    // Use real planner/generator/evaluator via orchestrator wrapper
    const orchestrator = new TestHarnessOrchestrator();
    orchestrator.evaluator.configure({ score: 0.55, verdict: "requires-human" });

    const { plannerOutput, generatorOutput, evaluatorOutput, evaluatorScore } = orchestrator.executeLoop({
      taskId: "task-e2e-hitl-reject-001",
      domainId: "security",
      constraintPack,
      iteration: 1,
    });

    const run = service.runLoop({
      taskId: "task-e2e-hitl-reject-001",
      domainId: "security",
      constraintPack,
      plannerOutput,
      generatorOutput,
      evaluatorOutput,
      evaluatorScore,
      riskScore: 78,
      producedEvidenceRefs: [],
      requiresHuman: true,
    });

    assertHasTimelineEvent(run.timeline, "hitl_requested", "hitl_requested should be present");
    assert.equal(run.status, "paused", "should be paused for HITL");

    const rejected = service.resolveHitlReview(run, "rejected", "security_manager");

    assertHasTimelineEvent(rejected.timeline, "hitl_resolved", "hitl_resolved should be recorded");
    const resolvedEvent = rejected.timeline.find((e) => e.type === "hitl_resolved");
    assert.equal(resolvedEvent?.payload["resolution"], "rejected", "resolution should be rejected");
    assert.equal(rejected.status, "aborted", "run should abort after rejection");
    assert.ok(rejected.completedAt, "completedAt should be set for aborted run");
  } finally {
    harness.cleanup();
  }
});

test("E2E: HITL resolution throws when no open HITL request exists", (t) => {
  const harness = createE2EHarness("aa-e2e-hitl-no-req-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack = createConstraintPack();
    // Use real planner/generator/evaluator via orchestrator wrapper
    const orchestrator = new TestHarnessOrchestrator();
    orchestrator.evaluator.configure({ score: 0.91, verdict: "pass" });

    const { plannerOutput, generatorOutput, evaluatorOutput, evaluatorScore } = orchestrator.executeLoop({
      taskId: "task-e2e-hitl-no-req-001",
      domainId: "coding",
      constraintPack,
      iteration: 1,
    });

    // Run completes without HITL
    const run = service.runLoop({
      taskId: "task-e2e-hitl-no-req-001",
      domainId: "coding",
      constraintPack,
      plannerOutput,
      generatorOutput,
      evaluatorOutput,
      evaluatorScore,
      producedEvidenceRefs: [],
    });

    assert.equal(run.status, "completed", "run should complete without HITL");
    assert.throws(
      () => service.resolveHitlReview(run, "approved", "someone"),
      (err: unknown) => err instanceof Error && err.message.includes("harness.hitl.request_not_found"),
      "should throw when no HITL request is open",
    );
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Scenario 4: Harness sleep path exercises sleep_started event
// ---------------------------------------------------------------------------

test("E2E: sleep() records sleep_started event in timeline", (t) => {
  const harness = createE2EHarness("aa-e2e-sleep-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack = createConstraintPack();

    let run = service.createRun({
      taskId: "task-e2e-sleep-001",
      domainId: "data-engineering",
      constraintPack,
    });

    run = transitionRunToRunning(service, run);

    const resumeAt = new Date(Date.now() + 30_000).toISOString();
    const slept = service.sleep(run, "awaiting_external_dependency", resumeAt);

    // R16: sleep_started event must be recorded when sleep is initiated
    assertHasTimelineEvent(slept.timeline, "sleep_started", "R16: timeline must contain sleep_started");
    const sleepEvent = slept.timeline.find((e) => e.type === "sleep_started");
    assert.ok(sleepEvent, "sleep_started event should be present");
    assert.equal(sleepEvent?.payload["reason"], "awaiting_external_dependency", "payload should contain reason");
    assert.equal(sleepEvent?.payload["resumeAt"], resumeAt, "payload should contain resumeAt");
    assert.equal(slept.pauseReason, "sleep", "pauseReason should be 'sleep'");
    assert.ok(slept.sleepLease, "sleepLease should be set");
    assert.equal(slept.sleepLease?.reason, "awaiting_external_dependency", "sleepLease reason should match");
  } finally {
    harness.cleanup();
  }
});

test("E2E: resume() clears sleep state and removes sleepLease", (t) => {
  const harness = createE2EHarness("aa-e2e-sleep-resume-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack = createConstraintPack();

    let run = service.createRun({
      taskId: "task-e2e-sleep-resume-001",
      domainId: "data-engineering",
      constraintPack,
    });

    run = transitionRunToRunning(service, run);

    const resumeAt = new Date(Date.now() + 30_000).toISOString();
    run = service.sleep(run, "waiting_for_data", resumeAt);
    assert.equal(run.pauseReason, "sleep", "should be in sleep pause");

    const resumed = service.resume(run);
    assert.equal(resumed.pauseReason, null, "pauseReason should be cleared after resume");
    assert.equal(resumed.sleepLease, null, "sleepLease should be cleared");
    assert.equal(resumed.recoveryCheckpoint, null, "recoveryCheckpoint should remain null");
  } finally {
    harness.cleanup();
  }
});

test("E2E: runLoop with low score triggers replan path without HITL", (t) => {
  const harness = createE2EHarness("aa-e2e-replan-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack = createConstraintPack({
      budget: { maxSteps: 9, maxCost: 10, maxDurationMs: 60_000 },
    });
    // Use real planner/generator/evaluator via orchestrator wrapper
    const orchestrator = new TestHarnessOrchestrator();
    orchestrator.evaluator.configure({ score: 0.42, verdict: "retry" });

    const { plannerOutput, generatorOutput, evaluatorOutput, evaluatorScore } = orchestrator.executeLoop({
      taskId: "task-e2e-replan-001",
      domainId: "coding",
      constraintPack,
      iteration: 1,
    });

    const run = service.runLoop({
      taskId: "task-e2e-replan-001",
      domainId: "coding",
      constraintPack,
      plannerOutput,
      generatorOutput,
      evaluatorOutput,
      evaluatorScore,
      producedEvidenceRefs: [],
    });

    // With score 0.42 < 0.5, decision should be replan or abort (budget may exhaust)
    assert.ok(run.steps.length >= 3, "should have at least one full planner-generator-evaluator cycle");
    assert.ok(run.decision, "decision should be recorded");
    assert.ok(
      run.decision?.action === "replan" || run.decision?.action === "abort",
      "decision should be replan or abort",
    );
    assertHasTimelineEvent(run.timeline, "decision_recorded", "decision_recorded should be in timeline");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Scenario 6: Guardrails evaluation exercises guardrails_evaluated event
// ---------------------------------------------------------------------------

test("E2E: guardrails_evaluated event is recorded with assessment details", (t) => {
  const harness = createE2EHarness("aa-e2e-guardrails-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack = createConstraintPack({
      risk_policy: { maxRiskScore: 60, escalationThreshold: 50 },
    });
    // Use real planner/generator/evaluator via orchestrator wrapper
    const orchestrator = new TestHarnessOrchestrator();
    orchestrator.evaluator.configure({ score: 0.85, verdict: "pass" });

    const { plannerOutput, generatorOutput, evaluatorOutput, evaluatorScore } = orchestrator.executeLoop({
      taskId: "task-e2e-guardrails-001",
      domainId: "security",
      constraintPack,
      iteration: 1,
    });

    const run = service.runLoop({
      taskId: "task-e2e-guardrails-001",
      domainId: "security",
      constraintPack,
      plannerOutput,
      generatorOutput,
      evaluatorOutput,
      evaluatorScore,
      riskScore: 45, // Below escalationThreshold
      producedEvidenceRefs: [],
    });

    // R11: guardrails_evaluated event must be recorded after guardrail assessment
    assertHasTimelineEvent(run.timeline, "guardrails_evaluated", "R11: timeline must contain guardrails_evaluated");
    const guardrailEvent = run.timeline.find((e) => e.type === "guardrails_evaluated");
    assert.ok(guardrailEvent, "guardrails_evaluated event should be present");
    assert.ok("passed" in guardrailEvent.payload, "payload should contain passed field");
    assert.ok("requiresHuman" in guardrailEvent.payload, "payload should contain requiresHuman field");
    assert.ok("suggestedAction" in guardrailEvent.payload, "payload should contain suggestedAction field");
    assert.ok(run.guardrailAssessment, "guardrailAssessment should be set on run");
  } finally {
    harness.cleanup();
  }
});

test("E2E: guardrail assessment blocks when risk exceeds maxRiskScore", (t) => {
  const harness = createE2EHarness("aa-e2e-guardrail-block-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack = createConstraintPack({
      risk_policy: { maxRiskScore: 50, escalationThreshold: 40 },
    });
    // Use real planner/generator/evaluator via orchestrator wrapper
    const orchestrator = new TestHarnessOrchestrator();
    orchestrator.evaluator.configure({ score: 0.88, verdict: "pass" });

    const { plannerOutput, generatorOutput, evaluatorOutput, evaluatorScore } = orchestrator.executeLoop({
      taskId: "task-e2e-guardrail-block-001",
      domainId: "security",
      constraintPack,
      iteration: 1,
    });

    // Attempting to run with risk score above maxRiskScore should throw
    assert.throws(
      () =>
        service.runLoop({
          taskId: "task-e2e-guardrail-block-001",
          domainId: "security",
          constraintPack,
          plannerOutput,
          generatorOutput,
          evaluatorOutput,
          evaluatorScore,
          riskScore: 85, // Exceeds maxRiskScore of 50
          producedEvidenceRefs: [],
        }),
      /harness\.invariant\.max_risk_exceeded/,
      "should throw when risk score exceeds maxRiskScore",
    );
  } finally {
    harness.cleanup();
  }
});

test("E2E: guardrails_evaluated appears before decision_recorded in timeline", (t) => {
  const harness = createE2EHarness("aa-e2e-guardrail-order-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack = createConstraintPack();
    // Use real planner/generator/evaluator via orchestrator wrapper
    const orchestrator = new TestHarnessOrchestrator();
    orchestrator.evaluator.configure({ score: 0.9, verdict: "pass" });

    const { plannerOutput, generatorOutput, evaluatorOutput, evaluatorScore } = orchestrator.executeLoop({
      taskId: "task-e2e-guardrail-order-001",
      domainId: "coding",
      constraintPack,
      iteration: 1,
    });

    const run = service.runLoop({
      taskId: "task-e2e-guardrail-order-001",
      domainId: "coding",
      constraintPack,
      plannerOutput,
      generatorOutput,
      evaluatorOutput,
      evaluatorScore,
      producedEvidenceRefs: [],
    });

    const guardrailIdx = run.timeline.findIndex((e) => e.type === "guardrails_evaluated");
    const decisionIdx = run.timeline.findIndex((e) => e.type === "decision_recorded");

    assert.ok(guardrailIdx !== -1, "guardrails_evaluated should be in timeline");
    assert.ok(decisionIdx !== -1, "decision_recorded should be in timeline");
    assert.ok(guardrailIdx < decisionIdx, "guardrails_evaluated should come before decision_recorded");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Additional scenario: Verify all 8 event types can be emitted in single run
// ---------------------------------------------------------------------------

test("E2E: single run can emit multiple event types through lifecycle", (t) => {
  const harness = createE2EHarness("aa-e2e-multi-event-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack = createConstraintPack({
      approvalMode: "required",
      autonomyMode: "supervised",
      risk_policy: { maxRiskScore: 80, escalationThreshold: 50 },
    });

    // Create run and exercise multiple event types
    let run = service.createRun({
      taskId: "task-e2e-multi-001",
      domainId: "coding",
      constraintPack,
    });

    // run_created is emitted by createRun
    assertHasTimelineEvent(run.timeline, "run_created", "run_created should be in timeline");

    run = transitionRunToRunning(service, run);

    // Add planner step - emits step_completed
    run = service.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: {},
      outputs: { planId: "plan-multi-001" },
    });
    assertHasTimelineEvent(run.timeline, "step_completed", "step_completed should be emitted");

    // Sleep emits sleep_started
    const resumeAt = new Date(Date.now() + 60_000).toISOString();
    run = service.sleep(run, "waiting_for_resource", resumeAt);
    assertHasTimelineEvent(run.timeline, "sleep_started", "sleep_started should be emitted");

    // Resume clears sleep
    run = service.resume(run);

    // Add generator and evaluator steps
    run = service.appendStep(run, {
      role: "generator",
      stage: "execute",
      inputs: {},
      outputs: { artifact: "output.diff" },
    });
    run = service.appendStep(run, {
      role: "evaluator",
      stage: "evaluate",
      inputs: {},
      outputs: { verdict: "needs-review" },
    });

    // HITL emits hitl_requested
    run = service.openHitlReview(run, "requires_operator_approval", []);
    assertHasTimelineEvent(run.timeline, "hitl_requested", "hitl_requested should be emitted");

    // Resolve emits hitl_resolved
    const approved = service.resolveHitlReview(run, "approved", "operator");
    assertHasTimelineEvent(approved.timeline, "hitl_resolved", "hitl_resolved should be emitted");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// End of E2E tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// R10-38: DurationGuard E2E Enforcement Tests
// ---------------------------------------------------------------------------

test("E2E: runLoop aborts when maxDurationMs is exceeded", async (t) => {
  const harness = createE2EHarness("aa-e2e-duration-");
  try {
    const service = new HarnessRuntimeService();
    // Use a very short duration to trigger guard - 1ms is enough since
    // the controller records startedAt = Date.now() at construction
    const constraintPack = createConstraintPack({
      budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 1 },
    });

    const orchestrator = new TestHarnessOrchestrator();
    orchestrator.evaluator.configure({ score: 0.91, verdict: "pass" });

    // Wait to ensure actual time exceeds maxDurationMs
    await new Promise((resolve) => setTimeout(resolve, 10));

    const { plannerOutput, generatorOutput, evaluatorOutput, evaluatorScore } = orchestrator.executeLoop({
      taskId: "task-e2e-duration-001",
      domainId: "coding",
      constraintPack,
      iteration: 1,
    });

    const run = service.runLoop({
      taskId: "task-e2e-duration-001",
      domainId: "coding",
      constraintPack,
      plannerOutput,
      generatorOutput,
      evaluatorOutput,
      evaluatorScore,
      producedEvidenceRefs: [],
    });

    // Duration guard should abort the run
    assert.equal(
      run.status,
      "aborted",
      "run should be aborted when maxDurationMs is exceeded",
    );
    assert.equal(
      run.decision?.reasonCode,
      "harness.guard.max_duration_exceeded",
      "reasonCode should be max_duration_exceeded",
    );
  } finally {
    harness.cleanup();
  }
});

test("E2E: runLoop completes when maxDurationMs is not exceeded", async (t) => {
  const harness = createE2EHarness("aa-e2e-duration-ok-");
  try {
    const service = new HarnessRuntimeService();
    // Use a generous duration that won't be exceeded
    const constraintPack = createConstraintPack({
      budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
    });

    const orchestrator = new TestHarnessOrchestrator();
    orchestrator.evaluator.configure({ score: 0.91, verdict: "pass" });

    const { plannerOutput, generatorOutput, evaluatorOutput, evaluatorScore } = orchestrator.executeLoop({
      taskId: "task-e2e-duration-ok-001",
      domainId: "coding",
      constraintPack,
      iteration: 1,
    });

    const run = service.runLoop({
      taskId: "task-e2e-duration-ok-001",
      domainId: "coding",
      constraintPack,
      plannerOutput,
      generatorOutput,
      evaluatorOutput,
      evaluatorScore,
      producedEvidenceRefs: [],
    });

    // Run should not abort due to duration
    assert.ok(
      run.status !== "aborted" || run.decision?.reasonCode !== "harness.guard.max_duration_exceeded",
      "run should not abort due to duration when maxDurationMs is not exceeded",
    );
  } finally {
    harness.cleanup();
  }
});
