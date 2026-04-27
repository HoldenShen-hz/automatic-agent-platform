import assert from "node:assert/strict";
import test from "node:test";

import { summarizeTaskMetrics, type TaskMetricSnapshot } from "../../../../../src/interaction/dashboard/metric-aggregator/index.js";

test("summarizeTaskMetrics with empty array", () => {
  const result = summarizeTaskMetrics([]);

  assert.equal(result.total, 0);
  assert.equal(result.done, 0);
  assert.equal(result.inProgress, 0);
  assert.equal(result.failed, 0);
});

test("summarizeTaskMetrics with all done tasks", () => {
  const result = summarizeTaskMetrics(["done", "done", "done"]);

  assert.equal(result.total, 3);
  assert.equal(result.done, 3);
  assert.equal(result.inProgress, 0);
  assert.equal(result.failed, 0);
});

test("summarizeTaskMetrics with all in_progress tasks", () => {
  const result = summarizeTaskMetrics(["in_progress", "in_progress"]);

  assert.equal(result.total, 2);
  assert.equal(result.done, 0);
  assert.equal(result.inProgress, 2);
  assert.equal(result.failed, 0);
});

test("summarizeTaskMetrics with all failed tasks", () => {
  const result = summarizeTaskMetrics(["failed", "failed", "failed"]);

  assert.equal(result.total, 3);
  assert.equal(result.done, 0);
  assert.equal(result.inProgress, 0);
  assert.equal(result.failed, 3);
});

test("summarizeTaskMetrics with mixed statuses", () => {
  const result = summarizeTaskMetrics(["done", "in_progress", "failed", "done"]);

  assert.equal(result.total, 4);
  assert.equal(result.done, 2);
  assert.equal(result.inProgress, 1);
  assert.equal(result.failed, 1);
});

test("summarizeTaskMetrics preserves readonly property", () => {
  const statuses: readonly string[] = ["done", "in_progress"];
  const result = summarizeTaskMetrics(statuses);

  assert.equal(result.total, 2);
});

test("summarizeTaskMetrics returns correct types", () => {
  const result = summarizeTaskMetrics(["done"]);

  assert.equal(typeof result.total, "number");
  assert.equal(typeof result.done, "number");
  assert.equal(typeof result.inProgress, "number");
  assert.equal(typeof result.failed, "number");
});

test("summarizeTaskMetrics with single task", () => {
  const result = summarizeTaskMetrics(["done"]);

  assert.equal(result.total, 1);
  assert.equal(result.done, 1);
});

test("summarizeTaskMetrics counts all statuses correctly", () => {
  const statuses = ["done", "in_progress", "failed", "done", "in_progress", "done"];
  const result = summarizeTaskMetrics(statuses);

  assert.equal(result.total, 6);
  assert.equal(result.done, 3);
  assert.equal(result.inProgress, 2);
  assert.equal(result.failed, 1);
});

test("summarizeTaskMetrics handles large arrays", () => {
  const statuses = Array(1000).fill("done");
  const result = summarizeTaskMetrics(statuses);

  assert.equal(result.total, 1000);
  assert.equal(result.done, 1000);
});