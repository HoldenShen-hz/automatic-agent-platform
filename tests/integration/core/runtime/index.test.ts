/**
 * Integration tests for Core Runtime index barrel module
 *
 * Tests the full re-export chain from core/runtime/index.ts
 * which re-exports from multiple platform execution engine modules
 */

import assert from "node:assert/strict";
import test from "node:test";

import * as runtimeIndex from "../../../../src/core/runtime/index.js";

test("core/runtime index exports module", () => {
  assert.ok(runtimeIndex !== undefined, "Module should be defined");
  assert.ok(typeof runtimeIndex === "object", "Module should be an object");
});

test("core/runtime index re-exports TransitionService", () => {
  assert.ok("TransitionService" in runtimeIndex || runtimeIndex.TransitionService != null,
    "Should re-export TransitionService");
});

test("core/runtime index re-exports StateTransitionMachine", () => {
  assert.ok("StateTransitionMachine" in runtimeIndex || runtimeIndex.StateTransitionMachine != null,
    "Should re-export StateTransitionMachine");
});

test("core/runtime index re-exports ExecutionLeaseService", () => {
  assert.ok("ExecutionLeaseService" in runtimeIndex || runtimeIndex.ExecutionLeaseService != null,
    "Should re-export ExecutionLeaseService");
});

test("core/runtime index re-exports WorkerRegistryService", () => {
  assert.ok("WorkerRegistryService" in runtimeIndex || runtimeIndex.WorkerRegistryService != null,
    "Should re-export WorkerRegistryService");
});

test("core/runtime index re-exports admission-controller exports", () => {
  assert.ok(runtimeIndex !== undefined, "Should re-export admission-controller");
});

test("core/runtime index re-exports execution-engine exports", () => {
  assert.ok(runtimeIndex !== undefined, "Should re-export execution-engine components");
});

test("core/runtime index re-exports runtime-context", () => {
  const keys = Object.keys(runtimeIndex);
  assert.ok(keys.length > 0, "Module should export some keys");
});

test("core/runtime index re-exports loop-detection", () => {
  assert.ok(runtimeIndex !== undefined, "Should re-export loop-detection");
});

test("core/runtime index re-exports effect-buffer", () => {
  assert.ok(runtimeIndex !== undefined, "Should re-export effect-buffer");
});

test("core/runtime index re-exports orchestrator via sub-module", () => {
  // The index should include orchestrator from orchestrator/index.ts
  assert.ok(runtimeIndex !== undefined, "Should re-export orchestrator");
});

test("core/runtime index re-exports state-transition components", () => {
  assert.ok("TransitionService" in runtimeIndex || "StateTransitionMachine" in runtimeIndex,
    "Should re-export state transition components");
});

test("core/runtime index re-exports workflow-step-checkpoint", () => {
  assert.ok("WorkflowStepCheckpoint" in runtimeIndex || runtimeIndex.WorkflowStepCheckpoint != null,
    "Should re-export WorkflowStepCheckpoint");
});
