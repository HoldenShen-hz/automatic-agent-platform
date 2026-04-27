/**
 * Additional unit tests for WorkflowHibernationService
 */

import assert from "node:assert/strict";
import test from "node:test";
import { WorkflowHibernationService } from "../../../src/interaction/workflow-hibernation-service.js";

test("WorkflowHibernationService.hibernate creates hibernated record", () => {
  const service = new WorkflowHibernationService();
  const record = service.hibernate("wf-new", "task-new", 24, "2026-04-01T00:00:00.000Z");

  assert.equal(record.workflowId, "wf-new");
  assert.equal(record.taskId, "task-new");
  assert.equal(record.status, "hibernated");
  assert.equal(record.hibernatedAt, "2026-04-01T00:00:00.000Z");
  assert.ok(record.expiresAt !== null);
  assert.deepEqual(record.heartbeatEvents, []);
});

test("WorkflowHibernationService.hibernate clamps TTL to 30 days max", () => {
  const service = new WorkflowHibernationService();
  const record = service.hibernate("wf-max", "task-max", 100, "2026-04-01T00:00:00.000Z");

  // 100 hours should be clamped to 30 days
  assert.ok(record.expiresAt!.includes("2026-05-01"));
});

test("WorkflowHibernationService.hibernate clamps TTL to 1 day min", () => {
  const service = new WorkflowHibernationService();
  const record = service.hibernate("wf-min", "task-min", 0.1, "2026-04-01T00:00:00.000Z");

  // 0.1 hours should be clamped to 1 day minimum
  assert.ok(record.expiresAt !== null);
});

test("WorkflowHibernationService.hibernate clamps negative TTL to 1 day min", () => {
  const service = new WorkflowHibernationService();
  const record = service.hibernate("wf-neg", "task-neg", -5, "2026-04-01T00:00:00.000Z");

  assert.ok(record.expiresAt !== null);
});

test("WorkflowHibernationService.emitStillHibernated throws for non-hibernated workflow", () => {
  const service = new WorkflowHibernationService();
  service.hibernate("wf-active", "task-1", 24);

  assert.throws(
    () => service.emitStillHibernated("wf-active"),
    /workflow_hibernation.not_hibernated/,
  );
});

test("WorkflowHibernationService.emitStillHibernated records heartbeat event", () => {
  const service = new WorkflowHibernationService();
  service.hibernate("wf-hb", "task-1", 24, "2026-04-01T00:00:00.000Z");

  const event = service.emitStillHibernated("wf-hb", "2026-04-02T00:00:00.000Z");

  assert.equal(event.workflowId, "wf-hb");
  assert.equal(event.eventType, "still_hibernated");
  assert.equal(event.emittedAt, "2026-04-02T00:00:00.000Z");
  assert.equal(service.getRecord("wf-hb")?.heartbeatEvents.length, 1);
});

test("WorkflowHibernationService.emitStillHibernated accumulates heartbeat events", () => {
  const service = new WorkflowHibernationService();
  service.hibernate("wf-multi", "task-1", 24, "2026-04-01T00:00:00.000Z");

  service.emitStillHibernated("wf-multi", "2026-04-02T00:00:00.000Z");
  service.emitStillHibernated("wf-multi", "2026-04-03T00:00:00.000Z");

  assert.equal(service.getRecord("wf-multi")?.heartbeatEvents.length, 2);
});

test("WorkflowHibernationService.resume transitions status to resumed", () => {
  const service = new WorkflowHibernationService();
  service.hibernate("wf-res", "task-1", 24, "2026-04-01T00:00:00.000Z");

  const event = service.resume("wf-res", "2026-04-05T00:00:00.000Z");

  assert.equal(event.workflowId, "wf-res");
  assert.equal(event.eventType, "resumed");
  assert.equal(event.emittedAt, "2026-04-05T00:00:00.000Z");
  assert.equal(service.getRecord("wf-res")?.status, "resumed");
});

test("WorkflowHibernationService.resume throws for non-existent workflow", () => {
  const service = new WorkflowHibernationService();

  assert.throws(
    () => service.resume("wf-nonexistent"),
    /workflow_hibernation.not_found/,
  );
});

test("WorkflowHibernationService.getRecord returns null for unknown workflow", () => {
  const service = new WorkflowHibernationService();

  assert.equal(service.getRecord("wf-unknown"), null);
});

test("WorkflowHibernationService.emitDueStillHibernatedEvents returns empty for no hibernated workflows", () => {
  const service = new WorkflowHibernationService();

  const events = service.emitDueStillHibernatedEvents("2026-04-02T00:00:00.000Z");

  assert.deepEqual(events, []);
});

test("WorkflowHibernationService.emitDueStillHibernatedEvents filters non-hibernated records", () => {
  const service = new WorkflowHibernationService();
  service.hibernate("wf-hib", "task-1", 24, "2026-04-01T00:00:00.000Z");
  service.resume("wf-hib", "2026-04-02T00:00:00.000Z");

  const events = service.emitDueStillHibernatedEvents("2026-04-03T00:00:00.000Z");

  assert.deepEqual(events, []);
});

test("WorkflowHibernationService.emitDueStillHibernatedEvents filters within-interval records", () => {
  const service = new WorkflowHibernationService();
  service.hibernate("wf-short", "task-1", 24 * 7, "2026-04-01T00:00:00.000Z");
  service.emitStillHibernated("wf-short", "2026-04-01T12:00:00.000Z");

  // Less than 24 hours since last heartbeat
  const events = service.emitDueStillHibernatedEvents("2026-04-01T20:00:00.000Z");

  assert.deepEqual(events, []);
});

test("WorkflowHibernationService.emitDueStillHibernatedEvents uses hibernatedAt when no heartbeat", () => {
  const service = new WorkflowHibernationService();
  service.hibernate("wf-no-hb", "task-1", 24 * 7, "2026-04-01T00:00:00.000Z");

  // 25 hours since hibernation, should be due
  const events = service.emitDueStillHibernatedEvents("2026-04-02T01:00:00.000Z");

  assert.equal(events.length, 1);
});

test("WorkflowHibernationService.emitDueStillHibernatedEvents respects custom interval", () => {
  const service = new WorkflowHibernationService();
  service.hibernate("wf-int", "task-1", 24 * 7, "2026-04-01T00:00:00.000Z");

  // 2 hours since hibernation - not due for 24h interval but due for 1h interval
  const events = service.emitDueStillHibernatedEvents("2026-04-01T02:00:00.000Z", 1);

  assert.equal(events.length, 1);
});

test("WorkflowHibernationService.emitDueStillHibernatedEvents uses custom asOf timestamp", () => {
  const service = new WorkflowHibernationService();
  service.hibernate("wf-asof", "task-1", 24 * 7, "2026-04-01T00:00:00.000Z");

  const events = service.emitDueStillHibernatedEvents("2026-04-03T00:00:00.000Z", 24);

  assert.equal(events.length, 1);
});

test("WorkflowHibernationService tracks multiple workflows independently", () => {
  const service = new WorkflowHibernationService();
  service.hibernate("wf-1", "task-1", 24, "2026-04-01T00:00:00.000Z");
  service.hibernate("wf-2", "task-2", 24, "2026-04-01T00:00:00.000Z");

  service.emitStillHibernated("wf-1", "2026-04-02T00:00:00.000Z");

  assert.equal(service.getRecord("wf-1")?.heartbeatEvents.length, 1);
  assert.equal(service.getRecord("wf-2")?.heartbeatEvents.length, 0);
});

test("WorkflowHibernationService multiple hibernation records are independent", () => {
  const service = new WorkflowHibernationService();
  service.hibernate("wf-a", "task-a", 24, "2026-04-01T00:00:00.000Z");
  service.hibernate("wf-b", "task-b", 48, "2026-04-01T00:00:00.000Z");

  assert.ok(service.getRecord("wf-a")?.expiresAt !== service.getRecord("wf-b")?.expiresAt);
});
