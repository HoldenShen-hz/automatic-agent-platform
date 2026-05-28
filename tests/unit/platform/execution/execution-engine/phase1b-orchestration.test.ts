/**
 * Unit Tests: Multi-step orchestration entrypoint
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  runMultiStepOrchestration,
  type MultiStepToolExecutionInput,
} from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";

// =============================================================================
// runPhase1BOrchestration alias tests
// =============================================================================

test("runMultiStepOrchestration is a function [phase1b-orchestration]", () => {
  assert.equal(typeof runMultiStepOrchestration, "function");
});

// =============================================================================
// HappyPathInput type re-export tests
// =============================================================================

test("MultiStepToolExecutionInput uses canonical orchestration input shape [phase1b-orchestration]", () => {
  const input: MultiStepToolExecutionInput = {
    dbPath: "/tmp/task-1.db",
    title: "task-1",
    request: "web_search",
  };

  assert.equal(input.title, "task-1");
  assert.equal(input.request, "web_search");
});

test("MultiStepToolExecutionInput type structure is correct [phase1b-orchestration]", () => {
  const input: MultiStepToolExecutionInput = {
    dbPath: "/tmp/task-2.db",
    title: "task-2",
    request: "git status",
    taskId: "task-2",
  };

  assert.equal(input.taskId, "task-2");
  assert.equal(input.request, "git status");
});

test("MultiStepToolExecutionInput has all required fields [phase1b-orchestration]", () => {
  const input: MultiStepToolExecutionInput = {
    dbPath: "/tmp/task-3.db",
    title: "task-3",
    request: "Need approval?",
  };

  assert.ok(typeof input.dbPath === "string");
  assert.ok(typeof input.title === "string");
  assert.ok(typeof input.request === "string");
});
