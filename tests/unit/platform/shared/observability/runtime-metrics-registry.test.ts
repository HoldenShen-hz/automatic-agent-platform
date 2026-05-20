/**
 * Unit tests for RuntimeMetricsRegistry - OAPEFLIR stage and LLM latency metrics
 */

import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeMetricsRegistry } from "../../../../../src/platform/shared/observability/runtime-metrics-registry.js";

test("recordOapeflirStageEntry increments stage entry counter", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordOapeflirStageEntry("observe");
  registry.recordOapeflirStageEntry("assess");
  registry.recordOapeflirStageEntry("observe");

  const counters = registry.getCounters("oapeflir_stage_entry_total");
  assert.equal(counters.length, 2);

  const observeCounter = counters.find((c) => c.labels.stage === "observe");
  assert.ok(observeCounter !== undefined);
  assert.equal(observeCounter.value, 2);

  const assessCounter = counters.find((c) => c.labels.stage === "assess");
  assert.ok(assessCounter !== undefined);
  assert.equal(assessCounter.value, 1);
});

test("recordOapeflirStageExit records duration and outcome", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordOapeflirStageExit("execute", "completed", 1.5);
  registry.recordOapeflirStageExit("execute", "completed", 2.0);
  registry.recordOapeflirStageExit("execute", "error", 0.5);

  const histograms = registry.getHistograms("stage_duration_seconds");
  assert.equal(histograms.length, 1);

  const executeHistogram = histograms[0]!;
  assert.equal(executeHistogram.labels.stage, "execute");
  assert.equal(executeHistogram.count, 3);
  assert.equal(executeHistogram.sum, 4.0);

  const counters = registry.getCounters("oapeflir_stage_outcome_total");
  assert.equal(counters.length, 2);

  const completedCounter = counters.find((c) => c.labels.stage === "execute" && c.labels.result === "completed");
  assert.ok(completedCounter !== undefined);
  assert.equal(completedCounter.value, 2);

  const errorCounter = counters.find((c) => c.labels.stage === "execute" && c.labels.result === "error");
  assert.ok(errorCounter !== undefined);
  assert.equal(errorCounter.value, 1);
});

test("recordLlmLatency records ttfb and total latency", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordLlmLatency(0.1, 1.5, "claude-sonnet-4", "anthropic");
  registry.recordLlmLatency(0.15, 2.0, "claude-sonnet-4", "anthropic");
  registry.recordLlmLatency(0.08, 0.9, "gpt-4o", "openai");

  const ttfbHistograms = registry.getHistograms("llm_ttfb_seconds");
  assert.equal(ttfbHistograms.length, 2);

  const anthropicTtfb = ttfbHistograms.find((h) => h.labels.model === "claude-sonnet-4" && h.labels.provider === "anthropic");
  assert.ok(anthropicTtfb !== undefined);
  assert.equal(anthropicTtfb.count, 2);
  assert.equal(anthropicTtfb.sum, 0.25);

  const totalHistograms = registry.getHistograms("llm_total_seconds");
  assert.equal(totalHistograms.length, 2);

  const anthropicTotal = totalHistograms.find((h) => h.labels.model === "claude-sonnet-4" && h.labels.provider === "anthropic");
  assert.ok(anthropicTotal !== undefined);
  assert.equal(anthropicTotal.count, 2);
  assert.equal(anthropicTotal.sum, 3.5);
});

test("harness metrics avoid runId, budgetId, executionId and pluginId labels", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordHarnessRunDuration("run-1", 120, "completed");
  registry.recordHarnessStepCount("run-1", 4);
  registry.recordHarnessBudgetConsumed("run-1", "budget-1", 5, 10);
  registry.recordHarnessExecutionLatency("run-1", "exec-1", 42);
  registry.recordHarnessTaskStarted("run-1", "task-1");
  registry.recordHarnessTaskCompleted("run-1", "task-1", "completed");
  registry.recordHarnessPluginInvoked("run-1", "plugin-tenant-specific", true);
  registry.recordHarnessPolicyDecision("run-1", "Risk Policy", "allow");
  registry.recordEventBackpressure("consumer:instance-123", 7, true);

  const allLabels = [
    ...registry.getCounters("harness_run_total").map((series) => series.labels),
    ...registry.getCounters("harness_task_started_total").map((series) => series.labels),
    ...registry.getCounters("harness_task_completed_total").map((series) => series.labels),
    ...registry.getCounters("harness_plugin_invoked_total").map((series) => series.labels),
    ...registry.getCounters("harness_policy_decision_total").map((series) => series.labels),
    ...registry.getGauges("harness_step_count").map((series) => series.labels),
    ...registry.getGauges("harness_budget_total_units").map((series) => series.labels),
    ...registry.getGauges("harness_budget_utilization_percent").map((series) => series.labels),
    ...registry.getGauges("event_bus_backpressure_pending").map((series) => series.labels),
    ...registry.getHistograms("harness_run_duration_ms").map((series) => series.labels),
    ...registry.getHistograms("harness_budget_consumed_units").map((series) => series.labels),
    ...registry.getHistograms("harness_execution_latency_ms").map((series) => series.labels),
  ];

  for (const labels of allLabels) {
    assert.equal("runId" in labels, false);
    assert.equal("budgetId" in labels, false);
    assert.equal("executionId" in labels, false);
    assert.equal("pluginId" in labels, false);
  }
  assert.deepEqual(registry.getCounters("harness_plugin_invoked_total")[0]?.labels, { result: "success" });
  assert.deepEqual(registry.getGauges("event_bus_backpressure_pending")[0]?.labels, { consumer: "consumer" });
});

test("stage_duration_seconds uses correct bucket boundaries", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordOapeflirStageExit("test", "completed", 0.005);
  registry.recordOapeflirStageExit("test", "completed", 0.05);
  registry.recordOapeflirStageExit("test", "completed", 0.5);
  registry.recordOapeflirStageExit("test", "completed", 5.0);

  const histograms = registry.getHistograms("stage_duration_seconds");
  assert.equal(histograms.length, 1);

  const h = histograms[0]!;
  assert.equal(h.buckets.length, 7);
  assert.deepEqual(h.buckets, [10, 50, 100, 250, 500, 1000, 5000]);

  assert.equal(h.bucketCounts[0], 4);
  assert.equal(h.count, 4);
});

test("observeHistogram rejects unsorted buckets and bucket drift", () => {
  const registry = new RuntimeMetricsRegistry();

  assert.throws(() => registry.observeHistogram("custom_latency_ms", {}, 1, [10, 5]));
  registry.observeHistogram("custom_latency_ms", { route: "stable" }, 1, [10, 20]);
  assert.throws(() => registry.observeHistogram("custom_latency_ms", { route: "stable" }, 2, [10, 30]));
});
