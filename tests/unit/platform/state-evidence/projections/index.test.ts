import assert from "node:assert/strict";
import test from "node:test";

import { EventProjectionService } from "../../../../../src/platform/state-evidence/projections/index.js";

test("EventProjectionService creates and updates workflow projections from events", () => {
  const service = new EventProjectionService();
  const created = service.applyEvent({
    eventId: "evt_1",
    eventType: "workflow:planned",
    taskId: "task_1",
    payloadJson: JSON.stringify({ workflowId: "wf_1" }),
    createdAt: "2026-04-20T00:00:00.000Z",
  });
  const updated = service.applyEvent({
    eventId: "evt_2",
    eventType: "workflow:step_completed",
    taskId: "task_1",
    payloadJson: JSON.stringify({ stepId: "step_1" }),
    createdAt: "2026-04-20T00:01:00.000Z",
  });

  assert.equal(created.projectionName, "workflow_summary");
  assert.equal(updated.entityRef, "task_1");
  assert.equal(service.getProjection("workflow_summary", "task_1")?.sourceEventId, "evt_2");
});
