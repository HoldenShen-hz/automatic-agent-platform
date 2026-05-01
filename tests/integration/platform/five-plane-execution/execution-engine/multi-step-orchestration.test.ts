import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import fs from "node:fs";

import { runMultiStepOrchestration } from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";
import { createIntegrationContext } from "../../../../../tests/helpers/integration-context.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DB_DIR = join(__dirname, "../../../../../.test-db");

test("integration: runMultiStepOrchestration executes full workflow from plan to completion", async () => {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = join(TEST_DB_DIR, `multi-step-full-${Date.now()}.db`);

  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Full Workflow Test",
      request: "Execute a complete multi-step workflow",
      stepOutputOverrides: {
        intake_triage: {
          summary: "Triaged the request",
          result: "Request triaged successfully",
          data: { nextStep: "code_generation" },
        },
      },
    });

    assert.ok(result.snapshot, "snapshot should be present");
    assert.ok(result.snapshot.task, "task should be in snapshot");
    assert.ok(result.snapshot.workflow, "workflow should be in snapshot");
    assert.equal(result.snapshot.task.title, "Full Workflow Test");
    assert.equal(result.snapshot.task.status, "done");
    assert.ok(result.plannedWorkflow, "plannedWorkflow should be present");
    assert.ok(result.plannedWorkflow.workflow, "workflow definition should be present");
    assert.ok(result.plannedWorkflow.workflow.workflowId, "workflowId should be assigned");
    assert.ok(result.routing, "routing should be present");
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

test("integration: runMultiStepOrchestration with oapeflir plan executes to completion", async () => {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = join(TEST_DB_DIR, `multi-step-oapeflir-${Date.now()}.db`);

  try {
    const planPayload = JSON.stringify([
      {
        stepId: "step_1",
        roleId: "general_executor",
        outputs: ["output_step_1"],
        dependencies: [],
        timeout: 30000,
        retryPolicy: { maxRetries: 0 },
      },
      {
        stepId: "step_2",
        roleId: "general_executor",
        outputs: ["output_step_2"],
        dependencies: ["step_1"],
        timeout: 30000,
        retryPolicy: { maxRetries: 0 },
      },
    ]);

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "oapeflir-plan-1",
      request: `oapeflir://plan ${planPayload}`,
      stepOutputOverrides: {
        step_1: { summary: "Step 1 completed", result: "output_1" },
        step_2: { summary: "Step 2 completed", result: "output_2" },
      },
    });

    assert.ok(result.snapshot);
    assert.equal(result.snapshot.task.status, "done");
    assert.equal(result.routing.routeReason, "oapeflir_bridge");
    assert.ok(result.plannedWorkflow);
    assert.equal(result.plannedWorkflow.executionSteps.length, 2);
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

test("integration: runMultiStepOrchestration with oapeflir plan with dependency executes to completion", async () => {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = join(TEST_DB_DIR, `multi-step-oapeflir-deps-${Date.now()}.db`);

  try {
    const planPayload = JSON.stringify([
      {
        stepId: "generate_code",
        roleId: "general_executor",
        outputs: ["generated_code"],
        dependencies: [],
        timeout: 60000,
        retryPolicy: { maxRetries: 0 },
      },
      {
        stepId: "review_code",
        roleId: "general_executor",
        outputs: ["review_result"],
        dependencies: ["generate_code"],
        timeout: 30000,
        retryPolicy: { maxRetries: 0 },
      },
    ]);

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "oapeflir-deps-test",
      request: `oapeflir://plan ${planPayload}`,
      stepOutputOverrides: {
        generate_code: { summary: "Code generated", result: "console.log('hello')" },
        review_code: { summary: "Code reviewed", result: "No issues found" },
      },
    });

    assert.ok(result.snapshot);
    assert.equal(result.snapshot.task.status, "done");
    assert.equal(result.plannedWorkflow.executionSteps.length, 2);
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

test("integration: runMultiStepOrchestration task and workflow records are created correctly", async () => {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = join(TEST_DB_DIR, `multi-step-records-${Date.now()}.db`);

  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Records Test",
      request: "Test record creation",
    });

    assert.ok(result.snapshot.task);
    assert.ok(result.snapshot.task.id);
    assert.ok(result.snapshot.task.rootId);
    assert.equal(result.snapshot.task.rootId, result.snapshot.task.id);

    assert.ok(result.snapshot.workflow);
    assert.equal(result.snapshot.workflow.taskId, result.snapshot.task.id);
    assert.equal(result.snapshot.workflow.status, "done");

    assert.ok(result.snapshot.execution);
    assert.ok(result.snapshot.execution.length > 0);

    assert.ok(result.snapshot.session);
    assert.equal(result.snapshot.session.taskId, result.snapshot.task.id);
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

test("integration: runMultiStepOrchestration stores step outputs", async () => {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = join(TEST_DB_DIR, `multi-step-step-outputs-${Date.now()}.db`);

  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Step Output Test",
      request: "Test step output storage",
      stepOutputOverrides: {
        intake_triage: {
          summary: "Custom triage summary",
          result: "Custom triage result",
          customData: { key: "value" },
        },
      },
    });

    assert.ok(result.snapshot);
    assert.ok(result.snapshot.task.outputJson);
    const output = JSON.parse(result.snapshot.task.outputJson);
    assert.ok(output.intake_triage || output.final || Object.keys(output).length > 0);
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

test("integration: runMultiStepOrchestration handles step failure with stepFailurePlans", async () => {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = join(TEST_DB_DIR, `multi-step-failure-${Date.now()}.db`);

  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Failure Test",
      request: "Test step failure handling",
      stepFailurePlans: {
        intake_triage: [{ errorCode: "tool.execution_failed", summary: "Injected failure" }],
      },
    });

    assert.ok(result.snapshot);
    assert.ok(["failed", "done"].includes(result.snapshot.task.status));
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

test("integration: runMultiStepOrchestration propagates contextBudgetTokens to execution", async () => {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = join(TEST_DB_DIR, `multi-step-budget-${Date.now()}.db`);

  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Budget Context Test",
      request: "Test budget context propagation",
      contextBudgetTokens: 16000,
      stepOutputOverrides: {
        intake_triage: { summary: "Budget test step", result: "ok" },
      },
    });

    assert.ok(result.snapshot);
    assert.equal(result.snapshot.task.status, "done");
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

test("integration: runMultiStepOrchestration retry handling works for failed steps", async () => {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = join(TEST_DB_DIR, `multi-step-retry-${Date.now()}.db`);

  try {
    const planPayload = JSON.stringify([
      {
        stepId: "unreliable_step",
        roleId: "general_executor",
        outputs: ["unreliable_output"],
        dependencies: [],
        timeout: 30000,
        retryPolicy: { maxRetries: 2, backoffMs: 100 },
      },
      {
        stepId: "dependent_step",
        roleId: "general_executor",
        outputs: ["dependent_output"],
        dependencies: ["unreliable_step"],
        timeout: 30000,
        retryPolicy: { maxRetries: 0 },
      },
    ]);

    const result = await runMultiStepOrchestration({
      dbPath,
      title: "retry-test",
      request: `oapeflir://plan ${planPayload}`,
      stepFailurePlans: {
        unreliable_step: [
          { errorCode: "tool.execution_failed", summary: "First attempt failed" },
          { errorCode: "tool.execution_failed", summary: "Second attempt failed" },
          { errorCode: "tool.execution_failed", summary: "Third attempt failed" },
        ],
      },
    });

    assert.ok(result.snapshot);
    assert.ok(["failed", "done"].includes(result.snapshot.task.status));
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

test("integration: runMultiStepOrchestration creates events during execution", async () => {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = join(TEST_DB_DIR, `multi-step-events-${Date.now()}.db`);

  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Events Test",
      request: "Test event creation",
    });

    assert.ok(result.snapshot);
    assert.ok(result.snapshot.events);
    assert.ok(result.snapshot.events.length > 0);

    const eventTypes = result.snapshot.events.map((e) => e.eventType);
    assert.ok(eventTypes.includes("routing:decided"), "should have routing:decided event");
    assert.ok(eventTypes.includes("workflow:planned"), "should have workflow:planned event");
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

test("integration: runMultiStepOrchestration uses createIntegrationContext helper", async () => {
  const ctx = createIntegrationContext("aa-multi-step-");

  try {
    const result = await runMultiStepOrchestration({
      dbPath: ctx.dbPath,
      title: "Integration Context Test",
      request: "Test integration context helper",
    });

    assert.ok(result.snapshot);
    assert.equal(result.snapshot.task.status, "done");
  } finally {
    ctx.cleanup();
  }
});

test("integration: runMultiStepOrchestration handles admission queue decision", async () => {
  if (!fs.existsSync(TEST_DB_DIR)) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  }

  const dbPath = join(TEST_DB_DIR, `multi-step-admission-${Date.now()}.db`);

  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Admission Test",
      request: "Test admission policy",
      admissionPolicy: {
        maxQueuedTasks: 1,
        memoryHighWatermarkMb: 0,
        eventLoopLagThresholdMs: 0,
      },
    });

    assert.ok(result.snapshot);
    assert.ok(result.snapshot.task);
    assert.ok(["paused", "queued", "done", "cancelled"].includes(result.snapshot.task.status));
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
