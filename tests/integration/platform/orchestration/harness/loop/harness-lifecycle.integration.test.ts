/**
 * Integration Test: Harness Lifecycle - Full Loop
 *
 * Tests the complete lifecycle of a harness run including:
 * - createRun -> appendStep -> sleep -> recover -> resume
 * - Context assembly and snapshotting
 * - Checkpoint/restore flow
 * - Guardrail evaluation in context of full loop
 *
 * Uses in-memory SQLite and temp directories for integration testing.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createIntegrationContext } from "../../../../../helpers/integration-context.js";
import {
  HarnessRuntimeService,
  type ConstraintPack,
  type HarnessRun,
  type HarnessContextSourceSet,
  type HarnessTimelineEvent,
} from "../../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: ["policy.lifecycle.test"],
    approvalMode: "required",
    autonomyMode: "supervised",
    toolPolicy: {
      allowedTools: ["read", "write", "bash"],
    },
    risk_policy: {
      maxRiskScore: 70,
      escalationThreshold: 55,
    },
    output_policy: {
      requiredEvidence: ["risk_profile"],
      redactSensitiveData: true,
    },
    budget: {
      maxSteps: 12,
      maxCost: 5.0,
      maxDurationMs: 120_000,
    },
    ...overrides,
  };
}

test("Full loop lifecycle: createRun -> appendStep -> paused(sleep) -> paused(recovery) -> resume", () => {
  const ctx = createIntegrationContext("aa-lifecycle-loop-");
  try {
    const service = new HarnessRuntimeService();

    // Step 1: Create a run
    let run = service.createRun({
      taskId: "task-lifecycle-001",
      domainId: "coding",
      constraintPack: createConstraintPack(),
    });

    assert.equal(run.status, "created");
    assert.equal(run.steps.length, 0);
    assert.ok(run.runId.startsWith("harness_run"));

    // Step 2: Append multiple steps (planner, generator, evaluator)
    run = service.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: { taskId: "task-lifecycle-001" },
      outputs: { planId: "plan-001", steps: ["step1", "step2"] },
    });
    assert.equal(run.steps.length, 1);
    assert.equal(run.steps[0]?.role, "planner");
    assert.equal(run.currentIteration, 1);

    run = service.appendStep(run, {
      role: "generator",
      stage: "execute",
      inputs: { planId: "plan-001" },
      outputs: { artifact: "code.diff" },
    });
    assert.equal(run.steps.length, 2);
    assert.equal(run.steps[1]?.role, "generator");

    run = service.appendStep(run, {
      role: "evaluator",
      stage: "evaluate",
      inputs: { artifact: "code.diff" },
      outputs: { verdict: "pass", score: 0.85 },
    });
    assert.equal(run.steps.length, 3);
    assert.equal(run.steps[2]?.role, "evaluator");

    // Step 3: Sleep the run
    const futureTime = new Date(Date.now() + 60_000).toISOString();
    run = service.sleep(run, "awaiting_resource", futureTime);
    assert.equal(run.status, "paused");
    assert.equal(run.pauseReason, "sleep");
    assert.ok(run.sleepLease);
    assert.equal(run.sleepLease?.reason, "awaiting_resource");
    assert.equal(run.sleepLease?.runId, run.runId);

    // Verify sleep lease timeline event was added
    const sleepEvent = run.timeline.find((e: HarnessTimelineEvent) => e.type === "sleep_started");
    assert.ok(sleepEvent);
    assert.deepEqual(sleepEvent.payload, { reason: "awaiting_resource", resumeAt: futureTime });

    // Step 4: Recover from sleep
    run = service.recover(run);
    assert.equal(run.status, "paused");
    assert.equal(run.pauseReason, "recovery");
    assert.ok(run.recoveryCheckpoint);
    assert.equal(run.recoveryCheckpoint?.runId, run.runId);
    assert.equal(run.recoveryCheckpoint?.statusBeforeRecovery, "paused");
    assert.equal(run.recoveryCheckpoint?.lastCompletedStepId, run.steps[2]?.stepId);

    // Verify recovery timeline event was added
    const recoveryEvent = run.timeline.find((e: HarnessTimelineEvent) => e.type === "recovery_started");
    assert.ok(recoveryEvent);
    assert.deepEqual(recoveryEvent.payload, { statusBeforeRecovery: "paused" });

    // Step 5: Resume the run
    run = service.resume(run);
    assert.equal(run.status, "running");
    assert.equal(run.sleepLease, null);
    assert.equal(run.recoveryCheckpoint, null); // resume clears recovery checkpoint
  } finally {
    ctx.cleanup();
  }
});

test("Context assembly and snapshotting across run lifecycle", () => {
  const ctx = createIntegrationContext("aa-context-assembly-");
  try {
    const service = new HarnessRuntimeService();

    const run = service.createRun({
      taskId: "task-context-001",
      domainId: "coding",
      constraintPack: createConstraintPack(),
    });

    // Assemble context with various sources
    const sources: HarnessContextSourceSet = {
      conversation: { threadId: "thread-123", messageCount: 5 },
      task: { objective: "implement feature X", priority: "high" },
      memory: { lastPlan: "plan-abc", attemptCount: 2 },
      knowledge: { domain: "coding", language: "typescript" },
    };

    const context = service.assembleContext(sources, 4096);

    assert.equal(context.tokenBudget, 4096);
    assert.equal(context.task.threadId, "thread-123");
    assert.equal(context.task.objective, "implement feature X");
    assert.equal(context.task.lastPlan, "plan-abc");
    assert.equal(context.task.language, "typescript");
    assert.ok(context.contextId.startsWith("harness_context"));
    assert.ok(context.assembledAt);

    // Snapshot the context for the run
    const snapshot = service.snapshotContext(run, context);

    assert.equal(snapshot.runId, run.runId);
    assert.equal(snapshot.domainId, "coding");
    assert.equal(snapshot.iteration, 0);
    assert.equal(snapshot.stepCount, 0);
    assert.equal(snapshot.lastDecisionId, null);
    assert.ok(snapshot.snapshotId.startsWith("ctx_snapshot"));
    assert.equal(snapshot.capturedAt, context.assembledAt);

    // Append a step and verify snapshot updates
    let updatedRun = service.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: { taskId: "task-context-001" },
      outputs: { planId: "plan-context" },
    });

    const contextSnapshot = service.captureContextSnapshot(updatedRun);
    assert.equal(contextSnapshot.stepCount, 1);
    assert.equal(contextSnapshot.iteration, 1);
  } finally {
    ctx.cleanup();
  }
});

test("Persist and checkpoint flow: persistRun -> checkpointRun -> restoreFromCheckpoint", () => {
  const ctx = createIntegrationContext("aa-checkpoint-");
  try {
    const service = new HarnessRuntimeService();

    // Create and complete a run
    const run = service.runLoop({
      taskId: "task-checkpoint-001",
      domainId: "coding",
      constraintPack: createConstraintPack(),
      plannerOutput: { planId: "plan-cp-001" },
      generatorOutput: { artifact: "patch.diff" },
      evaluatorOutput: { verdict: "pass" },
      evaluatorScore: 0.88,
      producedEvidenceRefs: ["risk_profile"],
    });

    assert.equal(run.status, "completed");
    assert.ok(run.steps.length > 0);

    // Step 1: Persist the run
    const persisted = service.persistRun(run);
    assert.equal(persisted.run.runId, run.runId);
    assert.equal(persisted.checkpointRef, null); // First persist has no checkpoint ref

    // Step 2: Create a checkpoint
    const checkpointRef = service.checkpointRun(run);
    assert.equal(typeof checkpointRef, "string");
    assert.ok(checkpointRef.startsWith("harness_checkpoint"));

    // Step 3: Verify persisted record now has checkpoint ref
    const persistedAfterCheckpoint = service.persistRun(run);
    assert.equal(persistedAfterCheckpoint.checkpointRef, checkpointRef);

    // Step 4: Restore the run (latest version)
    const restored = service.restoreRun(run.runId);
    assert.ok(restored);
    assert.equal(restored.runId, run.runId);
    assert.equal(restored.status, run.status);
    assert.equal(restored.steps.length, run.steps.length);

    // Step 5: Restore from specific checkpoint
    const restoredFromCheckpoint = service.restoreFromCheckpoint(checkpointRef);
    assert.ok(restoredFromCheckpoint);
    assert.equal(restoredFromCheckpoint.runId, run.runId);
    assert.equal(restoredFromCheckpoint.status, run.status);

    // Step 6: Attempt to restore non-existent checkpoint returns null
    const nonexistent = service.restoreFromCheckpoint("nonexistent-checkpoint");
    assert.equal(nonexistent, null);

    // Step 7: Attempt to restore non-existent runId returns null
    const nonexistentRun = service.restoreRun("nonexistent-run-id");
    assert.equal(nonexistentRun, null);
  } finally {
    ctx.cleanup();
  }
});

test("Recovery flow: handleFailure with worker_crash", () => {
  const ctx = createIntegrationContext("aa-recovery-crash-");
  try {
    const service = new HarnessRuntimeService();

    const run = service.runLoop({
      taskId: "task-recovery-crash-001",
      domainId: "coding",
      constraintPack: createConstraintPack(),
      plannerOutput: { planId: "plan-recovery" },
      generatorOutput: { artifact: "code.diff" },
      evaluatorOutput: { verdict: "pass" },
      evaluatorScore: 0.9,
      producedEvidenceRefs: ["risk_profile"],
    });

    // Create a checkpoint before failure
    const checkpointRef = service.checkpointRun(run);
    assert.equal(typeof checkpointRef, "string");

    // Handle worker_crash failure
    const recovered = service.handleFailure(run, "worker_crash");

    assert.equal(recovered.status, "paused");
    assert.equal(recovered.pauseReason, "sleep");
    assert.ok(recovered.recoveryCheckpoint);
    assert.equal(recovered.recoveryCheckpoint?.runId, run.runId);
    assert.equal(recovered.recoveryCheckpoint?.lastCompletedStepId, run.steps.at(-1)?.stepId ?? null);
    assert.equal(recovered.recoveryCheckpoint?.statusBeforeRecovery, "completed");
    assert.ok(recovered.sleepLease != null);
  } finally {
    ctx.cleanup();
  }
});

test("Recovery flow: handleFailure with tool_timeout (auto-resume)", () => {
  const ctx = createIntegrationContext("aa-recovery-timeout-");
  try {
    const service = new HarnessRuntimeService();

    const run = service.runLoop({
      taskId: "task-recovery-timeout-001",
      domainId: "coding",
      constraintPack: createConstraintPack(),
      plannerOutput: { planId: "plan-timeout" },
      generatorOutput: { artifact: "code.diff" },
      evaluatorOutput: { verdict: "pass" },
      evaluatorScore: 0.85,
      producedEvidenceRefs: ["risk_profile"],
    });

    // Create a checkpoint
    const checkpointRef = service.checkpointRun(run);
    assert.equal(typeof checkpointRef, "string");

    // Handle tool_timeout - should auto-resume
    const recovered = service.handleFailure(run, "tool_timeout");

    assert.equal(recovered.status, "paused"); // tool_timeout now pauses with retry lease
    assert.equal(recovered.pauseReason, "sleep");
    assert.ok(recovered.recoveryCheckpoint != null);
    assert.ok(recovered.sleepLease != null);
  } finally {
    ctx.cleanup();
  }
});

test("Recovery flow: handleFailure with operator_abort (immediate abort)", () => {
  const ctx = createIntegrationContext("aa-recovery-abort-");
  try {
    const service = new HarnessRuntimeService();

    const run = service.runLoop({
      taskId: "task-recovery-abort-001",
      domainId: "coding",
      constraintPack: createConstraintPack(),
      plannerOutput: { planId: "plan-abort" },
      generatorOutput: { artifact: "code.diff" },
      evaluatorOutput: { verdict: "pass" },
      evaluatorScore: 0.85,
      producedEvidenceRefs: ["risk_profile"],
    });

    // Handle operator_abort - should immediately abort
    const aborted = service.handleFailure(run, "operator_abort");

    assert.equal(aborted.status, "aborted");
    assert.ok(aborted.completedAt);
    assert.ok(aborted.recoveryCheckpoint != null);
  } finally {
    ctx.cleanup();
  }
});

test("Guardrail evaluation in context of full loop records guardrails before repeated replans exhaust the loop budget", () => {
  const ctx = createIntegrationContext("aa-guardrail-loop-");
  try {
    const service = new HarnessRuntimeService();

    // Run loop with a low score. The loop keeps replanning until it exhausts
    // the step budget, so the terminal outcome is an abort rather than a
    // single-iteration replan.
    const run = service.runLoop({
      taskId: "task-guardrail-001",
      domainId: "coding",
      constraintPack: createConstraintPack({
        output_policy: {
          requiredEvidence: [], // No required evidence to avoid evidence findings
          redactSensitiveData: true,
        },
        budget: {
          maxSteps: 9, // Small budget to trigger iteration exhaustion
          maxCost: 5,
          maxDurationMs: 60_000,
        },
      }),
      plannerOutput: { planId: "plan-guardrail-001" },
      generatorOutput: { artifact: "draft.patch" },
      evaluatorOutput: { verdict: "retry" },
      evaluatorScore: 0.42, // Low score triggers replan
    });

    // Verify guardrail assessment was performed
    assert.ok(run.guardrailAssessment);

    // Verify decision was made against the full loop outcome.
    assert.ok(run.decision);
    assert.equal(run.decision?.action, "abort");
    assert.equal(run.status, "aborted");

    // Verify feedback envelope was created
    assert.ok(run.feedbackEnvelope);
    assert.ok(run.feedbackEnvelope.signals.includes("harness.max_iterations_reached"));

    // Verify timeline contains the intermediate replan decisions and the
    // terminal abort recorded by the full loop.
    const decisionActions = run.timeline
      .filter((e: HarnessTimelineEvent) => e.type === "decision_recorded")
      .map((e: HarnessTimelineEvent) => e.payload.action);
    assert.ok(decisionActions.includes("replan"));
    assert.ok(decisionActions.includes("abort"));

    const guardrailEvent = run.timeline.find((e: HarnessTimelineEvent) => e.type === "guardrails_evaluated");
    assert.ok(guardrailEvent);
  } finally {
    ctx.cleanup();
  }
});

test("runLoop completes with accept decision when evaluator score is high", () => {
  const ctx = createIntegrationContext("aa-runloop-accept-");
  try {
    const service = new HarnessRuntimeService();

    const run = service.runLoop({
      taskId: "task-accept-001",
      domainId: "coding",
      constraintPack: createConstraintPack(),
      plannerOutput: { planId: "plan-accept-001" },
      generatorOutput: { artifact: "final.patch" },
      evaluatorOutput: { verdict: "pass" },
      evaluatorScore: 0.92,
      producedEvidenceRefs: ["risk_profile"],
    });

    assert.equal(run.status, "completed");
    assert.equal(run.decision?.action, "accept");
    assert.ok(run.completedAt);
    assert.ok(run.feedbackEnvelope);
    assert.ok(run.feedbackEnvelope.signals.includes("harness.accepted"));
  } finally {
    ctx.cleanup();
  }
});

test("runLoop escalates to HITL when requiresHuman is true", () => {
  const ctx = createIntegrationContext("aa-runloop-hitl-");
  try {
    const service = new HarnessRuntimeService();

    const run = service.runLoop({
      taskId: "task-hitl-escalate-001",
      domainId: "legal",
      constraintPack: createConstraintPack(),
      plannerOutput: { planId: "plan-legal-001" },
      generatorOutput: { artifact: "contract-review" },
      evaluatorOutput: { verdict: "needs-human" },
      evaluatorScore: 0.8,
      requiresHuman: true,
      riskScore: 62,
      producedEvidenceRefs: [],
    });

    assert.equal(run.status, "paused");
    assert.equal(run.pauseReason, "hitl");
    assert.equal(run.decision?.action, "escalate_to_human");
    assert.ok(run.hitlRequest);
    assert.equal(run.hitlRequest?.status, "pending");
  } finally {
    ctx.cleanup();
  }
});

test("runLoop aborts when max iterations reached", () => {
  const ctx = createIntegrationContext("aa-runloop-abort-");
  try {
    const service = new HarnessRuntimeService();

    const run = service.runLoop({
      taskId: "task-abort-001",
      domainId: "coding",
      constraintPack: createConstraintPack({
        budget: {
          maxSteps: 3, // Very small budget
          maxCost: 1,
          maxDurationMs: 30_000,
        },
      }),
      plannerOutput: { planId: "plan-abort-001" },
      generatorOutput: { artifact: "code.diff" },
      evaluatorOutput: { verdict: "pass" },
      evaluatorScore: 0.5, // Mid score that would replan
      producedEvidenceRefs: ["risk_profile"],
    });

    assert.equal(run.status, "aborted");
    assert.equal(run.decision?.action, "abort");
    assert.ok(run.completedAt);
    assert.ok(run.feedbackEnvelope?.signals.some((s: string) => s.includes("harness.max_iterations")));
  } finally {
    ctx.cleanup();
  }
});

test("Decide function produces correct actions based on inputs", () => {
  const ctx = createIntegrationContext("aa-decide-");
  try {
    const service = new HarnessRuntimeService();

    // Test: accept when score is high
    const acceptDecision = service.decide({
      evaluatorScore: 0.85,
      requiresHuman: false,
      maxIterationsReached: false,
    });
    assert.equal(acceptDecision.action, "accept");
    assert.ok(acceptDecision.reasonCodes.includes("harness.accepted"));

    // Test: retry_same_plan when score is between 0.5 and 0.75
    const retryDecision = service.decide({
      evaluatorScore: 0.6,
      requiresHuman: false,
      maxIterationsReached: false,
    });
    assert.equal(retryDecision.action, "retry_same_plan");

    // Test: replan when score is below 0.5
    const replanDecision = service.decide({
      evaluatorScore: 0.4,
      requiresHuman: false,
      maxIterationsReached: false,
    });
    assert.equal(replanDecision.action, "replan");

    // Test: abort when max iterations reached
    const abortDecision = service.decide({
      evaluatorScore: 0.9,
      requiresHuman: false,
      maxIterationsReached: true,
    });
    assert.equal(abortDecision.action, "abort");
    assert.ok(abortDecision.reasonCodes.includes("harness.max_iterations_reached"));

    // Test: escalate_to_human when requiresHuman is true
    const escalateDecision = service.decide({
      evaluatorScore: 0.9,
      requiresHuman: true,
      maxIterationsReached: false,
    });
    assert.equal(escalateDecision.action, "escalate_to_human");
    assert.ok(escalateDecision.reasonCodes.includes("harness.human_required"));
  } finally {
    ctx.cleanup();
  }
});

test("Invariant checking: iteration_exceeds_budget violation", () => {
  const ctx = createIntegrationContext("aa-invariant-iter-");
  try {
    const service = new HarnessRuntimeService();

    const run = service.createRun({
      taskId: "task-invariant-001",
      domainId: "coding",
      constraintPack: createConstraintPack({
        budget: { maxSteps: 5, maxCost: 1, maxDurationMs: 30_000 },
      }),
    });

    // Manually create a run that violates iteration budget
    const violatingRun: HarnessRun = {
      ...run,
      loopMetrics: {
        ...run.loopMetrics!,
        iterationCount: 10, // Exceeds maxSteps=5
      },
    };

    const { violations } = service.assertInvariants(violatingRun);
    assert.ok(violations.includes("harness.invariant.iteration_exceeds_budget"));
  } finally {
    ctx.cleanup();
  }
});

test("Invariant checking: paused HITL run without hitlRequest", () => {
  const ctx = createIntegrationContext("aa-invariant-hitl-");
  try {
    const service = new HarnessRuntimeService();

    const run = service.createRun({
      taskId: "task-invariant-hitl-001",
      domainId: "coding",
      constraintPack: createConstraintPack(),
    });

    // Manually create a paused HITL run without a request to verify the invariant.
    const violatingRun: HarnessRun = {
      ...run,
      status: "paused",
      pauseReason: "hitl",
      hitlRequest: null,
    };

    const { violations } = service.assertInvariants(violatingRun);
    assert.ok(violations.includes("harness.invariant.awaiting_hitl_requires_request"));
  } finally {
    ctx.cleanup();
  }
});

test("Multiple sequential checkpoint/restore cycles", () => {
  const ctx = createIntegrationContext("aa-multicheckpoint-");
  try {
    const service = new HarnessRuntimeService();

    const run1 = service.runLoop({
      taskId: "task-multi-cp-001",
      domainId: "coding",
      constraintPack: createConstraintPack(),
      plannerOutput: { planId: "plan-cp-1" },
      generatorOutput: { artifact: "v1.diff" },
      evaluatorOutput: { verdict: "pass" },
      evaluatorScore: 0.88,
      producedEvidenceRefs: ["risk_profile"],
    });

    // First checkpoint
    const cp1 = service.checkpointRun(run1);

    // Create a second version of the run
    const run2 = service.runLoop({
      taskId: "task-multi-cp-002",
      domainId: "coding",
      constraintPack: createConstraintPack(),
      plannerOutput: { planId: "plan-cp-2" },
      generatorOutput: { artifact: "v2.diff" },
      evaluatorOutput: { verdict: "pass" },
      evaluatorScore: 0.90,
      producedEvidenceRefs: ["risk_profile"],
    });

    // Second checkpoint
    const cp2 = service.checkpointRun(run2);

    // Restore from first checkpoint
    const restored1 = service.restoreFromCheckpoint(cp1);
    assert.ok(restored1);
    assert.equal(restored1.runId, run1.runId);
    assert.equal(restored1.status, run1.status);

    // Restore from second checkpoint
    const restored2 = service.restoreFromCheckpoint(cp2);
    assert.ok(restored2);
    assert.equal(restored2.runId, run2.runId);
    assert.equal(restored2.status, run2.status);

    // Checkpoints should be different
    assert.notEqual(cp1, cp2);
  } finally {
    ctx.cleanup();
  }
});
