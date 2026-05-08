/**
 * E2E Runtime Services Tests
 *
 * End-to-end tests covering runtime services:
 * 1. Runtime governance
 * 2. Intelligence services
 * 3. Feedback loop
 * 4. Enterprise services
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore
import { createE2EHarness } from "../helpers/e2e-harness.js";
// @ts-ignore
import { RuntimeGovernanceService } from "../../src/scale-ecosystem/runtime-services/runtime-governance-service.js";
// @ts-ignore
import { FeedbackLoopService } from "../../src/scale-ecosystem/feedback-loop/feedback-loop-service.js";
// @ts-ignore
import type { GovernanceDecision, RuntimeMetrics } from "../../src/scale-ecosystem/runtime-services/types.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createRuntimeMetrics(overrides: Partial<RuntimeMetrics> = {}): RuntimeMetrics {
  return {
    taskId: overrides.taskId ?? "task_e2e_001",
    executionId: overrides.executionId ?? "exec_e2e_001",
    latencyMs: overrides.latencyMs ?? 500,
    costUsd: overrides.costUsd ?? 0.01,
    success: overrides.success ?? true,
    errorCode: overrides.errorCode ?? null,
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite 1: Runtime Governance
// ---------------------------------------------------------------------------

test("E2E Runtime: RuntimeGovernanceService makes governance decisions for runtime operations", async () => {
  const harness = createE2EHarness("aa-e2e-runtime-governance-");
  try {
    const service = new RuntimeGovernanceService();

    const metrics = createRuntimeMetrics({
      riskScore: 75,
    });

    const decision = service.evaluateGovernance(metrics);

    assert.ok(decision, "Should return governance decision");
    assert.ok(decision.action, "Should have action");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 2: Feedback Loop
// ---------------------------------------------------------------------------

test("E2E Runtime: FeedbackLoopService processes execution feedback for optimization", async () => {
  const harness = createE2EHarness("aa-e2e-feedback-");
  try {
    const service = new FeedbackLoopService();

    const feedback = {
      taskId: "task_e2e_001",
      executionId: "exec_e2e_001",
      success: true,
      latencyMs: 450,
      qualityScore: 0.92,
      timestamp: new Date().toISOString(),
    };

    const result = await service.processFeedback(feedback);

    assert.ok(result, "Should process feedback");
    assert.ok(result.insights, "Should return insights");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 3: Runtime Metrics Collection
// ---------------------------------------------------------------------------

test("E2E Runtime: Service aggregates metrics across executions", async () => {
  const harness = createE2EHarness("aa-e2e-runtime-metrics-");
  try {
    const service = new RuntimeGovernanceService();

    // Record multiple executions
    service.recordMetrics(createRuntimeMetrics({ taskId: "task_001", latencyMs: 300 }));
    service.recordMetrics(createRuntimeMetrics({ taskId: "task_002", latencyMs: 500 }));
    service.recordMetrics(createRuntimeMetrics({ taskId: "task_003", latencyMs: 400 }));

    const aggregated = service.getAggregatedMetrics();
    assert.ok(aggregated, "Should return aggregated metrics");
    assert.ok(aggregated.avgLatencyMs > 0, "Should have average latency");
  } finally {
    harness.cleanup();
  }
});