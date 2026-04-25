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

test("aggregateCostAttribution handles single entry", () => {
  const entries: CostAttributionEntry[] = [{ subjectId: "agent-x", amountUsd: 42.99 }];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["agent-x"], 42.99);
});

test("aggregateCostAttribution rounds to 4 decimal places", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "agent-y", amountUsd: 0.12345 },
    { subjectId: "agent-y", amountUsd: 0.6789 },
  ];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["agent-y"], 0.8024);
});

test("aggregateCostAttribution handles many entries for same subject", () => {
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
