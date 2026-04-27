/**
 * Unit Tests: Phase1B Orchestration
 *
 * Tests for Phase1B aliases in phase1b-orchestration.ts:
 * - runPhase1BOrchestration (alias for runSingleTaskExecution)
 * - HappyPathInput type
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  runSingleTaskExecution,
  type HappyPathInput,
} from "../../../../../src/platform/execution/execution-engine/single-task-happy-path.js";
import {
  runPhase1BOrchestration,
} from "../../../../../src/platform/execution/execution-engine/phase1b-orchestration.js";

// =============================================================================
// runPhase1BOrchestration alias tests
// =============================================================================

test("runPhase1BOrchestration is identical to runSingleTaskExecution", () => {
  assert.strictEqual(runPhase1BOrchestration, runSingleTaskExecution);
});

test("runPhase1BOrchestration is a function", () => {
  assert.equal(typeof runPhase1BOrchestration, "function");
});

// =============================================================================
// HappyPathInput type re-export tests
// =============================================================================

test("HappyPathInput type is exported from phase1b-orchestration", () => {
  // Verify the type can be used in type annotations
  const input: HappyPathInput = {
    dbPath: "/tmp/test.db",
    title: "Test",
    request: "Test request",
  };

  assert.equal(input.title, "Test");
  assert.equal(input.request, "Test request");
});

test("HappyPathInput type structure is correct", () => {
  const input: HappyPathInput = {
    dbPath: "/tmp/test.db",
    title: "Phase1B Test Task",
    request: "Test request for Phase1B",
    stepOutputOverride: {
      summary: "Override summary",
      result: "Override result",
    },
  };

  assert.ok(input.stepOutputOverride);
  assert.equal(input.stepOutputOverride.summary, "Override summary");
  assert.equal(input.stepOutputOverride.result, "Override result");
});

test("HappyPathInput has all required fields", () => {
  const input: HappyPathInput = {
    dbPath: "/tmp/test.db",
    title: "Required Fields Test",
    request: "Request text",
  };

  assert.ok(typeof input.dbPath === "string");
  assert.ok(typeof input.title === "string");
  assert.ok(typeof input.request === "string");
});