import assert from "node:assert/strict";
import test from "node:test";

import {
  GuardrailEngine,
  HarnessLoopController,
  HarnessRuntimeService,
  HitlRuntime,
  ToolbeltAssembler,
  type ConstraintPack,
} from "../../../../../src/platform/orchestration/harness/index.js";

function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: ["policy.default"],
    approvalMode: "supervised",
    autonomyMode: "supervised",
    toolPolicy: {
      allowedTools: ["read", "summarize"],
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
      maxSteps: 8,
      maxCost: 5,
      maxDurationMs: 60_000,
    },
    ...overrides,
  };
}

test("HarnessRuntimeService completes a planner-generator-evaluator loop", () => {
  const service = new HarnessRuntimeService();
  const run = service.runLoop({
    taskId: "task-1",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    plannerOutput: { planId: "plan-1", costUsd: 0.1 },
    generatorOutput: { artifact: "patch.diff", costUsd: 0.25 },
    evaluatorOutput: { verdict: "pass", costUsd: 0.05 },
    evaluatorScore: 0.91,
    producedEvidenceRefs: ["risk_profile"],
  });

  assert.equal(run.steps.length, 3);
  assert.equal(run.status, "completed");
  assert.equal(run.planGraphBundle.harnessRunId, run.runId);
  assert.equal(run.planGraphBundle.graph.nodes.length, 3);
  assert.equal(run.planGraphBundle.validationReport.valid, true);
  assert.equal(run.decision?.action, "accept");
  assert.equal(run.contextSnapshots.length, 1);
  assert.equal(run.steps[0]?.semanticPhase, "plan");
  assert.equal(run.timeline.some((event) => event.type === "run_created"), true);
  assert.equal(run.timeline.some((event) => event.type === "decision_recorded"), true);
  assert.ok((run.loopMetrics?.totalCost ?? 0) > 0);
});

test("HarnessRuntimeService routes retry and replan through loop controller guards", () => {
  const service = new HarnessRuntimeService();
  const run = service.runLoop({
    taskId: "task-loop-guard",
    domainId: "coding",
    constraintPack: createConstraintPack({
      output_policy: {
        requiredEvidence: [],
        redactSensitiveData: true,
      },
      budget: {
        maxSteps: 9,
        maxCost: 5,
        maxDurationMs: 60_000,
      },
    }),
    plannerOutput: { planId: "plan-loop-guard" },
    generatorOutput: { artifact: "draft.patch" },
    evaluatorOutput: { verdict: "retry" },
    evaluatorScore: 0.42,
  });

  assert.equal(run.steps.length, 9);
  assert.equal(run.currentIteration, 3);
  assert.equal(run.status, "aborted");
  assert.equal(run.decision?.action, "abort");
  assert.ok(run.feedbackEnvelope);
  assert.ok(run.decision?.reasonCodes.length);
});

test("HarnessRuntimeService escalates to human when runtime requires HITL", () => {
  const service = new HarnessRuntimeService();
  const run = service.runLoop({
    taskId: "task-2",
    domainId: "legal",
    constraintPack: createConstraintPack(),
    plannerOutput: { planId: "plan-2" },
    generatorOutput: { artifact: "contract-review" },
    evaluatorOutput: { verdict: "needs-human" },
    evaluatorScore: 0.8,
    riskScore: 62,
    producedEvidenceRefs: [],
  });

  assert.equal(run.status, "waiting_hitl");
  assert.equal(run.decision?.action, "escalate_to_human");
  assert.equal(run.hitlRequest?.status, "pending");
});

test("HarnessRuntimeService replans or aborts based on evaluator score and budget", () => {
  const service = new HarnessRuntimeService();
  const replanDecision = service.decide({
    evaluatorScore: 0.42,
    requiresHuman: false,
    maxIterationsReached: false,
  });
  const abortDecision = service.decide({
    evaluatorScore: 0.9,
    maxIterationsReached: true,
  });

  assert.equal(replanDecision.action, "replan");
  assert.equal(abortDecision.action, "abort");
});

test("HarnessRuntimeService supports sleep recover and resume lifecycle transitions", () => {
  const service = new HarnessRuntimeService();
  const created = service.createRun({
    taskId: "task-3",
    domainId: "finance-accounting",
    constraintPack: createConstraintPack(),
  });
  const sleeping = service.sleep(created, "awaiting_budget", "2026-04-23T00:00:00.000Z");
  const recovering = service.recover(sleeping);
  const resumed = service.resume(recovering);

  assert.equal(created.status, "created");
  assert.equal(sleeping.status, "sleeping");
  assert.equal(recovering.status, "recovering");
  assert.equal(resumed.status, "running");
  assert.equal(resumed.sleepLease, null);
});

test("ToolbeltAssembler grants only allowed tools and GuardrailEngine blocks unsafe requests", () => {
  const toolbelt = new ToolbeltAssembler().assemble({
    allowedTools: ["read", "summarize"],
    requestedTools: ["read", "write"],
    requiredEvidence: ["risk_profile"],
  });
  const assessment = new GuardrailEngine().assess({
    toolbelt,
    evidenceRefs: [],
    riskScore: 95,
    maxRiskScore: 70,
    escalationThreshold: 55,
    currentStepCount: 2,
    maxSteps: 8,
  });

  assert.deepEqual(toolbelt.grantedTools, ["read"]);
  assert.deepEqual(toolbelt.blockedTools, ["write"]);
  assert.equal(assessment.passed, false);
  assert.equal(assessment.suggestedAction, "abort");
});

test("HitlRuntime resolves manual review requests and HarnessRuntimeService can resume approved runs", () => {
  const hitlRuntime = new HitlRuntime();
  const service = new HarnessRuntimeService({ hitlRuntime });
  const waiting = service.runLoop({
    taskId: "task-4",
    domainId: "legal",
    constraintPack: createConstraintPack(),
    plannerOutput: { planId: "plan-4" },
    generatorOutput: { artifact: "legal-review" },
    evaluatorOutput: { verdict: "manual-review" },
    evaluatorScore: 0.84,
    producedEvidenceRefs: [],
    riskScore: 60,
  });

  assert.equal(waiting.status, "waiting_hitl");
  assert.equal(waiting.hitlRequest?.status, "pending");

  const approved = service.resolveHitlReview(waiting, "approved", "legal_manager");
  assert.equal(approved.status, "running");
  assert.equal(approved.hitlRequest?.status, "approved");
  assert.equal(approved.hitlRequest?.resolvedBy, "legal_manager");
});

test("HarnessRuntimeService stores run/domain memory and enforces invariants", () => {
  const service = new HarnessRuntimeService();
  const run = service.runLoop({
    taskId: "task-5",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    plannerOutput: { planId: "plan-5" },
    generatorOutput: { artifact: "patch.diff" },
    evaluatorOutput: { verdict: "pass" },
    evaluatorScore: 0.92,
    producedEvidenceRefs: ["risk_profile"],
  });

  service.writeMemory(run, "run", "release_ticket", "CHG-5");
  service.writeMemory(run, "domain", "last_release_owner", "eng_manager");

  assert.equal(service.readMemory(run, "run", "release_ticket"), "CHG-5");
  assert.equal(service.readMemory(run, "domain", "last_release_owner"), "eng_manager");
  assert.deepEqual(service.assertInvariants(run).violations, []);
});

test("HarnessRuntimeService assertInvariants collects the full named invariant set", () => {
  const service = new HarnessRuntimeService();
  const run = {
    ...service.createRun({
      taskId: "task-invariants",
      domainId: "coding",
      constraintPack: createConstraintPack({
        budget: { maxSteps: 3, maxCost: 1, maxDurationMs: 1000 },
      }),
    }),
    currentIteration: 5,
    status: "aborted" as const,
    completedAt: null,
    decision: {
      decisionId: "decision-1",
      action: "retry_same_plan" as const,
      reasonCodes: ["retry"],
      confidence: 0.4,
      createdAt: "2026-04-21T00:00:00.000Z",
    },
    toolbelt: {
      allowedTools: [],
      grantedTools: [],
      blockedTools: ["write"],
      requiredEvidence: ["risk_profile"],
    },
    guardrailAssessment: {
      passed: false,
      requiresHuman: false,
      suggestedAction: "abort" as const,
      findings: [
        {
          layer: "evidence" as const,
          severity: "warn" as const,
          code: "harness.guardrail.required_evidence_missing",
          message: "missing evidence",
        },
        {
          layer: "risk" as const,
          severity: "block" as const,
          code: "harness.guardrail.max_risk_exceeded",
          message: "risk too high",
        },
      ],
    },
    loopMetrics: {
      iterationCount: 5,
      replanCount: 4,
      totalCost: 2,
      durationMs: 5000,
      maxIterations: 3,
      maxCost: 1,
      maxDurationMs: 1000,
    },
  };

  const violations = service.assertInvariants(run).violations;
  assert.ok(violations.includes("harness.invariant.iteration_exceeds_budget"));
  assert.ok(violations.includes("harness.invariant.replan_count_exceeds_budget"));
  assert.ok(violations.includes("harness.invariant.total_cost_exceeds_budget"));
  assert.ok(violations.includes("harness.invariant.duration_exceeds_budget"));
  assert.ok(violations.includes("harness.invariant.final_state_requires_completed_at"));
  assert.ok(violations.includes("harness.invariant.non_accept_decision_requires_feedback"));
  assert.ok(violations.includes("harness.invariant.blocked_tool_requested"));
  assert.ok(violations.includes("harness.invariant.required_evidence_missing"));
  assert.ok(violations.includes("harness.invariant.max_risk_exceeded"));
});

test("HarnessRuntimeService evaluates runs and AsyncHarnessService executes queued work", async () => {
  const service = new HarnessRuntimeService();
  const asyncHarness = service.createAsyncService();
  const runId = await asyncHarness.createRun({
    taskId: "task-6",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    plannerOutput: { planId: "plan-6" },
    generatorOutput: { artifact: "patch.diff" },
    evaluatorOutput: { verdict: "pass" },
    evaluatorScore: 0.9,
    producedEvidenceRefs: ["risk_profile"],
  });

  assert.equal(asyncHarness.getRunStatus(runId), "queued");

  const run = await asyncHarness.execute(runId);
  const report = service.evaluateRun(run);

  assert.equal(asyncHarness.getRunStatus(runId), "completed");
  assert.equal(report.overallPassed, true);
  assert.equal(report.timelineEventCount >= 3, true);
});

test("HarnessLoopController is exported from harness index", () => {
  const controller = new HarnessLoopController(createConstraintPack({
    budget: {
      maxSteps: 9,
      maxCost: 5,
      maxDurationMs: 60_000,
    },
  }));

  controller.recordIteration();
  assert.equal(controller.getState().iteration, 1);
});

test("HarnessRuntimeService assembles context and snapshots it for the run", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-7",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });
  const context = service.assembleContext(
    {
      conversation: { threadId: "thread-1" },
      task: { objective: "prepare governed patch" },
      memory: { recentFailure: "none" },
      knowledge: { namespace: "coding/default" },
    },
    2048,
  );
  const snapshot = service.snapshotContext(run, context);

  assert.equal(context.tokenBudget, 2048);
  assert.equal(context.task.objective, "prepare governed patch");
  assert.equal(snapshot.runId, run.runId);
  assert.equal(snapshot.domainId, "coding");
});

test("HarnessRuntimeService persists runs, creates checkpoints, and restores from durable state", () => {
  const service = new HarnessRuntimeService();
  const run = service.runLoop({
    taskId: "task-8",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    plannerOutput: { planId: "plan-8" },
    generatorOutput: { artifact: "patch.diff" },
    evaluatorOutput: { verdict: "pass" },
    evaluatorScore: 0.89,
    producedEvidenceRefs: ["risk_profile"],
  });

  const persisted = service.persistRun(run);
  const checkpointRef = service.checkpointRun(run);
  const restored = service.restoreRun(run.runId);
  const restoredFromCheckpoint = service.restoreFromCheckpoint(checkpointRef);

  assert.equal(persisted.run.runId, run.runId);
  assert.equal(typeof checkpointRef, "string");
  assert.equal(restored?.runId, run.runId);
  assert.equal(restoredFromCheckpoint?.runId, run.runId);
});

test("HarnessRuntimeService uses RecoveryController to recover from persisted failures", () => {
  const service = new HarnessRuntimeService();
  const run = service.runLoop({
    taskId: "task-9",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    plannerOutput: { planId: "plan-9" },
    generatorOutput: { artifact: "patch.diff" },
    evaluatorOutput: { verdict: "pass" },
    evaluatorScore: 0.9,
    producedEvidenceRefs: ["risk_profile"],
  });

  const checkpointRef = service.checkpointRun(run);
  assert.equal(typeof checkpointRef, "string");

  const recovered = service.handleFailure(run, "worker_crash");
  const resumed = service.handleFailure(run, "tool_timeout");

  assert.equal(recovered.status, "recovering");
  assert.equal(recovered.recoveryCheckpoint?.lastCompletedStepId, run.steps.at(-1)?.stepId ?? null);
  assert.equal(resumed.status, "running");
});
