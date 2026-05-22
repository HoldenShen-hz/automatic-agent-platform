/**
 * Replanning Service Unit Tests
 * R5-1 FIX: Updated to use PlanGraphBundle instead of legacy Plan
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ReplanningService } from "../../../../../src/platform/five-plane-orchestration/planner/replanning-service.js";
import { newId } from "../../../../../src/platform/contracts/types/ids.js";

/**
 * R5-1 FIX: makePlanGraphBundle creates a proper PlanGraphBundle for testing
 * instead of the legacy Plan { steps[] } type.
 */
function makePlanGraphBundle(overrides: Partial<{
  planGraphBundleId: string;
  harnessRunId: string;
  graphVersion: number;
}> = {}): ReturnType<typeof createPlanGraphBundle> {
  const planGraphBundleId = overrides.planGraphBundleId ?? "pgb-001";
  const harnessRunId = overrides.harnessRunId ?? "harness-run-001";
  const graphVersion = overrides.graphVersion ?? 1;

  return {
    planGraphBundleId,
    harnessRunId,
    graphVersion,
    graph: {
      graphId: newId("graph"),
      nodes: [
        {
          nodeId: "node-1",
          nodeType: "tool" as const,
          inputRefs: [],
          outputSchemaRef: "schema:node.1",
          riskClass: "medium" as const,
          budgetIntent: { amount: 1000, currency: "USD", resourceKinds: ["compute"] as const },
          sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
          retryPolicyRef: "retry:node.1",
          timeoutMs: 60000,
        },
        {
          nodeId: "node-2",
          nodeType: "tool" as const,
          inputRefs: ["node-1"],
          outputSchemaRef: "schema:node.2",
          riskClass: "medium" as const,
          budgetIntent: { amount: 1000, currency: "USD", resourceKinds: ["compute"] as const },
          sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
          retryPolicyRef: "retry:node.2",
          timeoutMs: 60000,
        },
      ],
      edges: [
        {
          edgeId: newId("edge"),
          fromNodeId: "node-1",
          toNodeId: "node-2",
          condition: { type: "always" as const },
          dependencyType: "hard" as const,
        },
      ],
      entryNodeIds: ["node-1"],
      terminalNodeIds: ["node-2"],
      joinStrategy: "all" as const,
      graphHash: `${harnessRunId}:${planGraphBundleId}:${graphVersion}:2`,
    },
    schedulerPolicy: {
      policyId: "scheduler:oapeflir.deterministic_fifo",
      strategy: "deterministic_fifo" as const,
    },
    budgetPlanRef: `budget:plan.${planGraphBundleId}`,
    riskProfile: { riskClass: "medium" as const, reasons: ["test.default"] },
    validationReport: { valid: true, findings: [] },
    artifactRefs: [],
    createdAt: new Date().toISOString(),
  };
}

function makeFeedback(overrides: Partial<{
  outcome: "repairable" | "failed" | "escalated" | "succeeded";
  signals: Array<{ category: string }>;
}> = {}): {
  outcome: "repairable" | "failed" | "escalated" | "succeeded";
  signals: Array<{ category: string }>;
} {
  return {
    outcome: "succeeded",
    signals: [],
    ...overrides,
  };
}

test("ReplanningService.createTrigger creates valid trigger", () => {
  const service = new ReplanningService();
  const trigger = service.createTrigger("task-001", "test.reason", "feedback", "Test summary");

  assert.equal(trigger.taskId, "task-001");
  assert.equal(trigger.reasonCode, "test.reason");
  assert.equal(trigger.source, "feedback");
  assert.equal(trigger.summary, "Test summary");
  assert.ok(trigger.triggerId.length > 0);
});

test("ReplanningService.decide returns shouldReplan=true for repairable outcome", () => {
  const service = new ReplanningService();
  const decision = service.decide(makePlanGraphBundle(), makeFeedback({ outcome: "repairable" }));

  assert.equal(decision.shouldReplan, true);
  assert.equal(decision.nextPlanVersion, 2);
});

test("ReplanningService.decide returns shouldReplan=true for failed outcome", () => {
  const service = new ReplanningService();
  const decision = service.decide(makePlanGraphBundle(), makeFeedback({ outcome: "failed" }));

  assert.equal(decision.shouldReplan, true);
});

test("ReplanningService.decide returns shouldReplan=true for escalated outcome", () => {
  const service = new ReplanningService();
  const decision = service.decide(makePlanGraphBundle(), makeFeedback({ outcome: "escalated" }));

  assert.equal(decision.shouldReplan, true);
});

test("ReplanningService.decide returns shouldReplan=true for correction signal", () => {
  const service = new ReplanningService();
  const decision = service.decide(makePlanGraphBundle(), makeFeedback({
    outcome: "succeeded",
    signals: [{ category: "correction" }],
  }));

  assert.equal(decision.shouldReplan, true);
});

test("ReplanningService.decide returns shouldReplan=false for successful outcome", () => {
  const service = new ReplanningService();
  const decision = service.decide(makePlanGraphBundle(), makeFeedback({ outcome: "succeeded" }));

  assert.equal(decision.shouldReplan, false);
  assert.equal(decision.nextPlanVersion, null);
  assert.equal(decision.strategy, null);
});

test("ReplanningService.decide sets strategy to replanned when shouldReplan", () => {
  const service = new ReplanningService();
  const decision = service.decide(makePlanGraphBundle(), makeFeedback({ outcome: "failed" }));

  assert.equal(decision.strategy, "replanned");
});

test("ReplanningService.decide passes through trigger reasonCode", () => {
  const service = new ReplanningService();
  const trigger = service.createTrigger("harness-run-001", "custom.reason", "operator", "Manual trigger");
  const decision = service.decide(makePlanGraphBundle(), makeFeedback({ outcome: "failed" }), trigger);

  assert.equal(decision.reasonCode, "custom.reason");
});

test("ReplanningService.decide uses default reasonCode when no trigger", () => {
  const service = new ReplanningService();
  const decision = service.decide(makePlanGraphBundle(), makeFeedback({ outcome: "failed" }), null);

  assert.ok(decision.reasonCode.length > 0);
});

test("ReplanningService.decide includes decisionId", () => {
  const service = new ReplanningService();
  const decision = service.decide(makePlanGraphBundle(), makeFeedback({ outcome: "repairable" }));

  assert.ok(decision.decisionId.length > 0);
});

test("ReplanningService.decide includes taskId from harnessRunId", () => {
  const service = new ReplanningService();
  const plan = makePlanGraphBundle({ harnessRunId: "harness-custom-123" });
  const decision = service.decide(plan, makeFeedback());

  assert.equal(decision.taskId, "harness-custom-123");
});

test("ReplanningService.decide increments version correctly", () => {
  const service = new ReplanningService();
  const plan = makePlanGraphBundle({ graphVersion: 5 });
  const decision = service.decide(plan, makeFeedback({ outcome: "repairable" }));

  assert.equal(decision.nextPlanVersion, 6);
});

test("ReplanningService.createTrigger uses feedback source", () => {
  const service = new ReplanningService();
  const trigger = service.createTrigger("task-001", "reason", "feedback", "summary");

  assert.equal(trigger.source, "feedback");
});

test("ReplanningService.createTrigger uses validation source", () => {
  const service = new ReplanningService();
  const trigger = service.createTrigger("task-001", "reason", "validation", "summary");

  assert.equal(trigger.source, "validation");
});

test("ReplanningService.createTrigger uses operator source", () => {
  const service = new ReplanningService();
  const trigger = service.createTrigger("task-001", "reason", "operator", "summary");

  assert.equal(trigger.source, "operator");
});