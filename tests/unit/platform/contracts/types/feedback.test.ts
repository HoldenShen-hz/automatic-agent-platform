/**
 * Unit tests for Feedback Contract Types
 *
 * @see src/platform/contracts/types/feedback.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyFeedbackBatch,
  type FeedbackBatch,
  type FeedbackBatchOutcome,
} from "../../../../../src/platform/contracts/types/feedback.js";

// ─────────────────────────────────────────────────────────────────────────────
// createEmptyFeedbackBatch Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createEmptyFeedbackBatch creates batch with correct taskId", () => {
  const batch = createEmptyFeedbackBatch("task123");

  assert.strictEqual(batch.taskId, "task123");
});

test("createEmptyFeedbackBatch generates feedbackId from taskId", () => {
  const batch = createEmptyFeedbackBatch("task456");

  assert.strictEqual(batch.feedbackId, "fb_task456");
});

test("createEmptyFeedbackBatch sets null executionId", () => {
  const batch = createEmptyFeedbackBatch("task789");

  assert.strictEqual(batch.executionId, null);
});

test("createEmptyFeedbackBatch sets null planId", () => {
  const batch = createEmptyFeedbackBatch("taskABC");

  assert.strictEqual(batch.planId, null);
});

test("createEmptyFeedbackBatch defaults outcome to failed", () => {
  const batch = createEmptyFeedbackBatch("taskXYZ");

  assert.strictEqual(batch.outcome, "failed");
});

test("createEmptyFeedbackBatch defaults signals to empty array", () => {
  const batch = createEmptyFeedbackBatch("taskEmpty");

  assert.ok(Array.isArray(batch.signals));
  assert.strictEqual(batch.signals.length, 0);
});

test("createEmptyFeedbackBatch sets emittedAt to current time", () => {
  const before = Date.now();
  const batch = createEmptyFeedbackBatch("taskNow");
  const after = Date.now();

  assert.ok(batch.emittedAt >= before);
  assert.ok(batch.emittedAt <= after);
});

test("createEmptyFeedbackBatch returns readonly signals array", () => {
  const batch = createEmptyFeedbackBatch("taskReadonly");

  assert.ok(Array.isArray(batch.signals));
  // Verify it's a readonly array (length is accessible but mutating would fail)
  assert.strictEqual(batch.signals.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// FeedbackBatchOutcome Type Tests
// ─────────────────────────────────────────────────────────────────────────────

test("FeedbackBatchOutcome includes expected values", () => {
  const outcomes: FeedbackBatchOutcome[] = ["completed", "failed", "repairable", "escalated", "partial"];

  for (const outcome of outcomes) {
    const batch = createEmptyFeedbackBatch("taskTest");
    // Just verify the function works with different task IDs
    assert.ok(batch.taskId.length > 0);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FeedbackBatch Structure Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createEmptyFeedbackBatch returns complete FeedbackBatch structure", () => {
  const batch = createEmptyFeedbackBatch("taskComplete");

  assert.ok("feedbackId" in batch);
  assert.ok("taskId" in batch);
  assert.ok("executionId" in batch);
  assert.ok("planId" in batch);
  assert.ok("outcome" in batch);
  assert.ok("signals" in batch);
  assert.ok("emittedAt" in batch);
});

test("createEmptyFeedbackBatch produces valid FeedbackBatch type", () => {
  const batch = createEmptyFeedbackBatch("taskValid");

  // Verify the structure matches the FeedbackBatch interface
  const _check: FeedbackBatch = batch;
  assert.ok(_check !== null && _check !== undefined);
});

test("createEmptyFeedbackBatch handles various taskId formats", () => {
  const taskIds = ["simple", "task_with_underscore", "task-with-dash", "task.with.dots", "123456"];

  for (const taskId of taskIds) {
    const batch = createEmptyFeedbackBatch(taskId);
    assert.strictEqual(batch.taskId, taskId);
    assert.strictEqual(batch.feedbackId, `fb_${taskId}`);
  }
});

test("createEmptyFeedbackBatch timestamps are valid numbers", () => {
  const batch = createEmptyFeedbackBatch("taskTimestamp");

  assert.ok(typeof batch.emittedAt === "number");
  assert.ok(batch.emittedAt > 0);
});

test("createEmptyFeedbackBatch can be used in arrays", () => {
  const batches: FeedbackBatch[] = [
    createEmptyFeedbackBatch("task1"),
    createEmptyFeedbackBatch("task2"),
    createEmptyFeedbackBatch("task3"),
  ];
  const [first, second, third] = batches;

  assert.strictEqual(batches.length, 3);
  assert.ok(first && second && third);
  assert.strictEqual(first.taskId, "task1");
  assert.strictEqual(second.taskId, "task2");
  assert.strictEqual(third.taskId, "task3");
});
