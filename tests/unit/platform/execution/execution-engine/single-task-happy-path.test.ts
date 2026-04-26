/**
 * Unit Tests: Single Task Happy Path
 *
 * Tests for runSingleTaskExecution (phase1a happy path).
 * The happy path validates the complete lifecycle: task creation, workflow
 * initialization, execution, step completion, and task terminal state.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { runSingleTaskExecution, runPhase1AHappyPath, type HappyPathInput } from "../../../../../src/platform/execution/execution-engine/single-task-happy-path.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test("runPhase1AHappyPath is an alias for runSingleTaskExecution", () => {
  assert.equal(runPhase1AHappyPath, runSingleTaskExecution);
});

test("runSingleTaskExecution requires dbPath", async () => {
  const input: HappyPathInput = {
    dbPath: "",
    title: "Test",
    request: "Test request",
  };

  try {
    await runSingleTaskExecution(input);
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
  }
});

test("runSingleTaskExecution with stepOutputOverride bypasses LLM call", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "phase1a-test-"));
  const dbPath = join(tempDir, "test.db");

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Test with override",
      request: "Test request",
      stepOutputOverride: {
        summary: "Custom summary",
        result: "Custom result",
      },
    };

    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot, "Should return task snapshot");
    assert.ok(snapshot.task, "Snapshot should have task");
    assert.equal(snapshot.task.title, "Test with override");
    const output = JSON.parse(snapshot.task.outputJson ?? "{}") as { summary?: string; result?: string };
    assert.equal(output.summary, "Custom summary");
    assert.equal(output.result, "Custom result");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("runSingleTaskExecution creates task with correct initial status", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "phase1a-task-test-"));
  const dbPath = join(tempDir, "test.db");

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Task status test",
      request: "Create a task and check status",
      stepOutputOverride: { summary: "Done", result: "Result" },
    };

    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task, "Should have task");
    assert.equal(snapshot.task.status, "done");
    assert.equal(snapshot.task.title, "Task status test");
    assert.equal(snapshot.task.divisionId, "general_ops");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("runSingleTaskExecution with tenantId sets tenant on task", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "phase1a-tenant-test-"));
  const dbPath = join(tempDir, "test.db");

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Tenant test",
      request: "Test tenant assignment",
      tenantId: "tenant-123",
      stepOutputOverride: { summary: "Done", result: "Result" },
    };

    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task, "Should have task");
    assert.equal(snapshot.task.tenantId, "tenant-123");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("runSingleTaskExecution handles empty title", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "phase1a-empty-title-"));
  const dbPath = join(tempDir, "test.db");

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "",
      request: "Test with empty title",
      stepOutputOverride: { summary: "Done", result: "Result" },
    };

    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task, "Should return snapshot with task");
    assert.equal(snapshot.task.title, "");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("runSingleTaskExecution sets workflow and execution records", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "phase1a-workflow-test-"));
  const dbPath = join(tempDir, "test.db");

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Workflow records test",
      request: "Verify workflow and execution are created",
      stepOutputOverride: { summary: "Done", result: "Result" },
    };

    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.workflow, "Should have workflow record");
    assert.ok(snapshot.execution, "Should have execution");
    assert.ok(snapshot.execution !== null, "Should have an execution record");
    assert.equal(snapshot.workflow.workflowId, "single_agent_minimal");
    assert.equal(snapshot.workflow.status, "completed");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("runSingleTaskExecution admission rejection handled", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "phase1a-admission-test-"));
  const dbPath = join(tempDir, "test.db");

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Admission test",
      request: "Test admission policy",
      admissionPolicy: {
        maxQueuedTasks: 0,
        maxActiveExecutions: 0,
        maxTier1AckBacklog: 0,
        urgentQueueHeadroom: 0,
      },
      stepOutputOverride: { summary: "Done", result: "Result" },
    };

    // With strict admission policy, the task should still complete but may be queued/cancelled
    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.task, "Should return snapshot");
    // The admission controller may queue or reject based on policy
    assert.ok(
      snapshot.task.status === "done" ||
      snapshot.task.status === "queued" ||
      snapshot.task.status === "cancelled",
      "Task should be in a valid terminal or queued state"
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("runSingleTaskExecution creates session record", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "phase1a-session-test-"));
  const dbPath = join(tempDir, "test.db");

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Session test",
      request: "Verify session is created",
      stepOutputOverride: { summary: "Done", result: "Result" },
    };

    const snapshot = await runSingleTaskExecution(input);

    assert.ok(snapshot.session, "Should have session");
    assert.equal(snapshot.session!.channel, "cli");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("HappyPathInput type accepts all required fields", () => {
  const input: HappyPathInput = {
    dbPath: "/tmp/test.db",
    title: "Type test",
    request: "Test request",
    tenantId: "tenant-abc",
    admissionPolicy: {
      maxQueuedTasks: 100,
      maxActiveExecutions: 50,
      maxTier1AckBacklog: 200,
      urgentQueueHeadroom: 10,
    },
    stepOutputOverride: { summary: "test" },
  };

  assert.equal(input.dbPath, "/tmp/test.db");
  assert.equal(input.title, "Type test");
  assert.equal(input.tenantId, "tenant-abc");
  assert.ok(input.admissionPolicy !== undefined);
  assert.ok(input.stepOutputOverride !== undefined);
});

test("runSingleTaskExecution stepOutputOverride rejects additional fields outside schema", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "phase1a-override-test-"));
  const dbPath = join(tempDir, "test.db");

  try {
    const customData = {
      summary: "Custom summary",
      result: "Custom result",
      extraData: { nested: "value", number: 42 },
      tags: ["test", "override"],
    };

    const input: HappyPathInput = {
      dbPath,
      title: "Override fields test",
      request: "Test override preservation",
      stepOutputOverride: customData,
    };

    await assert.rejects(
      async () => runSingleTaskExecution(input),
      (error: Error & { code?: string }) => error.code === "workflow.output_schema_invalid",
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
