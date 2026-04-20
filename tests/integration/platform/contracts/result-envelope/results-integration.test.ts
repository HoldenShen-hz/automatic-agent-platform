import assert from "node:assert/strict";
import test from "node:test";

import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

interface MockResult {
  id: string;
  taskId: string;
  executionId: string;
  status: "success" | "failure" | "partial";
  output: Record<string, unknown>;
  createdAt: string;
}

test("Result creation for successful task", () => {
  const result: MockResult = {
    id: newId("result"),
    taskId: newId("task"),
    executionId: newId("exec"),
    status: "success",
    output: { data: "completed" },
    createdAt: nowIso(),
  };

  assert.ok(result.id.startsWith("result_"));
  assert.equal(result.status, "success");
  assert.equal(result.output.data, "completed");
});

test("Result creation for failed task", () => {
  const result: MockResult = {
    id: newId("result"),
    taskId: newId("task"),
    executionId: newId("exec"),
    status: "failure",
    output: { error: "timeout" },
    createdAt: nowIso(),
  };

  assert.equal(result.status, "failure");
  assert.equal(result.output.error, "timeout");
});

test("Result with structured output", () => {
  const result: MockResult = {
    id: newId("result"),
    taskId: newId("task"),
    executionId: newId("exec"),
    status: "success",
    output: {
      files: ["/a.ts", "/b.ts"],
      count: 2,
      duration: 1500,
    },
    createdAt: nowIso(),
  };

  assert.ok(Array.isArray(result.output.files));
  assert.equal(result.output.count, 2);
});

test("Multiple results for same task (retry)", () => {
  const taskId = newId("task");
  const results: MockResult[] = [];

  // First attempt failed
  results.push({
    id: newId("result"),
    taskId,
    executionId: newId("exec"),
    status: "failure",
    output: { error: "first attempt" },
    createdAt: nowIso(),
  });

  // Second attempt success
  results.push({
    id: newId("result"),
    taskId,
    executionId: newId("exec"),
    status: "success",
    output: { data: "retry succeeded" },
    createdAt: nowIso(),
  });

  assert.equal(results.length, 2);
  assert.equal(results.filter((r) => r.status === "failure").length, 1);
  assert.equal(results.filter((r) => r.status === "success").length, 1);
});

test("Result ordering by creation time", () => {
  const results: MockResult[] = [];

  for (let i = 0; i < 5; i++) {
    results.push({
      id: newId("result"),
      taskId: newId("task"),
      executionId: newId("exec"),
      status: "success",
      output: { index: i },
      createdAt: nowIso(),
    });
  }

  const sorted = results.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (let i = 1; i < sorted.length; i++) {
    assert.ok(sorted[i]!.createdAt >= sorted[i - 1]!.createdAt);
  }
});

test("Partial result with mixed status", () => {
  const result: MockResult = {
    id: newId("result"),
    taskId: newId("task"),
    executionId: newId("exec"),
    status: "partial",
    output: {
      succeeded: ["/a.ts", "/b.ts"],
      failed: ["/c.ts"],
    },
    createdAt: nowIso(),
  };

  assert.equal(result.status, "partial");
  assert.ok(Array.isArray(result.output.succeeded));
  assert.ok(Array.isArray(result.output.failed));
});
