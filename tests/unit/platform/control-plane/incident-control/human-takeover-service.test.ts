import assert from "node:assert/strict";
import test from "node:test";

import type {
  TakeoverActionResult,
} from "../../../../../src/platform/control-plane/incident-control/human-takeover-service.js";

test("TakeoverActionResult structure is correct", () => {
  const result: TakeoverActionResult = {
    taskId: "task_123",
    executionId: "exec_456",
    takeoverSessionId: "session_789",
    operatorActionId: "action_abc",
  };
  assert.equal(result.taskId, "task_123");
  assert.equal(result.executionId, "exec_456");
  assert.equal(result.takeoverSessionId, "session_789");
  assert.equal(result.operatorActionId, "action_abc");
});

test("TakeoverActionResult with null executionId", () => {
  const result: TakeoverActionResult = {
    taskId: "task_123",
    executionId: null,
    takeoverSessionId: "session_789",
    operatorActionId: "action_abc",
  };
  assert.equal(result.executionId, null);
});

test("TakeoverActionResult type can be used in arrays", () => {
  const results: TakeoverActionResult[] = [
    {
      taskId: "task_1",
      executionId: "exec_1",
      takeoverSessionId: "sess_1",
      operatorActionId: "act_1",
    },
    {
      taskId: "task_2",
      executionId: null,
      takeoverSessionId: "sess_2",
      operatorActionId: "act_2",
    },
  ];
  assert.equal(results.length, 2);
  assert.equal(results[0]?.taskId, "task_1");
  assert.equal(results[1]?.executionId, null);
});