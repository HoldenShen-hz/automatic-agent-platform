import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fs from "node:fs";

import { runMultiStepOrchestration } from "../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_DIR = join(__dirname, "../../../../.test-db");

test("integration: runMultiStepOrchestration with oapeflir plan request", async () => {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = join(TEST_DB_DIR, `multi-step-${Date.now()}.db`);

  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "multi-step-plan-1",
      request: JSON.stringify({
        stepId: "step_1",
        roleId: "general_executor",
        outputs: ["output_step_1"],
        dependencies: [],
        timeout: 30000,
        retryPolicy: { maxRetries: 0 },
      }).replace(/^/, "oapeflir://plan "),
    });

    assert.ok(result.snapshot);
    assert.ok(result.routing);
    assert.ok(result.plannedWorkflow);
    assert.equal(result.routing.routeReason, "oapeflir_bridge");
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

test("integration: runMultiStepOrchestration creates routing and workflow", async () => {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = join(TEST_DB_DIR, `multi-step-routing-${Date.now()}.db`);

  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Test Multi-Step",
      request: "Run a simple multi-step workflow",
    });

    assert.ok(result.snapshot);
    assert.ok(result.routing);
    assert.ok(result.plannedWorkflow);
    assert.ok(result.plannedWorkflow.workflow);
    assert.ok(result.plannedWorkflow.workflow.workflowId);
    assert.equal(result.routing.requiresOrchestration, true);
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

test("integration: runMultiStepOrchestration stores events", async () => {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = join(TEST_DB_DIR, `multi-step-events-${Date.now()}.db`);

  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Event Test",
      request: "Test event storage",
    });

    assert.ok(result.snapshot);
    // Snapshot should contain events
    assert.ok(result.snapshot.events);
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
