import test from "node:test";
import assert from "node:assert/strict";
import type { HarnessRuntimeService as HarnessRuntimeServiceType } from "../../../../../src/platform/five-plane-orchestration/harness/runtime/index.js";

type HarnessRuntimeReExport = HarnessRuntimeServiceType;
void (null as unknown as HarnessRuntimeReExport);

/**
 * Tests for src/platform/five-plane-orchestration/harness/runtime/index.ts
 *
 * This module is a re-export barrel that exposes HarnessRuntimeService
 * from the parent harness index. The actual implementation and all
 * comprehensive tests live in index.test.ts.
 *
 * This file provides minimal smoke tests for the re-export path.
 */

test("HarnessRuntimeService is re-exported from runtime/index.ts - implementation tested in index.test.ts", async () => {
  const runtimeIndex = await import("../../../../../src/platform/five-plane-orchestration/harness/runtime/index.js");
  assert.ok("HarnessRuntimeService" in runtimeIndex);
});

test("Runtime module exports match parent harness exports - verified by build", async () => {
  const runtimeIndex = await import("../../../../../src/platform/five-plane-orchestration/harness/runtime/index.js");
  const harnessIndex = await import("../../../../../src/platform/five-plane-orchestration/harness/index.js");
  assert.equal(runtimeIndex.HarnessRuntimeService, harnessIndex.HarnessRuntimeService);
});

test("HarnessRuntimeService can be imported via runtime/index.ts re-export path", async () => {
  // This test verifies the ESM import chain works correctly
  const runtimeIndex = await import("../../../../../src/platform/five-plane-orchestration/harness/runtime/index.js");
  assert.ok(runtimeIndex.HarnessRuntimeService !== undefined, "HarnessRuntimeService should be exported");
  assert.equal(typeof runtimeIndex.HarnessRuntimeService, "function", "HarnessRuntimeService should be a constructor");
});

test("HarnessRuntimeService from runtime/index is the same class as from harness index", async () => {
  const { HarnessRuntimeService: FromRuntime } = await import("../../../../../src/platform/five-plane-orchestration/harness/runtime/index.js");
  const { HarnessRuntimeService: FromIndex } = await import("../../../../../src/platform/five-plane-orchestration/harness/index.js");

  // Both imports should reference the same class constructor
  assert.equal(FromRuntime, FromIndex, "Re-exported class should be identical to original");
});

test("HarnessRuntimeService instances created via runtime/index export work correctly", async () => {
  const { HarnessRuntimeService } = await import("../../../../../src/platform/five-plane-orchestration/harness/runtime/index.js");
  const service = new HarnessRuntimeService();

  // Verify the instance has expected methods from the harness runtime service
  assert.equal(typeof service.createRun, "function", "should have createRun method");
  assert.equal(typeof service.runLoop, "function", "should have runLoop method");
  assert.equal(typeof service.decide, "function", "should have decide method");
  assert.equal(typeof service.sleep, "function", "should have sleep method");
  assert.equal(typeof service.recover, "function", "should have recover method");
  assert.equal(typeof service.resume, "function", "should have resume method");
  assert.equal(typeof service.appendStep, "function", "should have appendStep method");
  assert.equal(typeof service.listTimeline, "function", "should have listTimeline method");
  assert.equal(typeof service.writeMemory, "function", "should have writeMemory method");
  assert.equal(typeof service.readMemory, "function", "should have readMemory method");
  assert.equal(typeof service.assertInvariants, "function", "should have assertInvariants method");
  assert.equal(typeof service.evaluateRun, "function", "should have evaluateRun method");
  assert.equal(typeof service.persistRun, "function", "should have persistRun method");
  assert.equal(typeof service.checkpointRun, "function", "should have checkpointRun method");
  assert.equal(typeof service.restoreRun, "function", "should have restoreRun method");
  assert.equal(typeof service.handleFailure, "function", "should have handleFailure method");
});
