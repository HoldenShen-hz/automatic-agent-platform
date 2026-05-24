import assert from "node:assert/strict";
import test from "node:test";

import { createPlanGraphBundle } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { OapeflirLoopService } from "../../../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.js";
import { HarnessLoopController } from "../../../../src/platform/five-plane-orchestration/harness/loop/index.js";
import { normalizeConstraintPack, type ConstraintPack } from "../../../../src/platform/five-plane-orchestration/harness/index.js";

function createPlanGraphBundleFixture() {
  return createPlanGraphBundle({
    planGraphBundleId: "plan-bundle-test",
    harnessRunId: "harness-run-test",
    graph: {
      graphId: "graph-test",
      nodes: [{
        nodeId: "node-1",
        nodeType: "tool",
        inputRefs: [],
        outputSchemaRef: "schema:test.output",
        riskClass: "high",
        budgetIntent: { amount: 1, currency: "USD", resourceKinds: ["token"] },
        sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
        retryPolicyRef: "retry:default",
        timeoutMs: 1_000,
      }],
      edges: [],
      entryNodeIds: ["node-1"],
      terminalNodeIds: ["node-1"],
      joinStrategy: "all",
      graphHash: "graph-hash-test",
    },
    schedulerPolicy: {
      policyId: "scheduler:test",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: "budget:test",
    riskProfile: {
      riskClass: "high",
      reasons: ["test"],
    },
    validationReport: { valid: true, findings: [] },
    artifactRefs: [],
    createdAt: "2026-05-06T00:00:00.000Z",
  });
}

test("emitOapeflirEvent preserves the canonical event type", () => {
  const published: Array<{ eventType: string; taskId: string | null | undefined }> = [];
  const service = new OapeflirLoopService({
    eventPublisher: {
      publish(input: { eventType: string; taskId: string | null | undefined; payload: Record<string, unknown> }) {
        published.push({ eventType: input.eventType, taskId: input.taskId });
      },
    } as never,
  });

  (service as unknown as {
    emitOapeflirEvent: (eventType: string, payload: Record<string, unknown>, taskId: string) => void;
  }).emitOapeflirEvent("oapeflir.phase.transition", {
    fromPhase: "observe",
    toPhase: "assess",
    occurredAt: "2026-05-06T00:00:00.000Z",
  }, "task-event");

  assert.deepEqual(published, [{
    eventType: "oapeflir.phase.transition",
    taskId: "task-event",
  }]);
});

test("buildDecisionInputBundle keeps high-risk downgrade score independent from evaluator confidence", () => {
  const service = new OapeflirLoopService();
  const bundle = (service as unknown as {
    buildDecisionInputBundle: (input: {
      taskId: string;
      harnessRunId: string;
      planGraphBundle: ReturnType<typeof createPlanGraphBundleFixture>;
      assessment: { risk: "high" };
      feedback: { feedbackId: string; signals: Array<{ stepOutputRefs?: string[] }> };
      qualityGate: { accepted: false; reasonCodes: string[] };
      replanDecision: { shouldReplan: true };
      evaluationReport: { score: number; recommendation: string; confidence: number };
      stepOutputs: Array<{ userFacingResult: { artifacts: string[] }; systemTelemetry: { durationMs: number } }>;
      constraintPack?: { risk_policy?: { escalationThreshold: number } };
    }) => { risk: { currentScore: number; escalationThreshold: number }; budget: { remainingCost: number } };
  }).buildDecisionInputBundle({
    taskId: "task-risk",
    harnessRunId: "harness-risk",
    planGraphBundle: createPlanGraphBundleFixture(),
    assessment: { risk: "high" },
    feedback: { feedbackId: "feedback-1", signals: [] },
    qualityGate: { accepted: false, reasonCodes: ["quality.repair_required"] },
    replanDecision: { shouldReplan: true },
    evaluationReport: { score: 0.42, recommendation: "downgrade_mode", confidence: 0.5 },
    stepOutputs: [{
      userFacingResult: { artifacts: [] },
      systemTelemetry: { durationMs: 100 },
    }],
    constraintPack: { risk_policy: { escalationThreshold: 0.8 } },
  });

  assert.equal(bundle.risk.currentScore, 0.85);
  assert.equal(bundle.risk.escalationThreshold, 0.8);
  assert.equal(bundle.budget.remainingCost, 0);
});

test("buildFeedbackSignals prefers canonical nodeRunId over legacy stepId", () => {
  const service = new OapeflirLoopService();
  const signals = (service as unknown as {
    buildFeedbackSignals: (taskId: string, stepOutputs: Array<{
      nodeRunId?: string;
      stepId: string;
      planRef: string;
      userFacingResult: { summary: string; artifacts: string[] };
      systemTelemetry: { durationMs: number; tokensUsed: number; modelId: string; retryCount: number; validationPassed: boolean };
    }>) => Array<{ nodeRunId?: string; stepOutputRefs: string[] }>;
  }).buildFeedbackSignals("task-node-run", [{
    nodeRunId: "node-run-42",
    stepId: "legacy-step-42",
    planRef: "plan-42",
    userFacingResult: { summary: "done", artifacts: [] },
    systemTelemetry: { durationMs: 1, tokensUsed: 1, modelId: "test", retryCount: 0, validationPassed: true },
  }]);

  assert.equal(signals[0]?.nodeRunId, "node-run-42");
  assert.deepEqual(signals[0]?.stepOutputRefs, ["node-run-42"]);
});

test("assertGuardAllowsStage emits a guard-blocked decision when duration is exhausted", () => {
  const published: string[] = [];
  const service = new OapeflirLoopService({
    eventPublisher: {
      publish(input: { eventType: string; taskId: string | null | undefined; payload: Record<string, unknown> }) {
        published.push(input.eventType);
      },
    } as never,
  });
  const constraintPack: ConstraintPack = normalizeConstraintPack({
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "semi_auto",
    tool_policy: { allowedTools: [] },
    budgetEnvelope: { maxSteps: 3, maxCost: 10, maxDurationMs: 0 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 1_000 },
    approvalRequirement: { requiredForRiskClass: [], approverRoles: [], escalationTimeoutMs: 1_000 },
  });

  (service as unknown as { loopController: HarnessLoopController | null }).loopController = new HarnessLoopController(
    constraintPack,
    {},
    { startedAt: Date.now() - 10 },
  );

  assert.throws(
    () =>
      (service as unknown as {
        assertGuardAllowsStage: (stage: "assess" | "plan" | "execute", taskId: string) => void;
      }).assertGuardAllowsStage("assess", "task-guard"),
    /oapeflir\.guard_blocked_before_assess/,
  );
  assert.equal(published.at(-1), "oapeflir.decision.recorded");
});
