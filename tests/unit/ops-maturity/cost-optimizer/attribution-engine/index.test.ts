import assert from "node:assert/strict";
import test from "node:test";

import { aggregateCostAttribution } from "../../../../../src/ops-maturity/cost-optimizer/attribution-engine/index.js";

test("aggregateCostAttribution aggregates multiple entries for same subject", () => {
  const entries = [
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
  assert.deepStrictEqual(result, {});
});

test("aggregateCostAttribution handles single entry", () => {
  const entries = [{ subjectId: "agent-x", amountUsd: 42.99 }];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["agent-x"], 42.99);
});

test("aggregateCostAttribution rounds to 4 decimal places", () => {
  const entries = [
    { subjectId: "agent-y", amountUsd: 0.12345 },
    { subjectId: "agent-y", amountUsd: 0.6789 },
  ];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["agent-y"], 0.8024);
});

test("aggregateCostAttribution handles many entries for same subject", () => {
  const entries = [
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
  const entries = [
    { subjectId: "agent-zero", amountUsd: 0 },
    { subjectId: "agent-zero", amountUsd: 0 },
  ];
  const result = aggregateCostAttribution(entries);
  assert.equal(result["agent-zero"], 0);
});
