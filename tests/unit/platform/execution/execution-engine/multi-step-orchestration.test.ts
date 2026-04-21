import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, unlinkSync } from "node:fs";

import {
  runMultiStepOrchestration,
  executeMultiStepToolCallForTests,
  resetMultiStepToolRegistryForTests,
  type MultiStepToolExecutionInput,
} from "../../../../../../src/platform/execution/execution-engine/multi-step-orchestration.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test("runMultiStepOrchestration basic execution", async () => {
  const dbPath = join(__dirname, "test-multi-step.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Multi-Step",
    request: "Run multi-step test",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result, "runMultiStepOrchestration should return a result");
    assert.ok("snapshot" in result, "result should have snapshot property");
    assert.ok("routing" in result, "result should have routing property");
    assert.ok("plannedWorkflow" in result, "result should have plannedWorkflow property");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runMultiStepOrchestration with oapeflir plan request", async () => {
  const dbPath = join(__dirname, "test-oapeflir.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const planSteps = [
    {
      stepId: "step_1",
      dependencies: [],
      outputs: ["output_1"],
      timeout: 30000,
      retryPolicy: { maxRetries: 0 },
    },
  ];

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Oapeflir Plan",
    request: `oapeflir://plan ${JSON.stringify(planSteps)}`,
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result, "runMultiStepOrchestration should handle oapeflir plan");
    assert.ok(result.plannedWorkflow.workflow.workflowId.startsWith("oapeflir_"), "workflowId should have oapeflir prefix");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runMultiStepOrchestration creates task snapshot", async () => {
  const dbPath = join(__dirname, "test-snapshot.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Snapshot",
    request: "Create snapshot test",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.snapshot, "result should have snapshot");
    assert.ok(result.snapshot.task, "snapshot should have task");
    assert.ok(result.snapshot.task.id, "task should have id");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runMultiStepOrchestration workflow planning", async () => {
  const dbPath = join(__dirname, "test-planning.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Planning",
    request: "Test workflow planning",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.plannedWorkflow, "result should have plannedWorkflow");
    assert.ok(result.plannedWorkflow.workflow, "plannedWorkflow should have workflow");
    assert.ok(result.plannedWorkflow.executionSteps, "plannedWorkflow should have executionSteps");
    assert.ok(Array.isArray(result.plannedWorkflow.executionSteps), "executionSteps should be array");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runMultiStepOrchestration routing", async () => {
  const dbPath = join(__dirname, "test-routing.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Routing",
    request: "Test routing",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.routing, "result should have routing");
    assert.ok("workflowId" in result.routing, "routing should have workflowId");
    assert.ok("divisionId" in result.routing, "routing should have divisionId");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("executeMultiStepToolCallForTests is exported", () => {
  assert.ok(typeof executeMultiStepToolCallForTests === "function", "executeMultiStepToolCallForTests should be a function");
});

test("resetMultiStepToolRegistryForTests is exported", () => {
  assert.ok(typeof resetMultiStepToolRegistryForTests === "function", "resetMultiStepToolRegistryForTests should be a function");
});

test("runMultiStepOrchestration streamFrames property", async () => {
  const dbPath = join(__dirname, "test-frames.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Stream Frames",
    request: "Test stream frames",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok("streamFrames" in result, "result should have streamFrames property");
    assert.ok(Array.isArray(result.streamFrames), "streamFrames should be an array");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runMultiStepOrchestration with admission backpressure snapshot", async () => {
  const dbPath = join(__dirname, "test-backpressure.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Backpressure",
    request: "Test backpressure",
    admissionBackpressureSnapshot: () => ({
      memoryUsageMb: 100,
      eventLoopLagMs: 10,
      activeWorkers: 2,
      queueDepth: 5,
    }),
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result, "runMultiStepOrchestration should handle custom backpressure snapshot");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runMultiStepOrchestration task status transitions", async () => {
  const dbPath = join(__dirname, "test-transitions.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Transitions",
    request: "Test status transitions",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    const task = result.snapshot.task;
    assert.ok(task, "task should exist");
    // Task should be in a terminal state (done, failed, or cancelled)
    assert.ok(
      task.status === "done" || task.status === "failed" || task.status === "cancelled",
      `task status should be terminal, got ${task.status}`
    );
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runMultiStepOrchestration compaction result", async () => {
  const dbPath = join(__dirname, "test-compaction.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Compaction",
    request: "Test compaction",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok("compaction" in result, "result should have compaction property");
    // compaction can be null or an object depending on context compaction
    assert.ok(result.compaction === null || typeof result.compaction === "object", "compaction should be null or object");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runMultiStepOrchestration handles workflowId in result", async () => {
  const dbPath = join(__dirname, "test-workflow-id.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Workflow ID",
    request: "Test workflow ID in result",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok(result.plannedWorkflow.workflow.workflowId, "workflow should have workflowId");
    assert.equal(typeof result.plannedWorkflow.workflow.workflowId, "string", "workflowId should be string");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runMultiStepOrchestration with custom admission policy", async () => {
  const dbPath = join(__dirname, "test-custom-policy.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Custom Policy",
    request: "Test custom admission policy",
    admissionPolicy: {
      maxConcurrentTasks: 100,
      maxQueueDepth: 1000,
      memoryHighWatermarkMb: 1024,
      eventLoopLagThresholdMs: 100,
    },
  };

  try {
    const result = await runMultiStepOrchestration(input);
    assert.ok(result, "runMultiStepOrchestration should handle custom admission policy");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});

test("runMultiStepOrchestration dependency edges in planned workflow", async () => {
  const dbPath = join(__dirname, "test-edges.db");

  if (existsSync(dbPath)) {
    unlinkSync(dbPath);
  }

  const input: MultiStepToolExecutionInput = {
    dbPath,
    title: "Test Dependency Edges",
    request: "Test dependency edges",
  };

  try {
    const result = await runMultiStepOrchestration(input);

    assert.ok("dependencyEdges" in result.plannedWorkflow, "plannedWorkflow should have dependencyEdges");
    assert.ok(Array.isArray(result.plannedWorkflow.dependencyEdges), "dependencyEdges should be array");
  } finally {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
});
