import assert from "node:assert/strict";
import test from "node:test";

import { createPlanGraphBundle } from "../../../../src/platform/contracts/executable-contracts/index.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";
import { OapeflirLoopService } from "../../../../src/platform/five-plane-orchestration/oapeflir/oapeflir-loop-service.js";
import { HarnessLoopController } from "../../../../src/platform/five-plane-orchestration/harness/loop/index.js";
import type { ConstraintPack } from "../../../../src/platform/five-plane-orchestration/harness/index.js";

function createMinimalPlanGraphBundle() {
  return createPlanGraphBundle({
    planGraphBundleId: "plan_bundle_test",
    harnessRunId: "harness_run_test",
    graph: {
      graphId: newId("graph"),
      nodes: [
        {
          nodeId: "node_1",
          nodeType: "tool_call",
          inputRefs: [],
          outputSchemaRef: "schema:test.output",
          riskClass: "high",
          budgetIntent: { amount: 1, currency: "USD", resourceKinds: ["token"] as const },
          sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
          retryPolicyRef: "retry:default",
          timeoutMs: 1000,
        },
      ],
      edges: [],
      entryNodeIds: ["node_1"],
      terminalNodeIds: ["node_1"],
      joinStrategy: "all",
      graphHash: newId("hash"),
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

test("emitOapeflirEvent preserves canonical oapeflir eventType instead of overwriting it", () => {
  const published: Array<{ eventType: string; taskId: string | null | undefined; payload: Record<string, unknown> }> = [];
  const service = new OapeflirLoopService({
    eventPublisher: {
      publish(input: { eventType: string; taskId?: string | null; payload: Record<string, unknown> }) {
        published.push(input);
      },
    } as never,
  });

  (service as unknown as {
    emitOapeflirEvent: (eventType: string, payload: Record<string, unknown>, taskId: string) => void;
  }).emitOapeflirEvent("oapeflir.phase.transition", {
    fromPhase: "observe",
    toPhase: "assess",
    occurredAt: "2026-05-06T00:00:00.000Z",
  }, "task_event");

  assert.equal(published.length, 1);
  assert.equal(published[0]?.eventType, "oapeflir.phase.transition");
  assert.equal(published[0]?.taskId, "task_event");
  assert.equal(published[0]?.payload.fromPhase, "observe");
  assert.equal(published[0]?.payload.toPhase, "assess");
});

test("buildDecisionInputBundle keeps high-risk downgrade score independent from evaluator confidence", () => {
  const service = new OapeflirLoopService();
  const bundle = (service as unknown as {
    buildDecisionInputBundle: (input: {
      taskId: string;
      harnessRunId: string;
      planGraphBundle: ReturnType<typeof createMinimalPlanGraphBundle>;
      assessment: { risk: "high" };
      feedback: { feedbackId: string; signals: Array<{ stepOutputRefs?: string[] }> };
      qualityGate: { accepted: false; reasonCodes: string[] };
      replanDecision: { shouldReplan: true };
      evaluationReport: { score: number; recommendation: string; confidence: number };
      stepOutputs: Array<{ userFacingResult: { artifacts: string[] }; systemTelemetry: { durationMs: number } }>;
      constraintPack?: { risk_policy?: { escalationThreshold: number } };
    }) => { risk: { currentScore: number; escalationThreshold: number } };
  }).buildDecisionInputBundle({
    taskId: "task_risk",
    harnessRunId: "harness_risk",
    planGraphBundle: createMinimalPlanGraphBundle(),
    assessment: { risk: "high" },
    feedback: { feedbackId: "feedback_1", signals: [] },
    qualityGate: { accepted: false, reasonCodes: ["quality.repair_required"] },
    replanDecision: { shouldReplan: true },
    evaluationReport: { score: 0.42, recommendation: "downgrade_mode", confidence: 0.5 },
    stepOutputs: [
      {
        userFacingResult: { artifacts: [] },
        systemTelemetry: { durationMs: 100 },
      },
    ],
    constraintPack: { risk_policy: { escalationThreshold: 0.8 } },
  });

  assert.equal(bundle.risk.currentScore, 0.85);
  assert.equal(bundle.risk.escalationThreshold, 0.8);
  assert.ok(bundle.risk.currentScore > bundle.risk.escalationThreshold);
});

test("assertGuardAllowsStage blocks assess before the loop enters a budget-exhausted stage", () => {
  const published: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  const service = new OapeflirLoopService({
    eventPublisher: {
      publish(input: { eventType: string; taskId?: string | null; payload: Record<string, unknown> }) {
        published.push({ eventType: input.eventType, payload: input.payload });
      },
    } as never,
  });

  const constraintPack: ConstraintPack = {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "semi_auto",
    tool_policy: { allowedTools: [] },
    budgetEnvelope: { maxSteps: 3, maxCost: 10, maxDurationMs: 0 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 1000 },
    approvalRequirement: { requiredForRiskClass: [], approverRoles: [], escalationTimeoutMs: 1000 },
  };

  (service as unknown as { loopController: HarnessLoopController | null }).loopController = new HarnessLoopController(
    constraintPack,
    {},
    { startedAt: Date.now() - 10 },
  );

  assert.throws(
    () =>
      (service as unknown as {
        assertGuardAllowsStage: (stage: "assess" | "plan" | "execute", taskId: string) => void;
      }).assertGuardAllowsStage("assess", "task_guard"),
    /oapeflir\.guard_blocked_before_assess: harness\.guard\.max_duration_exceeded/,
  );
  assert.equal(published.at(-1)?.eventType, "oapeflir.decision.recorded");
  assert.equal(published.at(-1)?.payload.reasonCode, "harness.guard.max_duration_exceeded");
});

test("buildFeedbackSignals prefers canonical nodeRunId over legacy stepId", () => {
  const service = new OapeflirLoopService();
  const signals = (service as unknown as {
    buildFeedbackSignals: (taskId: string, stepOutputs: Array<{
      nodeRunId?: string;
      stepId: string;
      planRef: string;
      status: "succeeded" | "failed" | "partial_success" | "skipped";
      userFacingResult: { summary: string; artifacts: string[] };
      systemTelemetry: { durationMs: number; tokensUsed: number; modelId: string; retryCount: number; validationPassed: boolean };
    }>) => Array<{ nodeRunId: string; stepOutputRefs: string[] }>;
  }).buildFeedbackSignals("task_node_run", [
    {
      nodeRunId: "node-run-42",
      stepId: "legacy-step-42",
      planRef: "plan-42",
      status: "succeeded",
      userFacingResult: { summary: "done", artifacts: [] },
      systemTelemetry: { durationMs: 1, tokensUsed: 1, modelId: "test", retryCount: 0, validationPassed: true },
    },
  ]);

  assert.equal(signals[0]?.nodeRunId, "node-run-42");
  assert.deepEqual(signals[0]?.stepOutputRefs, ["node-run-42"]);
});
