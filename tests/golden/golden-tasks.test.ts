import test from "node:test";
import assert from "node:assert/strict";

import {
  SINGLE_TASK_GOLDEN_TASKS,
  buildGoldenTaskInventoryBaseline,
  runGoldenTaskCase,
} from "../../src/platform/shared/stability/golden-task-runner.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";

test("single-task golden task suite stays stable", async () => {
  const workspace = createTempWorkspace("aa-golden-");

  try {
    const results = await Promise.all(
      SINGLE_TASK_GOLDEN_TASKS.map((testCase) =>
        runGoldenTaskCase(workspace, testCase),
      ),
    );
    const inventory = buildGoldenTaskInventoryBaseline();

    // R10-40 fix: Use dynamic length instead of hardcoded value
    assert.equal(results.length, SINGLE_TASK_GOLDEN_TASKS.length);
    assert.equal(results.length, SINGLE_TASK_GOLDEN_TASKS.length);
    assert.ok(results.every((result) => result.passed));
    assert.deepEqual(inventory.missingRequiredClasses, []);
    assert.equal(inventory.totalCases, SINGLE_TASK_GOLDEN_TASKS.length);
  } finally {
    cleanupPath(workspace);
  }
});
