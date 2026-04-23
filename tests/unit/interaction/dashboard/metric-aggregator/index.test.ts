/**
 * Unit tests for metric-aggregator utilities
 */

import assert from "node:assert/strict";
import test from "node:test";
import { summarizeTaskMetrics, type TaskMetricSnapshot } from "../../../../../src/interaction/dashboard/metric-aggregator/index.js";

test("summarizeTaskMetrics returns zero counts for empty array", () => {
  const result = summarizeTaskMetrics([]);

  assert.equal(result.total, 0);
  assert.equal(result.done, 0);
  assert.equal(result.inProgress, 0);
  assert.equal(result.failed, 0);
});

test("summarizeTaskMetrics counts all statuses correctly", () => {
  const statuses = ["done", "in_progress", "done", "failed", "in_progress", "in_progress", "done"];

  const result = summarizeTaskMetrics(statuses);

  assert.equal(result.total, 7);
  assert.equal(result.done, 3);
  assert.equal(result.inProgress, 3);
  assert.equal(result.failed, 1);
});

test("summarizeTaskMetrics counts only done statuses", () => {
  const statuses = ["done", "done", "done"];

  const result = summarizeTaskMetrics(statuses);

  assert.equal(result.total, 3);
  assert.equal(result.done, 3);
  assert.equal(result.inProgress, 0);
  assert.equal(result.failed, 0);
});

test("summarizeTaskMetrics counts only in_progress statuses", () => {
  const statuses = ["in_progress", "in_progress"];

  const result = summarizeTaskMetrics(statuses);

  assert.equal(result.total, 2);
  assert.equal(result.done, 0);
  assert.equal(result.inProgress, 2);
  assert.equal(result.failed, 0);
});

test("summarizeTaskMetrics counts only failed statuses", () => {
  const statuses = ["failed", "failed", "failed"];

  const result = summarizeTaskMetrics(statuses);

  assert.equal(result.total, 3);
  assert.equal(result.done, 0);
  assert.equal(result.inProgress, 0);
  assert.equal(result.failed, 3);
});

test("summarizeTaskMetrics returns valid TaskMetricSnapshot shape", () => {
  const result = summarizeTaskMetrics(["done", "in_progress", "failed"]);

  const snapshot: TaskMetricSnapshot = result;
  assert.equal(typeof snapshot.total, "number");
  assert.equal(typeof snapshot.done, "number");
  assert.equal(typeof snapshot.inProgress, "number");
  assert.equal(typeof snapshot.failed, "number");
});

test("summarizeTaskMetrics handles readonly array", () => {
  const statuses: readonly string[] = ["done", "done", "in_progress"];

  const result = summarizeTaskMetrics(statuses);

  assert.equal(result.total, 3);
  assert.equal(result.done, 2);
  assert.equal(result.inProgress, 1);
});