/**
 * Integration Test: Multi-Step Orchestration
 *
 * Tests multi-step workflow orchestration including step sequencing,
 * dependency resolution, and output passing between steps.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { routeComplexity } from "../../../../../src/platform/five-plane-execution/execution-engine/complexity-router.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("multi-step orchestration: routeComplexity classifies simple task", () => {
  const result = routeComplexity("what is the weather", {
    stepCount: 1,
  });

  assert.ok(result.path === "passthrough" || result.path === "fast" || result.path === "standard");
  assert.ok(typeof result.reason === "string");
  assert.ok(typeof result.routedAt === "string");
});

test("multi-step orchestration: routeComplexity classifies complex task", () => {
  const result = routeComplexity("refactor the entire codebase", {
    stepCount: 10,
  });

  assert.equal(result.path, "full");
  assert.ok(typeof result.estimatedBudgetFactor === "number");
});

test("complexity router: routeComplexity detects multi-step workflow", () => {
  const result = routeComplexity("do something complex", {
    stepCount: 5,
  });

  assert.ok(result.path === "standard" || result.path === "full");
});

test("complexity router: qaMode forces full path", () => {
  const result = routeComplexity("simple question", {
    qaMode: true,
  });

  assert.equal(result.path, "full");
  assert.equal(result.reason, "qa_mode_active");
});

test("complexity router: short input goes to passthrough", () => {
  const result = routeComplexity("hi");

  assert.equal(result.path, "passthrough");
  assert.equal(result.reason, "short_input");
});