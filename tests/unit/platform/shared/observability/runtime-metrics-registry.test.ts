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

// §12.4 Harness.* metrics per R4-42
test("recordHarnessRunDuration records duration histogram and count", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordHarnessRunDuration("run_abc", 250, "success");

  const histograms = registry.getHistograms("harness_run_duration_ms");
  assert.equal(histograms.length, 1);
  assert.equal(histograms[0]?.count, 1);
  assert.equal(histograms[0]?.sum, 250);
  assert.equal(histograms[0]?.labels.runId, "run_abc");
  assert.equal(histograms[0]?.labels.status, "success");

  const counters = registry.getCounters("harness_run_total");
  assert.equal(counters.length, 1);
  assert.equal(counters[0]?.value, 1);
  assert.equal(counters[0]?.labels.runId, "run_abc");
  assert.equal(counters[0]?.labels.status, "success");
});

test("recordHarnessStepCount sets gauge for step count", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordHarnessStepCount("run_abc", 15);

  const gauges = registry.getGauges("harness_step_count");
  assert.equal(gauges.length, 1);
  assert.equal(gauges[0]?.value, 15);
  assert.equal(gauges[0]?.labels.runId, "run_abc");
});

test("recordHarnessBudgetConsumed records consumed units histogram, total units gauge, and utilization percent", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordHarnessBudgetConsumed("run_abc", "budget_x", 75, 100);

  const consumedHistograms = registry.getHistograms("harness_budget_consumed_units");
  assert.equal(consumedHistograms.length, 1);
  assert.equal(consumedHistograms[0]?.count, 1);
  assert.equal(consumedHistograms[0]?.sum, 75);
  assert.equal(consumedHistograms[0]?.labels.runId, "run_abc");
  assert.equal(consumedHistograms[0]?.labels.budgetId, "budget_x");

  const totalGauges = registry.getGauges("harness_budget_total_units");
  assert.equal(totalGauges.length, 1);
  assert.equal(totalGauges[0]?.value, 100);
  assert.equal(totalGauges[0]?.labels.runId, "run_abc");
  assert.equal(totalGauges[0]?.labels.budgetId, "budget_x");

  const utilGauges = registry.getGauges("harness_budget_utilization_percent");
  assert.equal(utilGauges.length, 1);
  assert.equal(utilGauges[0]?.value, 75);
  assert.equal(utilGauges[0]?.labels.runId, "run_abc");
  assert.equal(utilGauges[0]?.labels.budgetId, "budget_x");
});

test("recordHarnessBudgetConsumed calculates utilization as 0 when total is 0", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordHarnessBudgetConsumed("run_abc", "budget_x", 10, 0);

  const utilGauges = registry.getGauges("harness_budget_utilization_percent");
  assert.equal(utilGauges[0]?.value, 0);
});

test("recordHarnessExecutionLatency records execution latency histogram", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordHarnessExecutionLatency("run_abc", "exec_123", 180);

  const histograms = registry.getHistograms("harness_execution_latency_ms");
  assert.equal(histograms.length, 1);
  assert.equal(histograms[0]?.count, 1);
  assert.equal(histograms[0]?.sum, 180);
  assert.equal(histograms[0]?.labels.runId, "run_abc");
});

test("recordHarnessTaskStarted increments task started counter", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordHarnessTaskStarted("run_abc", "task_xyz");

  const counters = registry.getCounters("harness_task_started_total");
  assert.equal(counters.length, 1);
  assert.equal(counters[0]?.value, 1);
  assert.equal(counters[0]?.labels.runId, "run_abc");
});

test("recordHarnessTaskCompleted increments task completed counter with status", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordHarnessTaskCompleted("run_abc", "task_xyz", "completed");

  const counters = registry.getCounters("harness_task_completed_total");
  assert.equal(counters.length, 1);
  assert.equal(counters[0]?.value, 1);
  assert.equal(counters[0]?.labels.runId, "run_abc");
  assert.equal(counters[0]?.labels.status, "completed");
});

test("recordHarnessPluginInvoked increments plugin counter with success as string", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordHarnessPluginInvoked("run_abc", "plugin_q", true);
  registry.recordHarnessPluginInvoked("run_abc", "plugin_q", false);

  const counters = registry.getCounters("harness_plugin_invoked_total");
  assert.equal(counters.length, 2);

  const successCounter = counters.find((c) => c.labels.success === "true");
  assert.ok(successCounter !== undefined);
  assert.equal(successCounter?.value, 1);

  const failureCounter = counters.find((c) => c.labels.success === "false");
  assert.ok(failureCounter !== undefined);
  assert.equal(failureCounter?.value, 1);
});

test("recordHarnessPolicyDecision increments policy decision counter", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordHarnessPolicyDecision("run_abc", "access_control", "allowed");

  const counters = registry.getCounters("harness_policy_decision_total");
  assert.equal(counters.length, 1);
  assert.equal(counters[0]?.value, 1);
  assert.equal(counters[0]?.labels.runId, "run_abc");
  assert.equal(counters[0]?.labels.policyType, "access_control");
  assert.equal(counters[0]?.labels.outcome, "allowed");
});

test("recordKnowledgeQuery records query duration and outcome", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordKnowledgeQuery("search", 45, "hit");

  const histograms = registry.getHistograms("knowledge_query_duration_ms");
  assert.equal(histograms.length, 1);
  assert.equal(histograms[0]?.count, 1);
  assert.equal(histograms[0]?.sum, 45);
  assert.equal(histograms[0]?.labels.operation, "search");

  const counters = registry.getCounters("knowledge_query_total");
  assert.equal(counters.length, 1);
  assert.equal(counters[0]?.labels.operation, "search");
  assert.equal(counters[0]?.labels.result, "hit");
});

test("harness metrics are isolated from other metric types", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordHarnessRunDuration("run_1", 100, "success");
  registry.recordHarnessTaskStarted("run_1", "task_1");
  registry.recordHarnessPolicyDecision("run_1", "authz", "allowed");

  const harnessRunCounters = registry.getCounters("harness_run_total");
  const harnessTaskCounters = registry.getCounters("harness_task_started_total");
  const harnessPolicyCounters = registry.getCounters("harness_policy_decision_total");

  assert.equal(harnessRunCounters.length, 1);
  assert.equal(harnessTaskCounters.length, 1);
  assert.equal(harnessPolicyCounters.length, 1);

  // Verify harness metrics don't pollute other metric names
  const httpCounters = registry.getCounters("http_requests_total");
  assert.equal(httpCounters.length, 0);
});
