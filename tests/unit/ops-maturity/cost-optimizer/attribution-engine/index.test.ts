import assert from "node:assert/strict";
import test from "node:test";

import { aggregateCostAttribution } from "../../../../../src/ops-maturity/cost-optimizer/attribution-engine/index.js";

test("aggregateCostAttribution aggregates multiple entries for same subject", () => {
  const entries = [
    { subjectId: "agent-1", llmCostUsd: 10.5, toolCostUsd: 0, computeCostUsd: 0, storageCostUsd: 0, egressCostUsd: 0, humanReviewCostUsd: 0 },
    { subjectId: "agent-2", llmCostUsd: 5.0, toolCostUsd: 0, computeCostUsd: 0, storageCostUsd: 0, egressCostUsd: 0, humanReviewCostUsd: 0 },
    { subjectId: "agent-1", llmCostUsd: 3.25, toolCostUsd: 0, computeCostUsd: 0, storageCostUsd: 0, egressCostUsd: 0, humanReviewCostUsd: 0 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.equal(result["agent-1"], 13.75);
  assert.equal(result["agent-2"], 5.0);
});

test("aggregateCostAttribution returns empty object for empty input", () => {
  const result = aggregateCostAttribution([]);
  assert.deepStrictEqual(result, {});
});

test("aggregateCostAttribution handles single entry [ops-maturity-attribution-engine-index]", () => {
  const entries = [{ subjectId: "agent-x", llmCostUsd: 42.99, toolCostUsd: 0, computeCostUsd: 0, storageCostUsd: 0, egressCostUsd: 0, humanReviewCostUsd: 0 }];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["agent-x"], 42.99);
});

test("aggregateCostAttribution rounds to 4 decimal places [ops-maturity-attribution-engine-index]", () => {
  const entries = [
    { subjectId: "agent-y", llmCostUsd: 0.12345, toolCostUsd: 0, computeCostUsd: 0, storageCostUsd: 0, egressCostUsd: 0, humanReviewCostUsd: 0 },
    { subjectId: "agent-y", llmCostUsd: 0.6789, toolCostUsd: 0, computeCostUsd: 0, storageCostUsd: 0, egressCostUsd: 0, humanReviewCostUsd: 0 },
  ];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["agent-y"], 0.8024);
});

test("aggregateCostAttribution handles many entries for same subject [ops-maturity-attribution-engine-index]", () => {
  const entries = [
    { subjectId: "agent-z", llmCostUsd: 1, toolCostUsd: 0, computeCostUsd: 0, storageCostUsd: 0, egressCostUsd: 0, humanReviewCostUsd: 0 },
    { subjectId: "agent-z", llmCostUsd: 2, toolCostUsd: 0, computeCostUsd: 0, storageCostUsd: 0, egressCostUsd: 0, humanReviewCostUsd: 0 },
    { subjectId: "agent-z", llmCostUsd: 3, toolCostUsd: 0, computeCostUsd: 0, storageCostUsd: 0, egressCostUsd: 0, humanReviewCostUsd: 0 },
    { subjectId: "agent-z", llmCostUsd: 4, toolCostUsd: 0, computeCostUsd: 0, storageCostUsd: 0, egressCostUsd: 0, humanReviewCostUsd: 0 },
    { subjectId: "agent-z", llmCostUsd: 5, toolCostUsd: 0, computeCostUsd: 0, storageCostUsd: 0, egressCostUsd: 0, humanReviewCostUsd: 0 },
  ];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["agent-z"], 15);
});

test("aggregateCostAttribution handles zero amounts", () => {
  const entries = [
    { subjectId: "agent-zero", llmCostUsd: 0, toolCostUsd: 0, computeCostUsd: 0, storageCostUsd: 0, egressCostUsd: 0, humanReviewCostUsd: 0 },
    { subjectId: "agent-zero", llmCostUsd: 0, toolCostUsd: 0, computeCostUsd: 0, storageCostUsd: 0, egressCostUsd: 0, humanReviewCostUsd: 0 },
  ];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["agent-zero"], 0);
});

test("aggregateCostAttribution sums 7 dimensions correctly", () => {
  const entries = [
    { subjectId: "task-1", llmCostUsd: 10, toolCostUsd: 5, computeCostUsd: 3, storageCostUsd: 2, egressCostUsd: 1, humanReviewCostUsd: 0 },
    { subjectId: "task-1", llmCostUsd: 5, toolCostUsd: 2, computeCostUsd: 1, storageCostUsd: 1, egressCostUsd: 0, humanReviewCostUsd: 1 },
  ];
  const result = aggregateCostAttribution(entries);
  // 10+5+3+2+1+0 = 21 (first entry)
  // 5+2+1+1+0+1 = 10 (second entry)
  // total = 31
  assert.equal(result["task-1"], 31);
});
