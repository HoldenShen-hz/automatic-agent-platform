/**
 * Unit tests for event-record-support.ts
 *
 * Tests the materializeEventRecord function which converts EventRecordDraft
 * to canonical EventRecord with proper null defaults and event tier resolution.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { materializeEventRecord, type EventRecordDraft } from "../../../../../src/platform/five-plane-state-evidence/events/event-record-support.js";

function createDraft(overrides: Partial<EventRecordDraft> = {}): EventRecordDraft {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? "evt_test_1",
    eventType: overrides.eventType ?? "task:status_changed",
    payloadJson: overrides.payloadJson ?? '{"fromStatus":"queued","toStatus":"in_progress"}',
    createdAt: overrides.createdAt ?? now,
    taskId: overrides.taskId ?? "task_123",
    sessionId: overrides.sessionId ?? null,
    executionId: overrides.executionId ?? "exec_456",
    eventTier: overrides.eventTier,
    traceId: overrides.traceId ?? "trace_abc",
    schemaVersion: overrides.schemaVersion ?? null,
    aggregateId: overrides.aggregateId ?? null,
    runId: overrides.runId ?? null,
    sequence: overrides.sequence ?? null,
    causationId: overrides.causationId ?? null,
    correlationId: overrides.correlationId ?? null,
    payloadHash: overrides.payloadHash ?? null,
    idempotencyKey: overrides.idempotencyKey ?? null,
    replayBehavior: overrides.replayBehavior ?? null,
    principal: overrides.principal ?? null,
    evidenceRefs: overrides.evidenceRefs ?? [],
    ...overrides,
  };
}

test("materializeEventRecord preserves required fields", () => {
  const draft = createDraft();
  const result = materializeEventRecord(draft);

  assert.equal(result.id, draft.id);
  assert.equal(result.eventType, draft.eventType);
  assert.equal(result.payloadJson, draft.payloadJson);
  assert.equal(result.createdAt, draft.createdAt);
});

test("materializeEventRecord converts taskId to null when undefined", () => {
  const draft = createDraft({ taskId: undefined });
  const result = materializeEventRecord(draft);

  assert.equal(result.taskId, null);
});

test("materializeEventRecord preserves taskId when provided", () => {
  const draft = createDraft({ taskId: "task_xyz" });
  const result = materializeEventRecord(draft);

  assert.equal(result.taskId, "task_xyz");
});

test("materializeEventRecord converts sessionId to null when null", () => {
  const draft = createDraft({ sessionId: null });
  const result = materializeEventRecord(draft);

  assert.equal(result.sessionId, null);
});

test("materializeEventRecord converts executionId to null when null", () => {
  const draft = createDraft({ executionId: null });
  const result = materializeEventRecord(draft);

  assert.equal(result.executionId, null);
});

test("materializeEventRecord converts traceId to null when undefined", () => {
  const draft = createDraft({ traceId: undefined });
  const result = materializeEventRecord(draft);

  assert.equal(result.traceId, null);
});

test("materializeEventRecord preserves traceId when provided", () => {
  const draft = createDraft({ traceId: "trace_custom" });
  const result = materializeEventRecord(draft);

  assert.equal(result.traceId, "trace_custom");
});

test("materializeEventRecord converts schemaVersion to null when undefined", () => {
  const draft = createDraft({ schemaVersion: undefined });
  const result = materializeEventRecord(draft);

  assert.equal(result.schemaVersion, null);
});

test("materializeEventRecord preserves schemaVersion when provided", () => {
  const draft = createDraft({ schemaVersion: "1.0.0" });
  const result = materializeEventRecord(draft);

  assert.equal(result.schemaVersion, "1.0.0");
});

test("materializeEventRecord converts aggregateId to null when undefined", () => {
  const draft = createDraft({ aggregateId: undefined });
  const result = materializeEventRecord(draft);

  assert.equal(result.aggregateId, null);
});

test("materializeEventRecord preserves aggregateId when provided", () => {
  const draft = createDraft({ aggregateId: "agg_123" });
  const result = materializeEventRecord(draft);

  assert.equal(result.aggregateId, "agg_123");
});

test("materializeEventRecord converts runId to null when undefined", () => {
  const draft = createDraft({ runId: undefined });
  const result = materializeEventRecord(draft);

  assert.equal(result.runId, null);
});

test("materializeEventRecord preserves runId when provided", () => {
  const draft = createDraft({ runId: "run_789" });
  const result = materializeEventRecord(draft);

  assert.equal(result.runId, "run_789");
});

test("materializeEventRecord converts sequence to null when undefined", () => {
  const draft = createDraft({ sequence: undefined });
  const result = materializeEventRecord(draft);

  assert.equal(result.sequence, null);
});

test("materializeEventRecord preserves sequence when provided", () => {
  const draft = createDraft({ sequence: 42 });
  const result = materializeEventRecord(draft);

  assert.equal(result.sequence, 42);
});

test("materializeEventRecord converts causationId to null when null", () => {
  const draft = createDraft({ causationId: null });
  const result = materializeEventRecord(draft);

  assert.equal(result.causationId, null);
});

test("materializeEventRecord preserves causationId when provided", () => {
  const draft = createDraft({ causationId: "evt_cause_1" });
  const result = materializeEventRecord(draft);

  assert.equal(result.causationId, "evt_cause_1");
});

test("materializeEventRecord converts correlationId to null when undefined", () => {
  const draft = createDraft({ correlationId: undefined });
  const result = materializeEventRecord(draft);

  assert.equal(result.correlationId, null);
});

test("materializeEventRecord preserves correlationId when provided", () => {
  const draft = createDraft({ correlationId: "corr_abc" });
  const result = materializeEventRecord(draft);

  assert.equal(result.correlationId, "corr_abc");
});

test("materializeEventRecord converts payloadHash to null when null", () => {
  const draft = createDraft({ payloadHash: null });
  const result = materializeEventRecord(draft);

  assert.equal(result.payloadHash, null);
});

test("materializeEventRecord preserves payloadHash when provided", () => {
  const draft = createDraft({ payloadHash: "sha256_abc123" });
  const result = materializeEventRecord(draft);

  assert.equal(result.payloadHash, "sha256_abc123");
});

test("materializeEventRecord converts idempotencyKey to null when null", () => {
  const draft = createDraft({ idempotencyKey: null });
  const result = materializeEventRecord(draft);

  assert.equal(result.idempotencyKey, null);
});

test("materializeEventRecord preserves idempotencyKey when provided", () => {
  const draft = createDraft({ idempotencyKey: "idem_123" });
  const result = materializeEventRecord(draft);

  assert.equal(result.idempotencyKey, "idem_123");
});

test("materializeEventRecord converts principal to null when null", () => {
  const draft = createDraft({ principal: null });
  const result = materializeEventRecord(draft);

  assert.equal(result.principal, null);
});

test("materializeEventRecord preserves principal when provided", () => {
  const draft = createDraft({ principal: "user_456" });
  const result = materializeEventRecord(draft);

  assert.equal(result.principal, "user_456");
});

test("materializeEventRecord creates new array for evidenceRefs (defensive copy)", () => {
  const draft = createDraft({ evidenceRefs: ["ref_1", "ref_2"] });
  const result = materializeEventRecord(draft);

  assert.deepEqual(result.evidenceRefs, ["ref_1", "ref_2"]);
  // Verify it's a copy, not the same reference
  draft.evidenceRefs.push("ref_3");
  assert.equal(result.evidenceRefs.length, 2);
});

test("materializeEventRecord uses empty array when evidenceRefs undefined", () => {
  const draft = createDraft({ evidenceRefs: undefined });
  const result = materializeEventRecord(draft);

  assert.deepEqual(result.evidenceRefs, []);
});

test("materializeEventRecord preserves replayBehavior when provided", () => {
  const draft = createDraft({ replayBehavior: "replay_as_fact" });
  const result = materializeEventRecord(draft);

  assert.equal(result.replayBehavior, "replay_as_fact");
});

test("materializeEventRecord converts replayBehavior to null when null", () => {
  const draft = createDraft({ replayBehavior: null });
  const result = materializeEventRecord(draft);

  assert.equal(result.replayBehavior, null);
});

test("materializeEventRecord handles event types with tier prefix", () => {
  const draft = createDraft({ eventType: "task:status_changed" });
  const result = materializeEventRecord(draft);

  // EventRecordDraft.eventTier is optional - when not provided,
  // getEventTier is called to determine the tier
  assert.ok(result.eventTier !== undefined);
});

test("materializeEventRecord preserves explicitly set eventTier", () => {
  const draft = createDraft({ eventTier: "tier_1" });
  const result = materializeEventRecord(draft);

  assert.equal(result.eventTier, "tier_1");
});

test("materializeEventRecord works with minimal draft (only required fields)", () => {
  const minimalDraft: EventRecordDraft = {
    id: "evt_minimal",
    eventType: "test:minimal",
    payloadJson: "{}",
    createdAt: new Date().toISOString(),
  };

  const result = materializeEventRecord(minimalDraft);

  assert.equal(result.id, "evt_minimal");
  assert.equal(result.eventType, "test:minimal");
  assert.equal(result.payloadJson, "{}");
  // All optional fields should default to null
  assert.equal(result.taskId, null);
  assert.equal(result.sessionId, null);
  assert.equal(result.executionId, null);
  assert.equal(result.traceId, null);
  assert.equal(result.schemaVersion, null);
  assert.equal(result.aggregateId, null);
  assert.equal(result.runId, null);
  assert.equal(result.sequence, null);
  assert.equal(result.causationId, null);
  assert.equal(result.correlationId, null);
  assert.equal(result.payloadHash, null);
  assert.equal(result.idempotencyKey, null);
  assert.equal(result.replayBehavior, null);
  assert.equal(result.principal, null);
  assert.deepEqual(result.evidenceRefs, []);
});

test("materializeEventRecord creates a new evidenceRefs array each call", () => {
  const draft = createDraft();
  const result1 = materializeEventRecord(draft);
  const result2 = materializeEventRecord(draft);

  // Each call should produce a new array instance
  assert.notEqual(result1.evidenceRefs, result2.evidenceRefs);
  assert.deepEqual(result1.evidenceRefs, result2.evidenceRefs);
});

test("materializeEventRecord preserves all string nulls correctly", () => {
  const draft = createDraft({
    sessionId: null,
    executionId: null,
    traceId: null,
    schemaVersion: null,
    aggregateId: null,
    runId: null,
    causationId: null,
    correlationId: null,
    payloadHash: null,
    idempotencyKey: null,
    principal: null,
    replayBehavior: null,
  });

  const result = materializeEventRecord(draft);

  // All nullable fields should be null
  assert.equal(result.sessionId, null);
  assert.equal(result.executionId, null);
  assert.equal(result.traceId, null);
  assert.equal(result.schemaVersion, null);
  assert.equal(result.aggregateId, null);
  assert.equal(result.runId, null);
  assert.equal(result.causationId, null);
  assert.equal(result.correlationId, null);
  assert.equal(result.payloadHash, null);
  assert.equal(result.idempotencyKey, null);
  assert.equal(result.principal, null);
  assert.equal(result.replayBehavior, null);
});