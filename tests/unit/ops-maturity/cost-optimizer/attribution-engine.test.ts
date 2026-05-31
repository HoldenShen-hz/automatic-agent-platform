import assert from "node:assert/strict";
import test from "node:test";

import { aggregateCostAttribution, type CostAttributionEntry } from "../../../../src/ops-maturity/cost-optimizer/attribution-engine/index.js";

test("aggregateCostAttribution aggregates multiple entries for same subject", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "agent-1", amountUsd: 10.5 },
    { subjectId: "agent-2", amountUsd: 5.0 },
    { subjectId: "agent-1", amountUsd: 3.25 },
  ];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["agent-1"], 13.75);
  assert.equal(result["agent-2"], 5.0);
});

test("aggregateCostAttribution returns empty object for empty input", () => {
  const result = aggregateCostAttribution([]);
  assert.deepEqual(result, {});
});

test("aggregateCostAttribution handles single entry [ops-maturity-attribution-engine]", () => {
  const entries: CostAttributionEntry[] = [{ subjectId: "agent-x", amountUsd: 42.99 }];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["agent-x"], 42.99);
});

test("aggregateCostAttribution rounds to 4 decimal places [ops-maturity-attribution-engine]", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "agent-y", amountUsd: 0.12345 },
    { subjectId: "agent-y", amountUsd: 0.6789 },
  ];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["agent-y"], 0.8024);
});

test("aggregateCostAttribution handles many entries for same subject [ops-maturity-attribution-engine]", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "agent-z", amountUsd: 1 },
    { subjectId: "agent-z", amountUsd: 2 },
    { subjectId: "agent-z", amountUsd: 3 },
    { subjectId: "agent-z", amountUsd: 4 },
    { subjectId: "agent-z", amountUsd: 5 },
  ];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["agent-z"], 15);
});

test("aggregateCostAttribution handles zero amounts", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "agent-zero", amountUsd: 0 },
    { subjectId: "agent-zero", amountUsd: 0 },
  ];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["agent-zero"], 0);
});

test("aggregateCostAttribution handles many different subjects", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "task-a", amountUsd: 100 },
    { subjectId: "task-b", amountUsd: 200 },
    { subjectId: "task-c", amountUsd: 300 },
    { subjectId: "task-d", amountUsd: 400 },
    { subjectId: "task-e", amountUsd: 500 },
  ];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["task-a"], 100);
  assert.equal(result["task-b"], 200);
  assert.equal(result["task-c"], 300);
  assert.equal(result["task-d"], 400);
  assert.equal(result["task-e"], 500);
  assert.equal(Object.keys(result).length, 5);
});

test("aggregateCostAttribution handles negative amounts", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "agent-refund", amountUsd: 50 },
    { subjectId: "agent-refund", amountUsd: -20 },
  ];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["agent-refund"], 30);
});

test("aggregateCostAttribution handles large values", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "big-spender", amountUsd: 1_000_000 },
    { subjectId: "big-spender", amountUsd: 2_500_000.12345 },
  ];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["big-spender"], 3500000.1235);
});

test("aggregateCostAttribution sums all 7 cost dimensions individually when amountUsd is absent", () => {
  // §64.1 requires 7-dimension breakdown: llm/tool/compute/storage/egress/humanReview + total
  const entries: CostAttributionEntry[] = [
    { subjectId: "task-7dim", llmCostUsd: 10, toolCostUsd: 5, computeCostUsd: 3, storageCostUsd: 2, egressCostUsd: 1, humanReviewCostUsd: 0.5 },
    { subjectId: "task-7dim", llmCostUsd: 20, toolCostUsd: 2, computeCostUsd: 1, storageCostUsd: 0.5, egressCostUsd: 0.25, humanReviewCostUsd: 0.25 },
  ];
  const result = aggregateCostAttribution(entries);
  // 10+5+3+2+1+0.5 + 20+2+1+0.5+0.25+0.25 = 45.5
  assert.equal(result["task-7dim"], 45.5);
});

test("aggregateCostAttribution falls back to amountUsd when all 7 dimensions absent", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "task-total", amountUsd: 99.99 },
  ];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["task-total"], 99.99);
});

test("aggregateCostAttribution prefers amountUsd over individual dimensions when both present", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "task-pref", amountUsd: 50, llmCostUsd: 100, toolCostUsd: 100 },
  ];
  const result = aggregateCostAttribution(entries);
  // When amountUsd is present, individual dimensions are ignored (sum uses amountUsd directly)
  assert.equal(result["task-pref"], 50);
});

test("aggregateCostAttribution handles mixed amountUsd and dimension-only entries for same subject", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "task-mixed", amountUsd: 30 },
    { subjectId: "task-mixed", llmCostUsd: 10, toolCostUsd: 5, computeCostUsd: 3, storageCostUsd: 1, egressCostUsd: 1, humanReviewCostUsd: 0 },
  ];
  const result = aggregateCostAttribution(entries);
  // First entry: 30 (uses amountUsd); second entry: 20 (sums dimensions); total = 50
  assert.equal(result["task-mixed"], 50);
});

test("aggregateCostAttribution verifies 7-dimension sum across multiple subjects", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "workflow-A", llmCostUsd: 50, toolCostUsd: 20, computeCostUsd: 10, storageCostUsd: 5, egressCostUsd: 3, humanReviewCostUsd: 2 },
    { subjectId: "workflow-B", llmCostUsd: 100, toolCostUsd: 40, computeCostUsd: 20, storageCostUsd: 10, egressCostUsd: 6, humanReviewCostUsd: 4 },
    { subjectId: "workflow-A", llmCostUsd: 25, toolCostUsd: 10, computeCostUsd: 5, storageCostUsd: 2.5, egressCostUsd: 1.5, humanReviewCostUsd: 1 },
  ];
  const result = aggregateCostAttribution(entries);
  // workflow-A: (50+20+10+5+3+2) + (25+10+5+2.5+1.5+1) = 90 + 45 = 135
  assert.equal(result["workflow-A"], 135);
  // workflow-B: 100+40+20+10+6+4 = 180
  assert.equal(result["workflow-B"], 180);
});
