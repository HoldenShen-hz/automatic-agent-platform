import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { runPhase1AHappyPath, type HappyPathInput } from "../../../../../src/platform/five-plane-execution/execution-engine/phase1a-happy-path.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test("phase1a-happy-path exports runPhase1AHappyPath function", () => {
  assert.equal(typeof runPhase1AHappyPath, "function");
});

test("phase1a-happy-path happy path execution completes task lifecycle", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "phase1a-test-"));
  const dbPath = join(tempDir, "test.db");

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Test happy path task",
      request: "Test request for happy path",
      stepOutputOverride: {
        summary: "Test summary",
        result: "Test result",
      },
    };

    const snapshot = await runPhase1AHappyPath(input);

    assert.ok(snapshot, "Should return a task snapshot");
    assert.ok(snapshot.task, "Snapshot should contain task record");
    assert.equal(snapshot.task.title, "Test happy path task");
    assert.equal(snapshot.task.status, "done", "Task should be in done status");
    assert.ok(snapshot.task.completedAt, "Task should have completedAt timestamp");
    assert.ok(snapshot.task.outputJson, "Task should have output JSON");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("phase1a-happy-path creates task and workflow records", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "phase1a-test-"));
  const dbPath = join(tempDir, "test.db");

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Test workflow records",
      request: "Test request",
      stepOutputOverride: {
        summary: "Test summary",
        result: "Test result",
      },
    };

    const snapshot = await runPhase1AHappyPath(input);

    assert.ok(snapshot.task, "Should have task record");
    assert.ok(snapshot.workflow, "Should have workflow record");
    assert.equal(snapshot.workflow.workflowId, "single_agent_minimal");
    assert.equal(snapshot.workflow.status, "completed", "Workflow should be completed");
    assert.ok(snapshot.stepOutputs, "Should have step outputs");
    assert.ok(snapshot.stepOutputs.length > 0, "Should have at least one step output");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("phase1a-happy-path step output contains expected data", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "phase1a-test-"));
  const dbPath = join(tempDir, "test.db");

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Test step output",
      request: "Test request",
      stepOutputOverride: {
        summary: "Custom summary",
        result: "Custom result",
      },
    };

    const snapshot = await runPhase1AHappyPath(input);

    const stepOutput = snapshot.stepOutputs[0];
    assert.ok(stepOutput, "Should have step output");
    assert.equal(stepOutput.status, "succeeded");
    assert.equal(stepOutput.summary, "Custom summary");
    assert.ok(stepOutput.dataJson, "Should have data JSON");
    const stepData = JSON.parse(stepOutput.dataJson);
    assert.equal(stepData.result, "Custom result");
    assert.equal(stepData.summary, "Custom summary");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("phase1a-happy-path uses synthetic output when no LLM provider", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "phase1a-test-"));
  const dbPath = join(tempDir, "test.db");

  try {
    const input: HappyPathInput = {
      dbPath,
      title: "Test synthetic output",
      request: "Test request",
      // No stepOutputOverride and no LLM provider - should use synthetic output
    };

    const snapshot = await runPhase1AHappyPath(input);

    assert.ok(snapshot.task, "Should have task record");
    // Without stepOutputOverride and no LLM provider, should still complete
    assert.ok(snapshot.stepOutputs && snapshot.stepOutputs.length > 0, "Should have step output");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
