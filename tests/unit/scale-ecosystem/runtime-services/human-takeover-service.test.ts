import assert from "node:assert/strict";
import test from "node:test";
import { HumanTakeoverService, type TakeoverActionResult } from "../../../../src/scale-ecosystem/runtime-services/human-takeover-service.js";

test("HumanTakeoverService is exported and is a class", () => {
  assert.equal(typeof HumanTakeoverService, "function");
});

test("TakeoverActionResult type is exported", () => {
  // Verify type exists by checking a function signature that uses it
  const result: TakeoverActionResult = {
    action: "completed",
    taskId: "test-task",
    takeoverCompletedAt: new Date().toISOString(),
  };
  assert.equal(result.action, "completed");
  assert.equal(result.taskId, "test-task");
});
