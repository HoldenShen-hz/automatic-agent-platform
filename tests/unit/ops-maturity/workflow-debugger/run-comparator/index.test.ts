/**
 * Unit tests for Run Comparator
 *
 * @see src/ops-maturity/workflow-debugger/run-comparator/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  compareWorkflowRuns,
  buildRunComparison,
  type RunSnapshot,
  type RunComparisonDiff,
} from "../../../../../src/ops-maturity/workflow-debugger/run-comparator/index.js";

test("compareWorkflowRuns returns empty array when all steps match", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "build", status: "done" },
    { stepId: "deploy", status: "done" },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "build", status: "done" },
    { stepId: "deploy", status: "done" },
  ];

  const result = compareWorkflowRuns(left, right);

  assert.deepEqual(result, []);
});

test("compareWorkflowRuns returns differences when step statuses differ", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "paused" },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "failed" },
  ];

  const result = compareWorkflowRuns(left, right);

  assert.deepEqual(result, ["step:deploy:paused->failed"]);
});

test("compareWorkflowRuns reports step missing on right as 'missing'", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "build", status: "done" },
    { stepId: "deploy", status: "done" },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "build", status: "done" },
  ];

  const result = compareWorkflowRuns(left, right);

  assert.deepEqual(result, ["step:deploy:done->missing"]);
});

test("compareWorkflowRuns detects steps only in right (issue #1922)", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "build", status: "done" },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "build", status: "done" },
    { stepId: "deploy", status: "skipped" },
  ];

  const result = compareWorkflowRuns(left, right);

  // Should now detect deploy is missing from left (exists only in right)
  assert.deepEqual(result, ["step:deploy:missing->skipped"]);
});

test("compareWorkflowRuns detects both left-only and right-only steps", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "build", status: "done" },
    { stepId: "test", status: "passed" },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "build", status: "done" },
    { stepId: "deploy", status: "skipped" },
  ];

  const result = compareWorkflowRuns(left, right);

  // test only exists in left, deploy only exists in right
  assert.equal(result.length, 2);
  assert.ok(result.includes("step:test:passed->missing"));
  assert.ok(result.includes("step:deploy:missing->skipped"));
});

test("compareWorkflowRuns detects right-only steps with nodeRunId", () => {
  const left: readonly RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success" },
  ];
  const right: readonly RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success" },
    { nodeRunId: "step-2", status: "failed" },
  ];

  const result = compareWorkflowRuns(left, right);

  assert.deepEqual(result, ["step:step-2:missing_in_left"]);
});

test("compareWorkflowRuns detects right-only steps when left is empty", () => {
  const left: readonly RunSnapshot[] = [];
  const right: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "failed" },
  ];

  const result = compareWorkflowRuns(left, right);

  // Right-only steps should be detected (issue #1922 fix)
  assert.deepEqual(result, ["step:deploy:missing->failed"]);
});

test("compareWorkflowRuns handles empty right array", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "done" },
  ];
  const right: readonly RunSnapshot[] = [];

  const result = compareWorkflowRuns(left, right);

  assert.deepEqual(result, ["step:deploy:done->missing"]);
});

test("compareWorkflowRuns handles multiple differences", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "build", status: "done" },
    { stepId: "test", status: "passed" },
    { stepId: "deploy", status: "pending" },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "build", status: "done" },
    { stepId: "test", status: "failed" },
    { stepId: "deploy", status: "skipped" },
  ];

  const result = compareWorkflowRuns(left, right);

  assert.equal(result.length, 2);
  assert.ok(result.includes("step:test:passed->failed"));
  assert.ok(result.includes("step:deploy:pending->skipped"));
});

test("compareWorkflowRuns with latencyMs does not affect comparison output", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "done", latencyMs: 100 },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "done", latencyMs: 200 },
  ];

  const result = compareWorkflowRuns(left, right);

  assert.deepEqual(result, []);
});

test("buildRunComparison returns diff with correct fields", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "build", status: "done", latencyMs: 50 },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "build", status: "done", latencyMs: 100 },
  ];

  const result = buildRunComparison(left, right);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.stepId, "build");
  assert.equal(result[0]?.leftStatus, "done");
  assert.equal(result[0]?.rightStatus, "done");
});

test("buildRunComparison calculates latencyDeltaMs when both sides have latency", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "done", latencyMs: 100 },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "done", latencyMs: 150 },
  ];

  const result = buildRunComparison(left, right);

  assert.equal(result[0]?.latencyDeltaMs, 50);
});

test("buildRunComparison returns null latencyDeltaMs when left lacks latency", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "done" },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "done", latencyMs: 150 },
  ];

  const result = buildRunComparison(left, right);

  assert.equal(result[0]?.latencyDeltaMs, null);
});

test("buildRunComparison returns null latencyDeltaMs when right lacks latency", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "done", latencyMs: 100 },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "done" },
  ];

  const result = buildRunComparison(left, right);

  assert.equal(result[0]?.latencyDeltaMs, null);
});

test("buildRunComparison returns null latencyDeltaMs when both lack latency", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "done" },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "done" },
  ];

  const result = buildRunComparison(left, right);

  assert.equal(result[0]?.latencyDeltaMs, null);
});

test("buildRunComparison detects outputChanged when hashes differ", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "build", status: "done", outputHash: "abc123" },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "build", status: "done", outputHash: "def456" },
  ];

  const result = buildRunComparison(left, right);

  assert.equal(result[0]?.outputChanged, true);
});

test("buildRunComparison outputChanged is false when hashes match", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "build", status: "done", outputHash: "abc123" },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "build", status: "done", outputHash: "abc123" },
  ];

  const result = buildRunComparison(left, right);

  assert.equal(result[0]?.outputChanged, false);
});

test("buildRunComparison outputChanged is false when neither has hash", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "build", status: "done" },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "build", status: "done" },
  ];

  const result = buildRunComparison(left, right);

  assert.equal(result[0]?.outputChanged, false);
});

test("buildRunComparison outputChanged is false when only left has hash", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "build", status: "done", outputHash: "abc123" },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "build", status: "done" },
  ];

  const result = buildRunComparison(left, right);

  assert.equal(result[0]?.outputChanged, false);
});

test("buildRunComparison outputChanged is false when only right has hash", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "build", status: "done" },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "build", status: "done", outputHash: "abc123" },
  ];

  const result = buildRunComparison(left, right);

  assert.equal(result[0]?.outputChanged, false);
});

test("buildRunComparison marks missing rightStatus as 'missing'", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "done" },
  ];
  const right: readonly RunSnapshot[] = [];

  const result = buildRunComparison(left, right);

  assert.equal(result[0]?.rightStatus, "missing");
});

test("buildRunComparison includes all left steps in output", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "build", status: "done" },
    { stepId: "test", status: "passed" },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "build", status: "done" },
  ];

  const result = buildRunComparison(left, right);

  assert.equal(result.length, 2);
  assert.equal(result[0]?.stepId, "build");
  assert.equal(result[1]?.stepId, "test");
});

test("buildRunComparison handles negative latencyDeltaMs", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "done", latencyMs: 200 },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "done", latencyMs: 100 },
  ];

  const result = buildRunComparison(left, right);

  assert.equal(result[0]?.latencyDeltaMs, -100);
});

test("buildRunComparison handles zero latencyDeltaMs", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "done", latencyMs: 100 },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "done", latencyMs: 100 },
  ];

  const result = buildRunComparison(left, right);

  assert.equal(result[0]?.latencyDeltaMs, 0);
});

test("buildRunComparison with status mismatch returns correct statuses", () => {
  const left: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "pending" },
  ];
  const right: readonly RunSnapshot[] = [
    { stepId: "deploy", status: "failed" },
  ];

  const result = buildRunComparison(left, right);

  assert.equal(result[0]?.leftStatus, "pending");
  assert.equal(result[0]?.rightStatus, "failed");
});
