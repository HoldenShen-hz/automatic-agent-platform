/**
 * E2E Tests for OAPEFLIR Loop Service
 *
 * End-to-end tests covering:
 * 1. OAPEFLIR stage transitions
 * 2. Loop iteration execution
 * 3. Assessment and improvement
 * 4. Handoff handling
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore
import { createE2EHarness } from "../../helpers/e2e-harness.js";
// @ts-ignore
import { OapeflirLoopService } from "../../../src/platform/orchestration/oapeflir/oapeflir-loop-service.js";
// @ts-ignore
import { HandoffBuilder } from "../../../src/platform/orchestration/oapeflir/handoff-builder.js";
// @ts-ignore
import type { LoopIterationResult, StageTiming } from "../../../src/platform/orchestration/oapeflir/types.js";
// @ts-ignore
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";

function createStageTiming(overrides: Partial<StageTiming> = {}): StageTiming {
  return {
    stageId: overrides.stageId ?? "observe",
    enterMs: overrides.enterMs ?? Date.now(),
    exitMs: overrides.exitMs ?? Date.now() + 100,
    durationMs: overrides.durationMs ?? 100,
    ...overrides,
  };
}

test("E2E OAPEFLIR: Loop service executes Observe stage", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflir-observe-");
  try {
    const loopService = new OapeflirLoopService(harness.store);

    const result = await loopService.executeStage({
      taskId: newId("task"),
      executionId: newId("exec"),
      stage: "observe",
      input: { prompt: "Analyze current state" },
    });

    assert.ok(result);
    assert.ok(result.observations || result.output);
  } finally {
    harness.cleanup();
  }
});

test("E2E OAPEFLIR: Loop service executes Assess stage", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflir-assess-");
  try {
    const loopService = new OapeflirLoopService(harness.store);

    const result = await loopService.executeStage({
      taskId: newId("task"),
      executionId: newId("exec"),
      stage: "assess",
      input: { observations: ["state_1", "state_2"] },
    });

    assert.ok(result);
    assert.ok(result.assessments || result.output);
  } finally {
    harness.cleanup();
  }
});

test("E2E OAPEFLIR: Loop service executes Plan stage", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflir-plan-");
  try {
    const loopService = new OapeflirLoopService(harness.store);

    const result = await loopService.executeStage({
      taskId: newId("task"),
      executionId: newId("exec"),
      stage: "plan",
      input: { assessments: ["gap_1"] },
    });

    assert.ok(result);
    assert.ok(result.plan || result.output);
  } finally {
    harness.cleanup();
  }
});

test("E2E OAPEFLIR: Loop service executes Execute stage", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflir-execute-");
  try {
    const loopService = new OapeflirLoopService(harness.store);

    const result = await loopService.executeStage({
      taskId: newId("task"),
      executionId: newId("exec"),
      stage: "execute",
      input: { plan: { steps: ["step_1"] } },
    });

    assert.ok(result);
    assert.ok(result.executionResult || result.output);
  } finally {
    harness.cleanup();
  }
});

test("E2E OAPEFLIR: Loop service executes Feedback stage", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflir-feedback-");
  try {
    const loopService = new OapeflirLoopService(harness.store);

    const result = await loopService.executeStage({
      taskId: newId("task"),
      executionId: newId("exec"),
      stage: "feedback",
      input: { executionResult: { status: "success" } },
    });

    assert.ok(result);
    assert.ok(result.feedbackSignals || result.output);
  } finally {
    harness.cleanup();
  }
});

test("E2E OAPEFLIR: Loop service executes Improve stage", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflir-improve-");
  try {
    const loopService = new OapeflirLoopService(harness.store);

    const result = await loopService.executeStage({
      taskId: newId("task"),
      executionId: newId("exec"),
      stage: "improve",
      input: { feedbackSignals: ["signal_1"] },
    });

    assert.ok(result);
    assert.ok(result.improvements || result.output);
  } finally {
    harness.cleanup();
  }
});

test("E2E OAPEFLIR: HandoffBuilder creates valid handoff", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflir-handoff-");
  try {
    const handoffBuilder = new HandoffBuilder();

    const handoff = handoffBuilder.build({
      sourceAgentId: "agent_source",
      targetAgentId: "agent_target",
      taskId: newId("task"),
      context: { key: "value" },
    });

    assert.ok(handoff);
    assert.equal(handoff.sourceAgentId, "agent_source");
    assert.equal(handoff.targetAgentId, "agent_target");
    assert.ok(handoff.serializedContext);
  } finally {
    harness.cleanup();
  }
});

test("E2E OAPEFLIR: Full loop iteration completes all stages", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflir-full-");
  try {
    const loopService = new OapeflirLoopService(harness.store);

    const iterationResult = await loopService.executeIteration({
      taskId: newId("task"),
      executionId: newId("exec"),
      maxIterations: 1,
    });

    assert.ok(iterationResult);
    assert.ok(iterationResult.completedStages || iterationResult.finalOutput);
  } finally {
    harness.cleanup();
  }
});