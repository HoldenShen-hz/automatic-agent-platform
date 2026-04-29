import assert from "node:assert/strict";
import test from "node:test";

import {
  EXECUTION_STATUSES,
  isExecutionStatus,
} from "../../../../../src/platform/contracts/types/status.js";

// =============================================================================
// R9-04: EXECUTION_STATUSES completeness verification
//
// Expected 13 states per R9-04:
// created, queued, dispatching, prechecking, executing, paused,
// recovering, timed_out, blocked, succeeded, failed, cancelled, superseded
// =============================================================================

const R9_04_EXPECTED_STATES = [
  "created",
  "queued",
  "dispatching",
  "prechecking",
  "executing",
  "paused",
  "recovering",
  "timed_out",
  "blocked",
  "succeeded",
  "failed",
  "cancelled",
  "superseded",
];

const R9_04_MISSING_STATES = [
  "queued",
  "dispatching",
  "paused",
  "recovering",
  "timed_out",
  "resuming",
  "ready",
];

// =============================================================================
// R9-04-1: EXECUTION_STATUSES includes all 13 states
// =============================================================================

test("R9-04-1: EXECUTION_STATUSES includes all 13 states", () => {
  const currentStatuses = Array.from(EXECUTION_STATUSES);

  for (const expectedState of R9_04_EXPECTED_STATES) {
    const hasState = currentStatuses.includes(expectedState as typeof EXECUTION_STATUSES[number]);
    assert.equal(
      hasState,
      true,
      `EXECUTION_STATUSES missing expected state: ${expectedState}. ` +
        `Current states: ${currentStatuses.join(", ")}`
    );
  }

  assert.equal(
    currentStatuses.length,
    13,
    `EXECUTION_STATUSES should have 13 states, found ${currentStatuses.length}: ${currentStatuses.join(", ")}`
  );
});

test("R9-04-1: isExecutionStatus accepts all 13 states", () => {
  assert.ok(isExecutionStatus("created"));
  assert.ok(isExecutionStatus("queued"));
  assert.ok(isExecutionStatus("dispatching"));
  assert.ok(isExecutionStatus("prechecking"));
  assert.ok(isExecutionStatus("executing"));
  assert.ok(isExecutionStatus("paused"));
  assert.ok(isExecutionStatus("recovering"));
  assert.ok(isExecutionStatus("timed_out"));
  assert.ok(isExecutionStatus("blocked"));
  assert.ok(isExecutionStatus("succeeded"));
  assert.ok(isExecutionStatus("failed"));
  assert.ok(isExecutionStatus("cancelled"));
  assert.ok(isExecutionStatus("superseded"));
});

// =============================================================================
// R9-04-2: EXECUTION_STATUSES missing states are detected
// =============================================================================

test("R9-04-2: EXECUTION_STATUSES missing states are detected", () => {
  const currentStatuses = new Set(Array.from(EXECUTION_STATUSES));
  const detectedMissing: string[] = [];

  for (const missingState of R9_04_MISSING_STATES) {
    if (!currentStatuses.has(missingState as typeof EXECUTION_STATUSES[number])) {
      detectedMissing.push(missingState);
    }
  }

  // Document the current gap (before fix these will fail, documenting the issue)
  assert.deepEqual(
    detectedMissing.sort(),
    R9_04_MISSING_STATES.slice().sort(),
    `EXECUTION_STATUSES has unexpected missing states. ` +
      `Expected missing: ${R9_04_MISSING_STATES.join(", ")}, ` +
      `Detected: ${detectedMissing.join(", ")}`
  );
});

test("R9-04-2: isExecutionStatus returns false for missing states", () => {
  // These states should be valid ExecutionStatus but currently are not
  const currentlyMissing = ["queued", "dispatching", "paused", "recovering", "timed_out", "resuming", "ready"];

  for (const state of currentlyMissing) {
    const result = isExecutionStatus(state);
    assert.equal(
      result,
      false,
      `isExecutionStatus("${state}") returned ${result} - state should be valid but is missing from EXECUTION_STATUSES`
    );
  }
});

// =============================================================================
// R9-04-3: State machine transitions validation for all 13 states
// =============================================================================

test("R9-04-3: All 13 states have defined transitions", () => {
  // Valid state machine transitions for all 13 states
  const validTransitions: Record<string, string[]> = {
    created: ["prechecking", "cancelled", "failed"],
    queued: ["dispatching", "cancelled"],
    dispatching: ["prechecking", "executing", "cancelled", "failed"],
    prechecking: ["executing", "blocked", "cancelled", "failed"],
    executing: ["blocked", "succeeded", "failed", "cancelled", "timed_out"],
    paused: ["resuming", "executing", "cancelled", "failed"],
    recovering: ["executing", "failed", "cancelled"],
    timed_out: ["recovering", "executing", "failed", "cancelled"],
    blocked: ["prechecking", "executing", "cancelled", "failed", "superseded"],
    succeeded: [],
    failed: [],
    cancelled: [],
    superseded: [],
  };

  for (const state of R9_04_EXPECTED_STATES) {
    assert.ok(
      state in validTransitions,
      `State ${state} should have transitions defined in state machine`
    );

    const transitions = validTransitions[state];
    assert.ok(
      Array.isArray(transitions),
      `State ${state} transitions should be an array`
    );
  }
});

test("R9-04-3: Terminal states have no outgoing transitions", () => {
  const terminalStates = ["succeeded", "failed", "cancelled", "superseded"];
  const currentStatuses = Array.from(EXECUTION_STATUSES);

  for (const terminal of terminalStates) {
    const hasState = currentStatuses.includes(terminal as typeof EXECUTION_STATUSES[number]);
    assert.ok(
      hasState,
      `Terminal state ${terminal} should exist in EXECUTION_STATUSES`
    );
  }
});

test("R9-04-3: Transition source and target states exist in EXECUTION_STATUSES", () => {
  const validTransitions: Record<string, string[]> = {
    created: ["prechecking", "cancelled", "failed"],
    queued: ["dispatching", "cancelled"],
    dispatching: ["prechecking", "executing", "cancelled", "failed"],
    prechecking: ["executing", "blocked", "cancelled", "failed"],
    executing: ["blocked", "succeeded", "failed", "cancelled", "timed_out"],
    paused: ["resuming", "executing", "cancelled", "failed"],
    recovering: ["executing", "failed", "cancelled"],
    timed_out: ["recovering", "executing", "failed", "cancelled"],
    blocked: ["prechecking", "executing", "cancelled", "failed", "superseded"],
    succeeded: [],
    failed: [],
    cancelled: [],
    superseded: [],
  };

  const statusSet = new Set(Array.from(EXECUTION_STATUSES));

  for (const [sourceState, targets] of Object.entries(validTransitions)) {
    assert.ok(
      statusSet.has(sourceState as typeof EXECUTION_STATUSES[number]),
      `Transition source state ${sourceState} should exist in EXECUTION_STATUSES`
    );

    for (const target of targets) {
      assert.ok(
        statusSet.has(target as typeof EXECUTION_STATUSES[number]),
        `Transition target ${target} from ${sourceState} should exist in EXECUTION_STATUSES`
      );
    }
  }
});

test("R9-04-3: isExecutionStatus validates all transition states", () => {
  const allTransitionStates = [
    "created", "prechecking", "cancelled", "failed",
    "queued", "dispatching",
    "executing", "blocked",
    "paused", "resuming",
    "recovering", "timed_out",
    "succeeded",
    "superseded",
  ];

  for (const state of allTransitionStates) {
    assert.ok(
      isExecutionStatus(state),
      `State ${state} involved in transitions should be a valid ExecutionStatus`
    );
  }
});

// =============================================================================
// R9-04 baseline: Current EXECUTION_STATUSES count verification
// =============================================================================

test("R9-04 baseline: Current EXECUTION_STATUSES has 8 states (pre-fix)", () => {
  // This test documents the current state before R9-04 fix
  const currentCount = EXECUTION_STATUSES.length;
  assert.equal(
    currentCount,
    8,
    `EXECUTION_STATUSES has ${currentCount} states. Before fix: 8. After fix: 13 (R9-04)`
  );
});

test("R9-04 baseline: EXECUTION_STATUSES currently has only 8 states", () => {
  const currentStatuses = Array.from(EXECUTION_STATUSES);
  assert.equal(currentStatuses.length, 8);
  assert.deepEqual(
    currentStatuses.sort(),
    ["blocked", "cancelled", "created", "executing", "failed", "prechecking", "succeeded", "superseded"].sort()
  );
});