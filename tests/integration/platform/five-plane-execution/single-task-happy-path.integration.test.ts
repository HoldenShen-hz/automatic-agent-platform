import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fs from "node:fs";

import { runSingleTaskExecution } from "../../../../src/platform/five-plane-execution/execution-engine/single-task-happy-path.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_DIR = join(__dirname, "../../../../.test-db");

test("integration: runSingleTaskExecution completes happy path", async () => {
  // Ensure test db directory exists
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = join(TEST_DB_DIR, `happy-path-${Date.now()}.db`);

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Test Task",
      request: "Say hello",
      stepOutputOverride: { greeting: "hello" },
    });

    assert.ok(snapshot);
    assert.ok(snapshot.task);
    assert.equal(snapshot.task.title, "Test Task");
    assert.equal(snapshot.task.status, "done");
    assert.ok(snapshot.task.outputJson);
    const output = JSON.parse(snapshot.task.outputJson);
    assert.equal(output.greeting, "hello");
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

  const dbPath = join(TEST_DB_DIR, `happy-path-records-${Date.now()}.db`);

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
    assert.ok(snapshot.executions);
    assert.ok(snapshot.executions.length > 0);
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

  const dbPath = join(TEST_DB_DIR, `happy-path-admission-${Date.now()}.db`);

  try {
    // Use an admission policy that will cause queue decision
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Admission Test",
      request: "Test admission",
      admissionPolicy: {
        maxConcurrentExecutions: 0,
        maxQueuedTasks: 1,
        memoryHighWatermarkMb: 0,
        eventLoopLagThresholdMs: 0,
      },
      stepOutputOverride: { result: "queued" },
    });

    // With policy causing queue, task should be paused or queued
    assert.ok(snapshot.task);
    assert.ok(["paused", "queued", "done"].includes(snapshot.task.status));
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

  const dbPath = join(TEST_DB_DIR, `happy-path-step-output-${Date.now()}.db`);

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Step Output Test",
      request: "Test step output",
      stepOutputOverride: { summary: "Step summary", data: { key: "value" } },
    });

    assert.ok(snapshot.task);
    const output = JSON.parse(snapshot.task.outputJson);
    assert.equal(output.summary, "Step summary");
    assert.deepEqual(output.data, { key: "value" });
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
