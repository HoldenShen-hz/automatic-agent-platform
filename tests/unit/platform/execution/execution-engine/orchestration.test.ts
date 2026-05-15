import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import {
  runPhase1BOrchestration,
  runMultiStepOrchestration,
  type MultiStepOrchestrationInput,
  type MultiStepOrchestrationResult,
} from "../../../../../src/platform/five-plane-execution/execution-engine/phase1b-orchestration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test("phase1b-orchestration exports runPhase1BOrchestration function", () => {
  assert.equal(typeof runPhase1BOrchestration, "function");
  assert.equal(runPhase1BOrchestration, runMultiStepOrchestration);
});

test("phase1b-orchestration runs basic multi-step workflow", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "phase1b-test-"));
  const dbPath = join(tempDir, "test.db");

  try {
    const input: MultiStepOrchestrationInput = {
      dbPath,
      title: "Test multi-step task",
      request: "Read file test.txt and write summary to summary.txt",
    };

    const result = await runPhase1BOrchestration(input);

    assert.ok(result, "Should return orchestration result");
    assert.ok(result.plannedWorkflow, "Should have planned workflow");
    assert.ok(result.routing, "Should have routing info");
    assert.ok(result.snapshot, "Should have task snapshot");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("phase1b-orchestration planned workflow contains steps", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "phase1b-test-"));
  const dbPath = join(tempDir, "test.db");

  try {
    const input: MultiStepOrchestrationInput = {
      dbPath,
      title: "Test workflow planning",
      request: "Read file test.txt and write summary to summary.txt",
    };

    const result = await runPhase1BOrchestration(input);

    assert.ok(result.plannedWorkflow.executionSteps, "Should have execution steps");
    assert.ok(result.plannedWorkflow.executionSteps.length > 0, "Should have at least one step");
    assert.ok(result.plannedWorkflow.workflow, "Should have workflow definition");
    assert.ok(result.plannedWorkflow.workflow.steps, "Should have workflow steps");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("phase1b-orchestration routing is computed", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "phase1b-test-"));
  const dbPath = join(tempDir, "test.db");

  try {
    const input: MultiStepOrchestrationInput = {
      dbPath,
      title: "Test routing",
      request: "Read file test.txt",
    };

    const result = await runPhase1BOrchestration(input);

    assert.ok(result.routing.workflowId, "Should have workflow ID in routing");
    assert.ok(result.routing.routeReason, "Should have route reason");
    assert.equal(typeof result.routing.requiresOrchestration, "boolean");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("phase1b-orchestration admission rejected handled", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "phase1b-test-"));
  const dbPath = join(tempDir, "test.db");

  try {
    const input: MultiStepOrchestrationInput = {
      dbPath,
      title: "Test admission",
      request: "Read file test.txt",
      admissionPolicy: {
        maxQueuedTasks: 0,
        maxActiveExecutions: 0,
        maxTier1AckBacklog: 0,
        urgentQueueHeadroom: 0,
      },
    };

    const result = await runPhase1BOrchestration(input);

    // Should still return a result even with admission rejection
    assert.ok(result, "Should return result even when admission rejected");
    assert.ok(result.snapshot, "Should have snapshot");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("phase1b-orchestration task snapshot has required fields", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "phase1b-test-"));
  const dbPath = join(tempDir, "test.db");

  try {
    const input: MultiStepOrchestrationInput = {
      dbPath,
      title: "Test snapshot fields",
      request: "Read file test.txt",
    };

    const result = await runPhase1BOrchestration(input);

    const snapshot = result.snapshot;
    assert.ok(snapshot.task, "Should have task");
    assert.ok(snapshot.task.id, "Task should have id");
    assert.ok(snapshot.task.divisionId, "Task should have divisionId");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
