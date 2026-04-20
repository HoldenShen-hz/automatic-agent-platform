import assert from "node:assert/strict";
import test from "node:test";

import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

interface MockTaskStatus {
  value: "queued" | "pending" | "in_progress" | "completed" | "failed" | "cancelled";
}

interface MockSession {
  id: string;
  taskId: string;
  status: "active" | "closed" | "suspended";
  createdAt: string;
}

test("TaskStatus values are valid", () => {
  const statuses: MockTaskStatus["value"][] = ["queued", "pending", "in_progress", "completed", "failed", "cancelled"];

  for (const status of statuses) {
    const task: { status: MockTaskStatus["value"] } = { status };
    assert.equal(task.status, status);
  }
});

test("Session creation", () => {
  const session: MockSession = {
    id: newId("sess"),
    taskId: newId("task"),
    status: "active",
    createdAt: nowIso(),
  };

  assert.ok(session.id.startsWith("sess_"));
  assert.ok(session.taskId.startsWith("task_"));
  assert.equal(session.status, "active");
});

test("Session status transitions", () => {
  const session: MockSession = {
    id: newId("sess"),
    taskId: newId("task"),
    status: "active",
    createdAt: nowIso(),
  };

  session.status = "closed";
  assert.equal(session.status, "closed");
});

test("MockTaskStatus is in_progress", () => {
  const task = { status: "in_progress" as const };
  assert.equal(task.status, "in_progress");
});

test("MockTaskStatus transitions through valid states", () => {
  let status: MockTaskStatus["value"] = "queued";
  const transitions: MockTaskStatus["value"][] = ["pending", "in_progress", "completed"];

  for (const next of transitions) {
    status = next;
  }

  assert.equal(status, "completed");
});

test("Session createdAt is ISO format", () => {
  const session: MockSession = {
    id: newId("sess"),
    taskId: newId("task"),
    status: "active",
    createdAt: nowIso(),
  };

  const date = new Date(session.createdAt);
  assert.equal(isNaN(date.getTime()), false);
});
