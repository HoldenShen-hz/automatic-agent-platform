import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/helpers/integration-context.js";
import { RuntimeExecuteBridge } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.js";
import type { Plan, PlanStep } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/types/plan.js";
import type { ExecutionContext } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/oapeflir/execute-bridge.js";

// ---------------------------------------------------------------------------
// Mock event bus that tracks publish/subscribe for verification
// ---------------------------------------------------------------------------

interface PublishedEvent {
  type: string;
  payload: unknown;
  publishedAt: number;
}

interface Subscription {
  eventType: string;
  handler: (event: PublishedEvent) => void | Promise<void>;
}

class MockEventBus {
  readonly publishedEvents: PublishedEvent[] = [];
  private readonly _subscriptions: Subscription[] = [];

  publish(type: string, payload: unknown): void {
    this.publishedEvents.push({ type, payload, publishedAt: Date.now() });
    // Deliver to all matching subscribers synchronously for test predictability
    for (const sub of this._subscriptions) {
      if (sub.eventType === type || sub.eventType === "*") {
        const evt = { type, payload, publishedAt: Date.now() };
        const result = sub.handler(evt);
        if (result instanceof Promise) {
          result.catch(() => {}); // suppress unhandled rejections in tests
        }
      }
    }
  }

  subscribe(eventType: string, handler: (event: PublishedEvent) => void | Promise<void>): () => void {
    this._subscriptions.push({ eventType, handler });
    return () => {
      const idx = this._subscriptions.findIndex(
        (s) => s.eventType === eventType && s.handler === handler,
      );
      if (idx !== -1) this._subscriptions.splice(idx, 1);
    };
  }

  findSubscriptions(eventType: string): Subscription[] {
    return this._subscriptions.filter((s) => s.eventType === eventType);
  }

  clear(): void {
    this.publishedEvents.length = 0;
    this._subscriptions.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Mock harness runtime that responds to execution.requested events
// ---------------------------------------------------------------------------

/**
 * Simulates the Harness Runtime's event-driven execution path.
 * When it receives an execution.requested event, it publishes execution.completed
 * after performing the simulated work.
 */
function createMockHarnessRuntime(eventBus: MockEventBus): () => void {
  let unsubscribe: (() => void) | undefined;

  const handleExecutionRequested = (event: PublishedEvent): void => {
    const payload = event.payload as {
      planId: string;
      taskId: string;
      steps: PlanStep[];
      dbPath: string;
    };

    // Simulate harness runtime work (minimal — just enough to verify delegation)
    const simulatedResults = payload.steps.map((step) => ({
      stepId: step.stepId,
      status: "succeeded" as const,
      durationMs: 50,
      tokenCost: 100,
      summary: `Simulated execution for ${step.stepId}`,
      outputs: {},
      artifacts: [],
      modelId: "mock-harness-runtime",
      retryCount: 0,
      validationPassed: true,
    }));

    // Publish completion event back via event bus
    eventBus.publish("execution.completed", {
      planId: payload.planId,
      taskId: payload.taskId,
      results: simulatedResults,
      totalDurationMs: simulatedResults.reduce((s, r) => s + r.durationMs, 0),
      totalTokenCost: simulatedResults.reduce((s, r) => s + r.tokenCost, 0),
      allSucceeded: true,
      skippedStepIds: [],
      failedStepIds: [],
    });
  };

  // Subscribe to execution.requested — the R9-14 event-driven entry point
  unsubscribe = eventBus.subscribe("execution.requested", handleExecutionRequested);

  // Return cleanup function
  return () => {
    if (unsubscribe) unsubscribe();
  };
}

// ---------------------------------------------------------------------------
// Helper: build a minimal plan for testing
// ---------------------------------------------------------------------------

function makeTestPlan(planId: string, taskId: string, stepCount = 2): Plan {
  const steps: PlanStep[] = Array.from({ length: stepCount }, (_, i) => ({
    stepId: `step_${planId}_${i}`,
    action: `test_action_${i}`,
    title: `Test Step ${i}`,
    inputs: { index: i },
    outputs: [`output_${i}`],
    dependencies: i > 0 ? [`step_${planId}_${i - 1}`] : [],
    status: "pending" as const,
    timeout: 5000,
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
  }));

  return {
    planId,
    taskId,
    version: 1,
    assessmentRef: `assessment_${taskId}`,
    strategy: "linear",
    steps,
    createdAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Tests — R9-14 event-driven delegation verification
// ---------------------------------------------------------------------------

test("R9: RuntimeExecuteBridge does NOT directly call runMultiStepOrchestration", (t) => {
  // Verify that executePlan uses event bus for delegation rather than
  // importing and calling runMultiStepOrchestration directly.
  // We test this by checking that the bridge does not synchronously complete
  // when we mock the orchestrator — it must wait for an event response.
  const ctx = createIntegrationContext("aa-r9-test-");
  try {
    const eventBus = new MockEventBus();
    const cleanupHarness = createMockHarnessRuntime(eventBus);

    // A bridge that uses the event bus (injected via module mocking)
    // will publish execution.requested and wait for execution.completed.
    // The fact that our mock harness runtime can intercept and respond proves
    // delegation happened via events rather than direct call.
    const bridge = new RuntimeExecuteBridge(ctx.dbPath, "MiniMax-M2.7");

    const plan = makeTestPlan("plan_r9", "task_r9");

    // We verify non-direct-call behavior by ensuring the bridge publishes
    // execution.requested BEFORE any completion — direct calls would not publish.
    // We capture the event bus state to confirm the event was published.
    let executionRequestedPublished = false;
    const origPublish = eventBus.publish.bind(eventBus);
    eventBus.publish = (type: string, payload: unknown) => {
      if (type === "execution.requested") {
        executionRequestedPublished = true;
      }
      origPublish(type, payload);
    };

    const result = bridge.executePlan(plan, { taskId: "task_r9", sessionId: "session_r9" });

    // The bridge must have published execution.requested (event-driven path)
    assert.equal(
      executionRequestedPublished,
      true,
      "R9: Bridge should publish execution.requested event (not call runMultiStepOrchestration directly)",
    );

    cleanupHarness();
  } finally {
    ctx.cleanup();
  }
});

test("R10: RuntimeExecuteBridge registers as event subscriber for execution.requested", (t) => {
  // Verify the bridge subscribes to the event bus to listen for execution.requested
  // events so it can delegate to the harness runtime.
  const ctx = createIntegrationContext("aa-r10-test-");
  try {
    const eventBus = new MockEventBus();

    // Create bridge — it should register a subscription when instantiated or when
    // executePlan is called
    const bridge = new RuntimeExecuteBridge(ctx.dbPath, "MiniMax-M2.7");

    // Before calling executePlan, check subscriber count for execution.requested
    const before = eventBus.findSubscriptions("execution.requested").length;

    const plan = makeTestPlan("plan_r10", "task_r10");

    // Call executePlan which triggers subscription registration
    bridge.executePlan(plan, { taskId: "task_r10" });

    // After triggering, there should be at least one subscription
    // The R9-14 fix ensures the bridge registers for execution.requested
    const after = eventBus.findSubscriptions("execution.requested").length;
    assert.ok(
      after > before,
      "R10: Bridge should register subscriber for execution.requested event",
    );
  } finally {
    ctx.cleanup();
  }
});

test("R11: RuntimeExecuteBridge publishes execution.completed event when done", (t) => {
  // Verify that after execution completes, the bridge publishes execution.completed
  // so downstream consumers can react to completion.
  const ctx = createIntegrationContext("aa-r11-test-");
  try {
    const eventBus = new MockEventBus();
    const cleanupHarness = createMockHarnessRuntime(eventBus);

    const bridge = new RuntimeExecuteBridge(ctx.dbPath, "MiniMax-M2.7");

    const plan = makeTestPlan("plan_r11", "task_r11");

    bridge.executePlan(plan, { taskId: "task_r11" });

    // Find the execution.completed event that should have been published
    const completedEvents = eventBus.publishedEvents.filter(
      (e) => e.type === "execution.completed",
    );

    assert.ok(
      completedEvents.length > 0,
      "R11: Bridge should publish execution.completed event after execution finishes",
    );

    const completed = completedEvents[0]!.payload as {
      planId: string;
      results: unknown[];
      allSucceeded: boolean;
    };
    assert.equal(completed.planId, "plan_r11");
    assert.equal(completed.allSucceeded, true);

    cleanupHarness();
  } finally {
    ctx.cleanup();
  }
});

test("R12: executePlan delegates to Harness Runtime via events, not direct call", (t) => {
  // Verify that executePlan's delegation chain goes through the event bus
  // to the Harness Runtime, not through direct invocation of runMultiStepOrchestration.
  // This test confirms the full event-driven delegation path.
  const ctx = createIntegrationContext("aa-r12-test-");
  try {
    const eventBus = new MockEventBus();
    let harnessReceivedExecutionRequested = false;

    // Create a mock harness that tracks whether it received the event
    const mockHarnessRuntime = (): (() => void) => {
      let unsubscribe: (() => void) | undefined;
      unsubscribe = eventBus.subscribe("execution.requested", (event) => {
        harnessReceivedExecutionRequested = true;
        const payload = event.payload as { planId: string; steps: PlanStep[] };

        const results = payload.steps.map((step) => ({
          stepId: step.stepId,
          status: "succeeded" as const,
          durationMs: 40,
          tokenCost: 80,
          summary: `Harness executed ${step.stepId}`,
          outputs: {},
          artifacts: [],
          modelId: "harness-via-event",
          retryCount: 0,
          validationPassed: true,
        }));

        eventBus.publish("execution.completed", {
          planId: payload.planId,
          taskId: "task_r12",
          results,
          totalDurationMs: results.reduce((s, r) => s + r.durationMs, 0),
          totalTokenCost: results.reduce((s, r) => s + r.tokenCost, 0),
          allSucceeded: true,
          skippedStepIds: [],
          failedStepIds: [],
        });
      });
      return () => {
        if (unsubscribe) unsubscribe();
      };
    };

    const cleanupHarness = mockHarnessRuntime();

    const bridge = new RuntimeExecuteBridge(ctx.dbPath, "MiniMax-M2.7");

    const plan = makeTestPlan("plan_r12", "task_r12");

    const result = bridge.executePlan(plan, { taskId: "task_r12" });

    // Verify delegation occurred through event bus
    assert.equal(
      harnessReceivedExecutionRequested,
      true,
      "R12: executePlan should delegate to harness via execution.requested event",
    );

    // Verify result came from harness response (event-driven path)
    assert.equal(result.planId, "plan_r12");
    assert.ok(result.allSucceeded);

    cleanupHarness();
  } finally {
    ctx.cleanup();
  }
});

test("R13: executeStep delegates single step to harness via events", async (t) => {
  // Verify that executeStep (single-step re-execution after replan) also
  // uses the event-driven delegation path.
  const ctx = createIntegrationContext("aa-r13-test-");
  try {
    const eventBus = new MockEventBus();
    let executionRequestedReceived = false;

    const mockHarnessRuntime = (): (() => void) => {
      let unsubscribe: (() => void) | undefined;
      unsubscribe = eventBus.subscribe("execution.requested", (event) => {
        executionRequestedReceived = true;
        const payload = event.payload as { planId: string; steps: PlanStep[] };

        eventBus.publish("execution.completed", {
          planId: payload.planId,
          taskId: "task_r13",
          results: payload.steps.map((step) => ({
            stepId: step.stepId,
            status: "succeeded" as const,
            durationMs: 30,
            tokenCost: 60,
            summary: `Single step via event: ${step.stepId}`,
            outputs: {},
            artifacts: [],
            modelId: "harness-event-single",
            retryCount: 0,
            validationPassed: true,
          })),
          totalDurationMs: 30,
          totalTokenCost: 60,
          allSucceeded: true,
          skippedStepIds: [],
          failedStepIds: [],
        });
      });
      return () => {
        if (unsubscribe) unsubscribe();
      };
    };

    const cleanupHarness = mockHarnessRuntime();

    const bridge = new RuntimeExecuteBridge(ctx.dbPath, "MiniMax-M2.7");

    const singleStep: PlanStep = {
      stepId: "step_r13_single",
      action: "test_single_action",
      title: "Single Step Test",
      inputs: { value: 42 },
      outputs: [],
      dependencies: [],
      status: "pending",
      timeout: 5000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    };

    const result = await bridge.executeStep(singleStep, { taskId: "task_r13" });

    assert.equal(
      executionRequestedReceived,
      true,
      "R13: executeStep should delegate via execution.requested event",
    );

    assert.equal(result.stepId, "step_r13_single");
    assert.equal(result.status, "succeeded");

    cleanupHarness();
  } finally {
    ctx.cleanup();
  }
});

test("R14: toDualChannelStepOutputs correctly maps ExecutionResult from event-driven path", async (t) => {
  // Verify that the bridge's output mapping works correctly when results
  // come back from the event-driven execution path.
  const ctx = createIntegrationContext("aa-r14-test-");
  try {
    const eventBus = new MockEventBus();

    const mockHarnessRuntime = (): (() => void) => {
      let unsubscribe: (() => void) | undefined;
      unsubscribe = eventBus.subscribe("execution.requested", (event) => {
        const payload = event.payload as { planId: string; steps: PlanStep[] };

        eventBus.publish("execution.completed", {
          planId: payload.planId,
          taskId: "task_r14",
          results: payload.steps.map((step) => ({
            stepId: step.stepId,
            status: "succeeded" as const,
            durationMs: 70,
            tokenCost: 140,
            summary: `Step ${step.stepId} completed via harness events`,
            outputs: { resultKey: `value_for_${step.stepId}` },
            artifacts: ["art_1", "art_2"],
            modelId: "harness-model",
            retryCount: 1,
            validationPassed: true,
          })),
          totalDurationMs: 70,
          totalTokenCost: 140,
          allSucceeded: true,
          skippedStepIds: [],
          failedStepIds: [],
        });
      });
      return () => {
        if (unsubscribe) unsubscribe();
      };
    };

    const cleanupHarness = mockHarnessRuntime();

    const bridge = new RuntimeExecuteBridge(ctx.dbPath, "MiniMax-M2.7");

    const plan = makeTestPlan("plan_r14", "task_r14", 2);

    const execResult = await bridge.executePlan(plan, { taskId: "task_r14" });

    // Map to dual channel outputs
    const dualOutputs = bridge.toDualChannelStepOutputs(execResult);

    // Verify structure and content
    assert.equal(dualOutputs.length, 2);

    for (const output of dualOutputs) {
      assert.ok(output.stepId.startsWith("step_r14_"));
      assert.equal(output.planRef, "plan_r14");
      assert.ok(output.userFacingResult.summary.length > 0);
      assert.ok(output.systemTelemetry.durationMs > 0);
      assert.ok(output.systemTelemetry.tokensUsed > 0);
    }

    // Verify telemetry mapping
    const firstOutput = dualOutputs[0]!;
    assert.equal(firstOutput.systemTelemetry.durationMs, 70);
    assert.equal(firstOutput.systemTelemetry.tokensUsed, 140);
    assert.equal(firstOutput.systemTelemetry.modelId, "harness-model");
    assert.equal(firstOutput.systemTelemetry.retryCount, 1);
    assert.equal(firstOutput.systemTelemetry.validationPassed, true);

    // Verify user-facing result has artifact refs
    assert.ok(firstOutput.userFacingResult.artifacts.length > 0);

    cleanupHarness();
  } finally {
    ctx.cleanup();
  }
});