/**
 * Integration tests for Core Runtime planner barrel module
 *
 * Tests the full re-export chain from core/runtime/planner/index.ts
 * which delegates to platform/execution/execution-engine/multi-step-*.js modules
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  executeAgentRoundLoop,
  buildStepOutput,
  resolveMultiStepToolPath,
} from "../../../../../../src/core/runtime/planner/index.js";

test("planner barrel exports executeAgentRoundLoop function", () => {
  assert.ok(typeof executeAgentRoundLoop === "function", "executeAgentRoundLoop should be a function");
});

test("planner barrel exports buildStepOutput function", () => {
  assert.ok(typeof buildStepOutput === "function", "buildStepOutput should be a function");
});

test("planner barrel exports resolveMultiStepToolPath function", () => {
  assert.ok(typeof resolveMultiStepToolPath === "function", "resolveMultiStepToolPath should be a function");
});

test("planner barrel module re-exports from multi-step-agent-round-loop", async () => {
  const mod = await import("../../../../../../src/core/runtime/planner/index.js");
  assert.ok("executeAgentRoundLoop" in mod, "Should re-export executeAgentRoundLoop");
  assert.ok("buildStepOutput" in mod, "Should re-export buildStepOutput");
});

test("planner barrel module re-exports from multi-step-utils", async () => {
  const mod = await import("../../../../../../src/core/runtime/planner/index.js");
  assert.ok("resolveMultiStepToolPath" in mod, "Should re-export resolveMultiStepToolPath");
});

test("planner resolveMultiStepToolPath validates paths", () => {
  const rootPath = "/workspace";
  // Valid path should work
  const valid = resolveMultiStepToolPath(rootPath, "subdir/file.txt");
  assert.ok(valid.startsWith(rootPath));
});

test("planner resolveMultiStepToolPath rejects paths outside workspace", () => {
  const rootPath = "/workspace";
  assert.throws(
    () => resolveMultiStepToolPath(rootPath, "/etc/passwd"),
    /path_outside_workspace/,
  );
});

test("planner barrel exports parseOptionalPositiveInteger", async () => {
  const mod = await import("../../../../../../src/core/runtime/planner/index.js");
  assert.ok("parseOptionalPositiveInteger" in mod, "Should re-export parseOptionalPositiveInteger");
});

test("planner barrel exports safeParseToolResult", async () => {
  const mod = await import("../../../../../../src/core/runtime/planner/index.js");
  assert.ok("safeParseToolResult" in mod, "Should re-export safeParseToolResult");
});
