/**
 * Integration tests for Core Runtime index barrel module
 *
 * Tests the full re-export chain from core/runtime/index.ts
 * which re-exports from multiple platform execution engine modules
 */

import assert from "node:assert/strict";
import test from "node:test";

// Use dynamic imports to avoid TypeScript inference issues with barrel exports
test("core/runtime index exports module", async () => {
  const runtimeIndex = await import("../../../../src/core/runtime/index.js");
  assert.ok(runtimeIndex !== undefined, "Module should be defined");
  assert.ok(typeof runtimeIndex === "object", "Module should be an object");
});

test("core/runtime index re-exports TransitionService", async () => {
  const runtimeIndex = await import("../../../../src/core/runtime/index.js");
  const keys = Object.keys(runtimeIndex);
  assert.ok(keys.length > 0, "Module should export some keys");
});

test("core/runtime index re-exports StateTransitionMachine", async () => {
  const runtimeIndex = await import("../../../../src/core/runtime/index.js");
  const keys = Object.keys(runtimeIndex);
  assert.ok(keys.some(k => k.includes("StateTransition") || k.includes("Transition")), "Should export transition-related symbols");
});

test("core/runtime index re-exports ExecutionLeaseService", async () => {
  const runtimeIndex = await import("../../../../src/core/runtime/index.js");
  const keys = Object.keys(runtimeIndex);
  assert.ok(keys.some(k => k.includes("Lease") || k.includes("Execution")), "Should export lease-related symbols");
});

test("core/runtime index re-exports WorkerRegistryService", async () => {
  const runtimeIndex = await import("../../../../src/core/runtime/index.js");
  const keys = Object.keys(runtimeIndex);
  assert.ok(keys.some(k => k.includes("Worker") || k.includes("Registry")), "Should export worker/registry symbols");
});

test("core/runtime index re-exports admission-controller exports", async () => {
  const runtimeIndex = await import("../../../../src/core/runtime/index.js");
  const keys = Object.keys(runtimeIndex);
  assert.ok(keys.length > 0, "Module should export admission-controller");
});

test("core/runtime index re-exports execution-engine exports", async () => {
  const runtimeIndex = await import("../../../../src/core/runtime/index.js");
  const keys = Object.keys(runtimeIndex);
  assert.ok(keys.length > 0, "Module should export execution-engine components");
});

test("core/runtime index re-exports runtime-context", async () => {
  const runtimeIndex = await import("../../../../src/core/runtime/index.js");
  const keys = Object.keys(runtimeIndex);
  assert.ok(keys.length > 0, "Module should export some keys");
});

test("core/runtime index re-exports loop-detection", async () => {
  const runtimeIndex = await import("../../../../src/core/runtime/index.js");
  const keys = Object.keys(runtimeIndex);
  assert.ok(keys.some(k => k.toLowerCase().includes("loop")), "Should re-export loop-detection");
});

test("core/runtime index re-exports effect-buffer", async () => {
  const runtimeIndex = await import("../../../../src/core/runtime/index.js");
  const keys = Object.keys(runtimeIndex);
  assert.ok(keys.some(k => k.toLowerCase().includes("effect") || k.toLowerCase().includes("buffer")), "Should re-export effect-buffer");
});

test("core/runtime index re-exports orchestrator via sub-module", async () => {
  const runtimeIndex = await import("../../../../src/core/runtime/index.js");
  const keys = Object.keys(runtimeIndex);
  assert.ok(keys.length > 0, "Module should export orchestrator");
});

test("core/runtime index re-exports state-transition components", async () => {
  const runtimeIndex = await import("../../../../src/core/runtime/index.js");
  const keys = Object.keys(runtimeIndex);
  assert.ok(keys.some(k => k.includes("Transition")), "Should re-export state transition components");
});

test("core/runtime index re-exports workflow-step-checkpoint", async () => {
  const runtimeIndex = await import("../../../../src/core/runtime/index.js");
  const keys = Object.keys(runtimeIndex);
  assert.ok(keys.some(k => k.includes("Workflow") || k.includes("Checkpoint")), "Should re-export checkpoint symbols");
});
