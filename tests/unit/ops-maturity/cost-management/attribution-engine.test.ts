import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateCostAttribution,
  type CostAttributionEntry,
} from "../../../../src/ops-maturity/cost-optimizer/attribution-engine/index.js";

test("cost-management: aggregateCostAttribution sums amounts by subjectId", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "workflow_a", amountUsd: 10.5 },
    { subjectId: "workflow_a", amountUsd: 5.5 },
    { subjectId: "workflow_b", amountUsd: 20 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["workflow_a"], 16);
  assert.strictEqual(result["workflow_b"], 20);
});

test("cost-management: aggregateCostAttribution handles empty array", () => {
  const result = aggregateCostAttribution([]);

  assert.deepStrictEqual(result, {});
});

test("cost-management: aggregateCostAttribution handles single entry", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "task_1", amountUsd: 7.1234 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["task_1"], 7.1234);
});

test("cost-management: aggregateCostAttribution handles multiple entries for same subject", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "agent_x", amountUsd: 0.1 },
    { subjectId: "agent_x", amountUsd: 0.2 },
    { subjectId: "agent_x", amountUsd: 0.3 },
    { subjectId: "agent_x", amountUsd: 0.4 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["agent_x"], 1);
});

test("cost-management: aggregateCostAttribution rounds to 4 decimal places", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "task_1", amountUsd: 1.12345 },
    { subjectId: "task_2", amountUsd: 2.99999 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["task_1"], 1.1235);
  assert.strictEqual(result["task_2"], 3);
});

test("cost-management: aggregateCostAttribution uses component costs when amountUsd not provided", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "task_1", llmCostUsd: 5, toolCostUsd: 2, computeCostUsd: 1 },
    { subjectId: "task_2", llmCostUsd: 10, storageCostUsd: 3, egressCostUsd: 2 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["task_1"], 8);
  assert.strictEqual(result["task_2"], 15);
});

test("cost-management: aggregateCostAttribution prefers amountUsd over component costs", () => {
  const entries: CostAttributionEntry[] = [
    {
      subjectId: "task_1",
      amountUsd: 100,
      llmCostUsd: 5,
      toolCostUsd: 2,
      computeCostUsd: 1,
    },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["task_1"], 100);
});

test("cost-management: aggregateCostAttribution handles zero component costs", () => {
  const entries: CostAttributionEntry[] = [
    {
      subjectId: "task_1",
      llmCostUsd: 0,
      toolCostUsd: 0,
      computeCostUsd: 0,
      storageCostUsd: 0,
      egressCostUsd: 0,
      humanReviewCostUsd: 0,
    },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["task_1"], 0);
});

test("cost-management: aggregateCostAttribution handles undefined component costs", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "task_1" },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["task_1"], 0);
});

test("cost-management: aggregateCostAttribution handles floating point precision issues", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "task_fp", amountUsd: 0.1 },
    { subjectId: "task_fp", amountUsd: 0.2 },
    { subjectId: "task_fp", amountUsd: 0.3 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["task_fp"], 0.6);
});

test("cost-management: aggregateCostAttribution handles large cost values", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "task_large", amountUsd: 1_000_000.1234 },
    { subjectId: "task_large", amountUsd: 2_000_000.5678 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["task_large"], 3_000_000.6912);
});

test("cost-management: aggregateCostAttribution handles mixed subject types", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "task_1", amountUsd: 10 },
    { subjectId: "workflow_1", amountUsd: 20 },
    { subjectId: "agent_1", amountUsd: 30 },
    { subjectId: "model_1", amountUsd: 40 },
    { subjectId: "domain_1", amountUsd: 50 },
    { subjectId: "run_1", amountUsd: 60 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["task_1"], 10);
  assert.strictEqual(result["workflow_1"], 20);
  assert.strictEqual(result["agent_1"], 30);
  assert.strictEqual(result["model_1"], 40);
  assert.strictEqual(result["domain_1"], 50);
  assert.strictEqual(result["run_1"], 60);
});