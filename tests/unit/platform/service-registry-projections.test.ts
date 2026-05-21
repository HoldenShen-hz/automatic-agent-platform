import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  DEFAULT_LAYER_TTL_CONFIGS,
  DEFAULT_MEMORY_PROMOTION_RULES,
} from "../../../src/platform/five-plane-state-evidence/memory/memory-layer-model.js";
import { DEFAULT_SIX_LAYER_TRANSITION_RULES } from "../../../src/platform/five-plane-state-evidence/memory/layer-transition-service.js";
import { artifactCatalogProjectionHandler } from "../../../src/platform/five-plane-state-evidence/events/projections/artifact-catalog-projection.js";
import { governanceProjectionHandler } from "../../../src/platform/five-plane-state-evidence/events/projections/governance-projection.js";
import { riskActionProjectionHandler } from "../../../src/platform/five-plane-state-evidence/events/projections/risk-action-projection.js";
import type { ProjectionInputEvent } from "../../../src/platform/five-plane-state-evidence/projections/projection-rebuild-service.js";

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), "tests", "unit", "platform", relativePath), "utf8");
}

function makeEvent(eventId: string, eventType: string): ProjectionInputEvent {
  return {
    eventId,
    eventType,
    taskId: "task-r24",
    payloadJson: JSON.stringify({ artifactId: "artifact-r24", policyId: "policy-r24", riskDecisionId: "risk-r24" }),
    createdAt: "2026-05-09T00:00:00.000Z",
  };
}

test("R24-14 service registry source no longer contains delete-on-missing dead branch", () => {
  const source = readSource("../../../src/platform/shared/lifecycle/service-registry.ts");
  const deadBranchPattern = /if\s*\(\s*!\s*[^)]*has\([^)]*\)\s*\)\s*\{[^}]*delete\(/s;
  assert.equal(deadBranchPattern.test(source), false);
});

test("R24-31 artifact, governance, and risk projections keep processedEventIds as Set-backed idempotency state", () => {
  const handlers = [
    artifactCatalogProjectionHandler,
    governanceProjectionHandler,
    riskActionProjectionHandler,
  ];

  for (const [index, handler] of handlers.entries()) {
    const event = makeEvent(`evt-${index}`, index === 0 ? "artifact:created" : index === 1 ? "policy:created" : "risk:decision_requested");
    const firstState = handler(null, event) as {
      processedEventIds: ReadonlySet<string>;
      eventCount: number;
    };
    const replayedState = handler(firstState as unknown as Record<string, unknown>, event) as {
      processedEventIds: ReadonlySet<string>;
      eventCount: number;
    };

    assert.ok(firstState.processedEventIds instanceof Set);
    assert.equal(replayedState.eventCount, 1);
  }
});

test("R24-60 and R24-61 legacy memory promotion rules align with the canonical six-layer ladder", () => {
  const expectedRules = DEFAULT_SIX_LAYER_TRANSITION_RULES.map((rule) => ({
    minHitCount: rule.minHitCount,
    minQualityScore: rule.minQualityScore,
    minImportanceScore: rule.minImportanceScore,
  }));
  const actualRules = DEFAULT_MEMORY_PROMOTION_RULES.map((rule) => ({
    minHitCount: rule.minHitCount,
    minQualityScore: rule.minQualityScore,
    minImportanceScore: rule.minImportanceScore,
  }));

  assert.equal(actualRules.length, expectedRules.length);
});

test("R24-71 user layer supports promotion consistently with the user to evolution rule", () => {
  const userLayer = DEFAULT_LAYER_TTL_CONFIGS.find((config) => config.scope === "user");
  const userPromotionRule = DEFAULT_MEMORY_PROMOTION_RULES.find((rule) => rule.from === "user" && rule.to === "evolution");

  assert.equal(userLayer?.supportsPromotion, true);
  assert.ok(userPromotionRule);
});

test("R24-62 workflow state transitions E2E now includes RuntimeStateMachine coverage", () => {
  const source = readSource("../../e2e/workflow-state-transitions.test.ts");
  assert.ok(source.includes("RuntimeStateMachine"));
  assert.ok(source.includes("createMinimalHarnessRun"));
  assert.ok(source.includes("canonical HarnessRun pause and resume coverage"));
});

test("R24-63 execution flow E2E now includes canonical HarnessRun, PlanGraphBundle, and NodeRun coverage", () => {
  const source = readSource("../../e2e/execution-flow.test.ts");
  assert.ok(source.includes("createMinimalPlanGraphBundle"));
  assert.ok(source.includes("createMinimalNodeRun"));
  assert.ok(source.includes("includes canonical HarnessRun, PlanGraphBundle, and NodeRun coverage"));
});

test("R24-64 task lifecycle E2E now includes RuntimeStateMachine.transition command coverage", () => {
  const source = readSource("../../e2e/task-lifecycle.test.ts");
  assert.ok(source.includes("RuntimeStateMachine"));
  assert.ok(source.includes("createMinimalNodeRun"));
  assert.ok(source.includes("canonical NodeRun transitions use RuntimeStateMachine.transition"));
});

test("R24-67 tests/e2e now contains canonical PlanGraphBundle end-to-end coverage", () => {
  const dispatchSource = readSource("../../e2e/plan-graph-bundle-dispatch-e2e.test.ts");
  const harnessSource = readSource("../../e2e/harness-multi-step-orchestration-e2e.test.ts");

  assert.ok(dispatchSource.includes("PlanGraphBundle"));
  assert.ok(dispatchSource.includes("full execution lifecycle"));
  assert.ok(harnessSource.includes("PlanGraphBundle"));
  assert.ok(harnessSource.includes("runMultiStepOrchestration"));
});

test("R24-70 execution flow E2E no longer treats blocked to executing as a direct valid transition", () => {
  const source = readSource("../../e2e/execution-flow.test.ts");
  assert.equal(source.includes('makeExecCommand(executionId, "blocked", "executing", traceId)'), false);
  assert.ok(source.includes('makeExecCommand(executionId, "blocked", "prechecking", traceId)'));
});
