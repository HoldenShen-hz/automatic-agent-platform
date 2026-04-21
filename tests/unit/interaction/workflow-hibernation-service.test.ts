import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowHibernationService } from "../../../src/interaction/workflow-hibernation-service.js";

test("WorkflowHibernationService defaults to 7-day TTL and clamps to 30 days max", () => {
  const service = new WorkflowHibernationService();
  const record = service.hibernate("wf-1", "task-1", 24 * 60, "2026-04-01T00:00:00.000Z");
  assert.equal(record.expiresAt, "2026-05-01T00:00:00.000Z");
});

test("WorkflowHibernationService emits still_hibernated heartbeat every 24 hours when due", () => {
  const service = new WorkflowHibernationService();
  service.hibernate("wf-2", "task-2", 24 * 7, "2026-04-01T00:00:00.000Z");

  const events = service.emitDueStillHibernatedEvents("2026-04-02T01:00:00.000Z");
  assert.equal(events.length, 1);
  assert.equal(events[0]!.eventType, "still_hibernated");
  assert.equal(service.getRecord("wf-2")?.heartbeatEvents.length, 1);
});
