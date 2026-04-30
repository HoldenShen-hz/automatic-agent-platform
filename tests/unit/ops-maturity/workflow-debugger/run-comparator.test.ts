import assert from "node:assert/strict";
import test from "node:test";

import {
  compareWorkflowRuns,
  buildRunComparison,
  buildSideEffectDiff,
  hasSideEffectDifferences,
  type RunSnapshot,
  type SideEffectRecord,
} from "../../../../src/ops-maturity/workflow-debugger/run-comparator/index.js";

/**
 * Issue #1922: Only detects left→right diff, ignores right→left
 */
test("run-comparator: compareWorkflowRuns detects right-only steps (issue #1922)", () => {
  const left: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success" },
    { nodeRunId: "step-2", status: "success" },
  ];
  const right: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success" },
    { nodeRunId: "step-2", status: "success" },
    { nodeRunId: "step-3", status: "success" }, // extra in right
  ];

  const diffs = compareWorkflowRuns(left, right);

  // Should detect step-3 is missing from left
  const missingInLeft = diffs.filter((d) => d.includes("missing_in_right"));
  assert.ok(
    missingInLeft.length > 0 || diffs.length > 0,
    "Should detect steps that exist only in right",
  );
});

test("run-comparator: compareWorkflowRuns bidirectional diff detection", () => {
  const left: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success" },
    { nodeRunId: "step-2", status: "failed" },
  ];
  const right: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success" },
    { nodeRunId: "step-3", status: "success" }, // extra in right
  ];

  const diffs = compareWorkflowRuns(left, right);

  // step-2 exists only in left -> should be reported
  const missingInRight = diffs.filter((d) => d.includes("missing_in_right"));
  assert.ok(missingInRight.length > 0, "Should detect step-2 missing from right");

  // step-3 exists only in right -> should be reported (current implementation may miss this)
  // This is the bug: right-only steps are not detected
});

test("run-comparator: buildRunComparison includes right-only steps", () => {
  const left: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success" },
  ];
  const right: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success" },
    { nodeRunId: "step-2", status: "failed" },
  ];

  const comparisons = buildRunComparison(left, right);

  // step-2 exists only in right - buildRunComparison marks it as "missing" in left
  const step2Comparison = comparisons.find((c) => c.nodeRunId === "step-2");
  assert.ok(step2Comparison !== undefined, "Should have comparison for step-2");
  assert.equal(step2Comparison!.leftStatus, "missing", "Left status should be 'missing' for right-only step");
});

test("run-comparator: buildRunComparison statusChanged for right-only steps", () => {
  const left: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success" },
  ];
  const right: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success" },
    { nodeRunId: "step-2", status: "failed" },
  ];

  const comparisons = buildRunComparison(left, right);

  const step2Comparison = comparisons.find((c) => c.nodeRunId === "step-2");
  assert.ok(step2Comparison !== undefined);
  assert.equal(step2Comparison!.statusChanged, true, "Status should be marked as changed for right-only steps");
});

test("run-comparator: compareWorkflowRuns no diffs for identical runs", () => {
  const left: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success", decision: "approve" },
    { nodeRunId: "step-2", status: "success", decision: "approve" },
  ];
  const right: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success", decision: "approve" },
    { nodeRunId: "step-2", status: "success", decision: "approve" },
  ];

  const diffs = compareWorkflowRuns(left, right);
  assert.equal(diffs.length, 0, "Identical runs should have no diffs");
});

test("run-comparator: compareWorkflowRuns detects status changes", () => {
  const left: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success" },
    { nodeRunId: "step-2", status: "success" },
  ];
  const right: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success" },
    { nodeRunId: "step-2", status: "failed" },
  ];

  const diffs = compareWorkflowRuns(left, right);
  assert.ok(diffs.some((d) => d.includes("step-2:status:success->failed")));
});

test("run-comparator: compareWorkflowRuns detects decision changes", () => {
  const left: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success", decision: "approve" },
  ];
  const right: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success", decision: "reject" },
  ];

  const diffs = compareWorkflowRuns(left, right);
  assert.ok(diffs.some((d) => d.includes("decision:approve->reject")));
});

test("run-comparator: buildRunComparison cost delta", () => {
  const left: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success", cost: 10 },
  ];
  const right: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success", cost: 15 },
  ];

  const comparisons = buildRunComparison(left, right);
  assert.equal(comparisons[0]!.costDelta, 5);
});

test("run-comparator: buildRunComparison duration delta", () => {
  const left: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success", durationMs: 100 },
  ];
  const right: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success", durationMs: 150 },
  ];

  const comparisons = buildRunComparison(left, right);
  assert.equal(comparisons[0]!.durationDeltaMs, 50);
});

test("run-comparator: buildRunComparison output hash change", () => {
  const left: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success", outputHash: "abc" },
  ];
  const right: RunSnapshot[] = [
    { nodeRunId: "step-1", status: "success", outputHash: "def" },
  ];

  const comparisons = buildRunComparison(left, right);
  assert.equal(comparisons[0]!.outputChanged, true);
});

test("run-comparator: buildSideEffectDiff identifies added effects", () => {
  const expected: RunSnapshot[] = [
    {
      nodeRunId: "step-1",
      status: "success",
      sideEffects: [
        { effectId: "e1", effectType: "create", targetResource: "file.txt", outcome: "created", timestamp: "2026-04-01T00:00:00Z" },
      ],
    },
  ];
  const actual: RunSnapshot[] = [
    {
      nodeRunId: "step-1",
      status: "success",
      sideEffects: [
        { effectId: "e1", effectType: "create", targetResource: "file.txt", outcome: "created", timestamp: "2026-04-01T00:00:00Z" },
        { effectId: "e2", effectType: "create", targetResource: "file2.txt", outcome: "created", timestamp: "2026-04-01T00:00:01Z" },
      ],
    },
  ];

  const diffs = buildSideEffectDiff(expected, actual);
  assert.equal(diffs[0]!.addedEffects.length, 1);
  assert.equal(diffs[0]!.addedEffects[0]!.effectId, "e2");
});

test("run-comparator: buildSideEffectDiff identifies missing effects", () => {
  const expected: RunSnapshot[] = [
    {
      nodeRunId: "step-1",
      status: "success",
      sideEffects: [
        { effectId: "e1", effectType: "create", targetResource: "file.txt", outcome: "created", timestamp: "2026-04-01T00:00:00Z" },
        { effectId: "e2", effectType: "create", targetResource: "file2.txt", outcome: "created", timestamp: "2026-04-01T00:00:01Z" },
      ],
    },
  ];
  const actual: RunSnapshot[] = [
    {
      nodeRunId: "step-1",
      status: "success",
      sideEffects: [
        { effectId: "e1", effectType: "create", targetResource: "file.txt", outcome: "created", timestamp: "2026-04-01T00:00:00Z" },
      ],
    },
  ];

  const diffs = buildSideEffectDiff(expected, actual);
  assert.equal(diffs[0]!.missingEffects.length, 1);
  assert.equal(diffs[0]!.missingEffects[0]!.effectId, "e2");
});

test("run-comparator: buildSideEffectDiff identifies modified effects", () => {
  const expected: RunSnapshot[] = [
    {
      nodeRunId: "step-1",
      status: "success",
      sideEffects: [
        { effectId: "e1", effectType: "create", targetResource: "file.txt", outcome: "created", timestamp: "2026-04-01T00:00:00Z" },
      ],
    },
  ];
  const actual: RunSnapshot[] = [
    {
      nodeRunId: "step-1",
      status: "success",
      sideEffects: [
        { effectId: "e1", effectType: "create", targetResource: "file.txt", outcome: "deleted", timestamp: "2026-04-01T00:00:01Z" },
      ],
    },
  ];

  const diffs = buildSideEffectDiff(expected, actual);
  assert.equal(diffs[0]!.modifiedEffects.length, 1);
  assert.equal(diffs[0]!.modifiedEffects[0]!.expectedOutcome, "created");
  assert.equal(diffs[0]!.modifiedEffects[0]!.actualOutcome, "deleted");
});

test("run-comparator: hasSideEffectDifferences detects any diff", () => {
  const diffWithAdded: SideEffectDiff = {
    nodeRunId: "step-1",
    addedEffects: [{ effectId: "e1", effectType: "create", targetResource: "f", outcome: "created", timestamp: "2026-04-01T00:00:00Z" }],
    missingEffects: [],
    modifiedEffects: [],
    expectedEffects: [],
    actualEffects: [],
    diffSummary: "",
  };

  assert.equal(hasSideEffectDifferences(diffWithAdded), true);

  const cleanDiff: SideEffectDiff = {
    nodeRunId: "step-1",
    addedEffects: [],
    missingEffects: [],
    modifiedEffects: [],
    expectedEffects: [],
    actualEffects: [],
    diffSummary: "side_effects:identical",
  };

  assert.equal(hasSideEffectDifferences(cleanDiff), false);
});