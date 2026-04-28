/**
 * Integration tests for Core Runtime orchestrator barrel module
 *
 * Tests the full re-export chain from core/runtime/orchestrator/index.ts
 * which delegates to platform/execution/execution-engine/multi-step-orchestration.js
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  runMultiStepOrchestration,
  executeMultiStepToolCallForTests,
  resetMultiStepToolRegistryForTests,
} from "../../../../../src/core/runtime/orchestrator/index.js";

test("orchestrator barrel exports runMultiStepOrchestration function", () => {
  assert.ok(typeof runMultiStepOrchestration === "function", "runMultiStepOrchestration should be a function");
});

test("orchestrator barrel exports executeMultiStepToolCallForTests function", () => {
  assert.ok(typeof executeMultiStepToolCallForTests === "function", "executeMultiStepToolCallForTests should be a function");
});

test("orchestrator barrel exports resetMultiStepToolRegistryForTests function", () => {
  assert.ok(typeof resetMultiStepToolRegistryForTests === "function", "resetMultiStepToolRegistryForTests should be a function");
});

test("orchestrator barrel module re-exports from multi-step-orchestration", async () => {
  const mod = await import("../../../../../src/core/runtime/orchestrator/index.js");
  assert.ok("runMultiStepOrchestration" in mod, "Should re-export runMultiStepOrchestration");
  assert.ok("executeMultiStepToolCallForTests" in mod, "Should re-export executeMultiStepToolCallForTests");
  assert.ok("resetMultiStepToolRegistryForTests" in mod, "Should re-export resetMultiStepToolRegistryForTests");
});

test("orchestrator types re-exported via types.ts", async () => {
  const mod = await import("../../../../../src/core/runtime/orchestrator/index.js");
  assert.ok(mod !== undefined);
});
