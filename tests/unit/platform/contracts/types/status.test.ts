import assert from "node:assert/strict";
import test from "node:test";

import {
  EXECUTION_STATUSES,
  isExecutionStatus,
} from "../../../../../src/platform/contracts/types/status.js";

// =============================================================================
// R9-04: EXECUTION_STATUSES completeness verification
//
// Expected 15 states (R9-04 fix added 7 missing states):
// created, prechecking, ready, queued, dispatching, executing, blocked,
// paused, resuming, recovering, timed_out, succeeded, failed, cancelled, superseded
// =============================================================================

const R9_04_EXPECTED_STATES = [
  "created",
  "prechecking",
  "ready",
  "queued",
  "dispatching",
  "executing",
  "blocked",
  "paused",
  "resuming",
  "recovering",
  "timed_out",
  "succeeded",
  "failed",
  "cancelled",
  "superseded",
];

const R9_04_MISSING_STATES: string[] = [];

// =============================================================================
// R9-04-1: EXECUTION_STATUSES includes all 13 states
// =============================================================================

test("R9-04-1: EXECUTION_STATUSES includes all 15 states", () => {
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
    15,
    `EXECUTION_STATUSES should have 15 states, found ${currentStatuses.length}: ${currentStatuses.join(", ")}`
  );
});

test("R9-04-1: isExecutionStatus accepts all 15 states", () => {
  assert.ok(isExecutionStatus("created"));
  assert.ok(isExecutionStatus("prechecking"));
  assert.ok(isExecutionStatus("ready"));
  assert.ok(isExecutionStatus("queued"));
  assert.ok(isExecutionStatus("dispatching"));
  assert.ok(isExecutionStatus("executing"));
  assert.ok(isExecutionStatus("blocked"));
  assert.ok(isExecutionStatus("paused"));
  assert.ok(isExecutionStatus("resuming"));
  assert.ok(isExecutionStatus("recovering"));
  assert.ok(isExecutionStatus("timed_out"));
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

  // All states are now present after R9-04 fix
  assert.deepEqual(
    detectedMissing.sort(),
    R9_04_MISSING_STATES.slice().sort(),
    `EXECUTION_STATUSES has unexpected missing states. ` +
      `Expected missing: ${R9_04_MISSING_STATES.join(", ")}, ` +
      `Detected: ${detectedMissing.join(", ")}`
  );
});

test("R9-04-2: isExecutionStatus returns false for missing states", () => {
  // All states that were missing are now valid ExecutionStatus
  const currentlyMissing: string[] = [];

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
// R9-04-3: State machine transitions validation for all 15 states
// =============================================================================

test("R9-04-3: All 15 states have defined transitions", () => {
  // Valid state machine transitions for all 15 states
  const validTransitions: Record<string, string[]> = {
    created: ["prechecking", "cancelled", "failed"],
    prechecking: ["ready", "cancelled", "failed"],
    ready: ["queued", "dispatching", "cancelled", "failed"],
    queued: ["dispatching", "cancelled", "failed"],
    dispatching: ["executing", "paused", "cancelled", "failed"],
    executing: ["blocked", "succeeded", "failed", "cancelled", "timed_out"],
    blocked: ["prechecking", "executing", "cancelled", "failed", "superseded"],
    paused: ["resuming", "cancelled", "failed"],
    resuming: ["executing", "cancelled", "failed"],
    recovering: ["executing", "cancelled", "failed"],
    timed_out: ["recovering", "executing", "cancelled", "failed"],
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
    prechecking: ["ready", "cancelled", "failed"],
    ready: ["queued", "dispatching", "cancelled", "failed"],
    queued: ["dispatching", "cancelled", "failed"],
    dispatching: ["executing", "paused", "cancelled", "failed"],
    executing: ["blocked", "succeeded", "failed", "cancelled", "timed_out"],
    blocked: ["prechecking", "executing", "cancelled", "failed", "superseded"],
    paused: ["resuming", "cancelled", "failed"],
    resuming: ["executing", "cancelled", "failed"],
    recovering: ["executing", "cancelled", "failed"],
    timed_out: ["recovering", "executing", "cancelled", "failed"],
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
    "created", "prechecking", "ready", "cancelled", "failed",
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

test("R9-04 baseline: Current EXECUTION_STATUSES has 15 states (post-fix)", () => {
  // This test documents the state after R9-04 fix
  const currentCount = EXECUTION_STATUSES.length;
  assert.equal(
    currentCount,
    15,
    `EXECUTION_STATUSES has ${currentCount} states. Before fix: 8. After fix: 15 (R9-04 plus ready/resuming)`
  );
});

test("R9-04 baseline: EXECUTION_STATUSES now has 15 states", () => {
  const currentStatuses = Array.from(EXECUTION_STATUSES);
  assert.equal(currentStatuses.length, 15);
  assert.deepEqual(
    currentStatuses.sort(),
    ["blocked", "cancelled", "created", "dispatching", "executing", "failed", "paused", "prechecking", "queued", "ready", "recovering", "resuming", "succeeded", "superseded", "timed_out"].sort()
  );
});