import assert from "node:assert/strict";
import test from "node:test";

import {
  workflowRunProjectionHandler,
  type WorkflowRunState,
} from "../../../../../../src/platform/state-evidence/events/projections/workflow-run-projection.js";
import type { ProjectionInputEvent } from "../../../../../../src/platform/state-evidence/projections/projection-rebuild-service.js";

function makeEvent(
  eventId: string,
  eventType: string,
  payloadJson: string,
  createdAt: string,
): ProjectionInputEvent {
  return {
    eventId,
    eventType,
    taskId: "task-1",
    payloadJson,
    createdAt,
  };
}

test("subtask:failed records failed step without immediately failing workflow", () => {
  const subtaskFailed = makeEvent(
    "evt_subtask_failed",
    "subtask:failed",
    '{"stepId":"step-1","reasonCode":"worker_error"}',
    "2026-05-01T00:00:00.000Z",
  );

  const afterSubtask = workflowRunProjectionHandler(null, subtaskFailed) as unknown as WorkflowRunState;

  assert.equal(afterSubtask.status, "pending");
  assert.deepEqual(afterSubtask.failedSteps, ["step-1"]);
  assert.equal(afterSubtask.error?.code, "worker_error");

  const workflowFailed = makeEvent(
    "evt_task_failed",
    "task:status_changed",
    '{"fromStatus":"running","toStatus":"failed","reasonCode":"workflow_failed"}',
    "2026-05-01T00:01:00.000Z",
  );

  const afterWorkflowFailure = workflowRunProjectionHandler(
    afterSubtask as unknown as Record<string, unknown>,
    workflowFailed,
  ) as unknown as WorkflowRunState;

  assert.equal(afterWorkflowFailure.status, "failed");
  assert.equal(afterWorkflowFailure.failedAt, "2026-05-01T00:01:00.000Z");
});
