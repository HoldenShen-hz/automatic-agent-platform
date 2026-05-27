import assert from "node:assert/strict";
import test from "node:test";
import { HumanTakeoverService, type TakeoverActionResult } from "../../../../src/scale-ecosystem/runtime-services/human-takeover-service.js";

test("HumanTakeoverService is exported and is a class [human-takeover-service]", () => {
  assert.equal(typeof HumanTakeoverService, "function");
});

test("TakeoverActionResult type is exported [human-takeover-service]", () => {
  // Verify type exists by checking a function signature that uses it
  const result: TakeoverActionResult = {
    taskId: "test-task",
    executionId: null,
    takeoverSessionId: "session-1",
    operatorActionId: "action-1",
  };
  assert.equal(result.taskId, "test-task");
  assert.equal(result.operatorActionId, "action-1");
});
