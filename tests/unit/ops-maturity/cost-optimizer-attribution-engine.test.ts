import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateCostAttribution,
  type CostAttributionEntry,
} from "../../../src/ops-maturity/cost-optimizer/attribution-engine/index.js";

test("aggregateCostAttribution sums amounts by subjectId", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "workflow_a", amountUsd: 10.5 },
    { subjectId: "workflow_a", amountUsd: 5.5 },
    { subjectId: "workflow_b", amountUsd: 20 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["workflow_a"], 16);
  assert.strictEqual(result["workflow_b"], 20);
});

test("aggregateCostAttribution handles empty array", () => {
  const result = aggregateCostAttribution([]);
  assert.deepStrictEqual(result, {});
});

test("aggregateCostAttribution handles single entry [ops-maturity-attribution-engine]", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "task_1", amountUsd: 7.1234 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["task_1"], 7.1234);
});

test("aggregateCostAttribution handles multiple entries for same subject", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "agent_x", amountUsd: 0.1 },
    { subjectId: "agent_x", amountUsd: 0.2 },
    { subjectId: "agent_x", amountUsd: 0.3 },
    { subjectId: "agent_x", amountUsd: 0.4 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["agent_x"], 1);
});

test("aggregateCostAttribution rounds to 4 decimal places [ops-maturity-attribution-engine]", () => {
  const entries: CostAttributionEntry[] = [
    { subjectId: "task_1", amountUsd: 1.12345 },
    { subjectId: "task_2", amountUsd: 2.99999 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.strictEqual(result["task_1"], 1.1235);
  assert.strictEqual(result["task_2"], 3);
});
