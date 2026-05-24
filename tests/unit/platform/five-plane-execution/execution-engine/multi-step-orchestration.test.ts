import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { openAuthoritativeStorageContext } from "../../../../../src/platform/five-plane-state-evidence/truth/storage-backend-factory.js";
import { runMultiStepOrchestration } from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";

async function createTempDbPath(): Promise<string> {
  const tmp = await mkdtemp(join(tmpdir(), "multi-step-test-"));
  return join(tmp, `test-${randomUUID()}.db`);
}

test("runMultiStepOrchestration completes a task and persists a canonical snapshot", async () => {
  const dbPath = await createTempDbPath();

  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Test multi-step task",
      request: "analyze and summarize this data",
      stepOutputOverrides: {
        intake_triage: {
          summary: "Analysis complete",
          result: "Found insights",
        },
      },
    });

    assert.equal(result.snapshot.task.status, "done");
    assert.ok(result.snapshot.workflow);
    assert.ok(result.snapshot.session);
    assert.ok(result.snapshot.stepOutputs.length > 0);
    assert.ok(result.routing.workflowId);
    assert.ok(result.plannedWorkflow.workflow.workflowId);
  } finally {
    const storage = openAuthoritativeStorageContext({ dbPath });
    storage.close();
  }
});

test("runMultiStepOrchestration uses the oapeflir bridge for serialized plans", async () => {
  const dbPath = await createTempDbPath();
  const plan = JSON.stringify([
    {
      stepId: "step_1",
      action: "tool",
      inputs: {},
      outputs: ["output_step_1"],
      dependencies: [],
      status: "pending",
      timeout: 30_000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ]);

  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "oapeflir-test",
      request: `oapeflir://plan ${plan}`,
    });

    assert.equal(result.routing.routeReason, "oapeflir_bridge");
    assert.equal(result.routing.requiresOrchestration, true);
    assert.equal(result.snapshot.task.status, "done");
  } finally {
    const storage = openAuthoritativeStorageContext({ dbPath });
    storage.close();
  }
});

test("runMultiStepOrchestration emits routing events into the authoritative snapshot", async () => {
  const dbPath = await createTempDbPath();

  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "routing-event-test",
      request: "analyze this request",
      contextBudgetTokens: 64,
    });

    assert.ok(result.snapshot.events.some((event) => event.eventType === "routing:decided"));
    assert.ok(result.compaction == null || typeof result.compaction === "object");
  } finally {
    const storage = openAuthoritativeStorageContext({ dbPath });
    storage.close();
  }
});
