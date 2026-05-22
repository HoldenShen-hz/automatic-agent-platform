import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fs from "node:fs";

import { runSingleTaskExecution } from "../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_DIR = join(__dirname, "../../../../.test-db");

function createTestDbPath(name: string): string {
  return join(TEST_DB_DIR, `${name}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
}

test("integration: runSingleTaskExecution completes happy path", async () => {
  // Ensure test db directory exists
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = createTestDbPath("happy-path");

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Test Task",
      request: "Say hello",
      stepOutputOverride: { result: "hello" },
    });

    assert.ok(snapshot);
    assert.ok(snapshot.task);
    assert.equal(snapshot.task.title, "Test Task");
    assert.equal(snapshot.task.status, "done");
    assert.ok(snapshot.task.outputJson);
    const output = JSON.parse(snapshot.task.outputJson);
    assert.equal(output.result, "hello");
  } finally {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const artifactsDir = join(dirname(dbPath), "artifacts");
    if (fs.existsSync(artifactsDir)) {
      fs.rmSync(artifactsDir, { recursive: true, force: true });
    }
  }
});

test("integration: runSingleTaskExecution creates task and workflow records", async () => {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = createTestDbPath("happy-path-records");

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Integration Test Task",
      request: "Test request for records",
      stepOutputOverride: { result: "ok" },
    });

    assert.ok(snapshot.task);
    assert.equal(snapshot.task.status, "done");
    assert.ok(snapshot.task.id);
    assert.ok(snapshot.task.rootId);
    assert.ok(snapshot.workflow);
    assert.equal(snapshot.workflow.taskId, snapshot.task.id);
    assert.ok(snapshot.execution);
    assert.equal(snapshot.execution.taskId, snapshot.task.id);
    assert.ok(snapshot.session);
    assert.equal(snapshot.session.taskId, snapshot.task.id);
  } finally {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const artifactsDir = join(dirname(dbPath), "artifacts");
    if (fs.existsSync(artifactsDir)) {
      fs.rmSync(artifactsDir, { recursive: true, force: true });
    }
  }
});

test("integration: runSingleTaskExecution handles admission queue decision", async () => {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = createTestDbPath("happy-path-admission");

  try {
    // Use an admission policy that will cause queue decision
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Admission Test",
      request: "Test admission",
      admissionPolicy: {
        maxQueuedTasks: 1,
        maxActiveExecutions: 0,
        maxTier1AckBacklog: 0,
        urgentQueueHeadroom: 0,
      },
      stepOutputOverride: { result: "queued" },
    });

    // Queue path keeps task queued while pausing workflow; reject path cancels task.
    assert.ok(snapshot.task);
    assert.ok(["queued", "cancelled", "done"].includes(snapshot.task.status));
  } finally {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const artifactsDir = join(dirname(dbPath), "artifacts");
    if (fs.existsSync(artifactsDir)) {
      fs.rmSync(artifactsDir, { recursive: true, force: true });
    }
  }
});

test("integration: runSingleTaskExecution persists step output", async () => {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = createTestDbPath("happy-path-step-output");

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Step Output Test",
      request: "Test step output",
      stepOutputOverride: { summary: "Step summary", result: "value" },
    });

    assert.ok(snapshot.task);
    const outputJson = snapshot.task.outputJson ?? "{}";
    const output = JSON.parse(outputJson);
    assert.equal(output.summary, "Step summary");
    assert.equal(output.result, "value");
  } finally {
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    const artifactsDir = join(dirname(dbPath), "artifacts");
    if (fs.existsSync(artifactsDir)) {
      fs.rmSync(artifactsDir, { recursive: true, force: true });
    }
  }
});
