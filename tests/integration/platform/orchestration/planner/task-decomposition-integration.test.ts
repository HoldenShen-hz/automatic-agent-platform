/**
 * Integration Test: Task Decomposition Service
 *
 * Tests task decomposition for breaking down complex requests
 * into executable steps with proper dependency tracking.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { TaskDecompositionService } from "../../../../../src/platform/five-plane-orchestration/planner/task-decomposition-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import type { PlannedWorkflow, PlannedExecutionStep } from "../../../../../src/platform/five-plane-orchestration/routing/workflow-planner.js";
import type { MinimalWorkflowDefinition } from "../../../../../src/platform/five-plane-orchestration/oapeflir/workflow/minimal-workflow.js";

function createMockExecutionStep(overrides: Partial<PlannedExecutionStep> = {}): PlannedExecutionStep {
  return {
    stepId: "step_1",
    divisionId: "div_alpha",
    roleId: "planner",
    inputKeys: [],
    agentId: "agent_planner",
    outputKey: "result_1",
    outputSchemaPath: null,
    dependsOnStepIds: [],
    dependencyTypes: {},
    timeoutMs: 30000,
    maxAttempts: 3,
    ...overrides,
  };
}

function createMockWorkflow(overrides: Partial<PlannedWorkflow> & { executionSteps?: PlannedExecutionStep[] } = {}): PlannedWorkflow {
  return {
    workflow: {
      workflowId: "wf_test",
      divisionId: "div_test",
      steps: [],
    } as MinimalWorkflowDefinition,
    executionSteps: [createMockExecutionStep()],
    planReason: "Test plan",
    dependencyEdges: [],
    ...overrides,
  };
}

test("task decomposition: decomposes complex workflow into executable tasks", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_plan",
        roleId: "planner",
        outputKey: "plan",
      }),
      createMockExecutionStep({
        stepId: "step_execute",
        roleId: "executor",
        outputKey: "result",
        dependsOnStepIds: ["step_plan"],
      }),
      createMockExecutionStep({
        stepId: "step_review",
        roleId: "reviewer",
        outputKey: "review",
        dependsOnStepIds: ["step_execute"],
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.equal(result.length, 3);
  assert.deepEqual(
    result.map((item) => item.title),
    ["step_plan:plan", "step_execute:result", "step_review:review"],
  );
});

test("task decomposition: handles simple single-step workflow without implicit read tool", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_only",
        roleId: "operator",
        outputKey: "done",
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    title: "step_only:done",
    dependsOn: [],
    ownerRoleId: "operator",
    toolNames: [],
  });
});

test("task decomposition: preserves fan-in dependencies between subtasks", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "collect_a",
        outputKey: "a",
      }),
      createMockExecutionStep({
        stepId: "collect_b",
        outputKey: "b",
      }),
      createMockExecutionStep({
        stepId: "merge",
        outputKey: "merged",
        dependsOnStepIds: ["collect_a", "collect_b"],
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.deepEqual(result[2]?.dependsOn, ["collect_a", "collect_b"]);
});

test("task decomposition: exposes tool hints for compensating and schema-validated steps", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "mutate_and_validate",
        compensationModel: "idempotent_replay",
        outputSchemaPath: "/schemas/output.json",
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.deepEqual(result[0]?.toolNames, ["apply_patch", "validate_output"]);
});

// Tests using the actual TaskDecompositionService API (PlannedWorkflow-based)

test("task decomposition: decompose maps step to title format stepId:outputKey", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow();

  const result = service.decompose(workflow);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.title, "step_1:result_1");
});

test("task decomposition: decompose preserves dependsOnStepIds", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_a",
        dependsOnStepIds: ["step_x", "step_y"],
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.equal(result.length, 1);
  assert.deepEqual(result[0]?.dependsOn, ["step_x", "step_y"]);
});

test("task decomposition: decompose handles multiple steps", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_a",
        roleId: "planner",
        outputKey: "output_a",
        dependsOnStepIds: [],
      }),
      createMockExecutionStep({
        stepId: "step_b",
        roleId: "executor",
        outputKey: "output_b",
        dependsOnStepIds: ["step_a"],
      }),
      createMockExecutionStep({
        stepId: "step_c",
        roleId: "reviewer",
        outputKey: "output_c",
        dependsOnStepIds: ["step_b"],
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.equal(result.length, 3);
  assert.equal(result[0]?.title, "step_a:output_a");
  assert.equal(result[1]?.title, "step_b:output_b");
  assert.equal(result[2]?.title, "step_c:output_c");
  assert.deepEqual(result[0]?.dependsOn, []);
  assert.deepEqual(result[1]?.dependsOn, ["step_a"]);
  assert.deepEqual(result[2]?.dependsOn, ["step_b"]);
});

test("task decomposition: decompose returns empty array for workflow with no steps", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [],
  });

  const result = service.decompose(workflow);

  assert.equal(result.length, 0);
});

test("task decomposition: decompose sets ownerRoleId from step.roleId", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({ stepId: "step_a", roleId: "executor" }),
      createMockExecutionStep({ stepId: "step_b", roleId: "reviewer" }),
    ],
  });

  const result = service.decompose(workflow);

  assert.equal(result[0]?.ownerRoleId, "executor");
  assert.equal(result[1]?.ownerRoleId, "reviewer");
});

test("task decomposition: decompose only includes read tool when dependencies exist", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_a",
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.ok(!result[0]?.toolNames.includes("read"));
});

test("task decomposition: decompose includes read tool when dependencies exist", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_a",
        dependsOnStepIds: ["step_seed"],
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.ok(result[0]?.toolNames.includes("read"));
});

test("task decomposition: decompose adds apply_patch when compensationModel is present", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_a",
        compensationModel: "compensating_action",
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.ok(result[0]?.toolNames.includes("apply_patch"));
});

test("task decomposition: decompose does not add apply_patch when compensationModel is absent", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_a",
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.ok(!result[0]?.toolNames.includes("apply_patch"));
});

test("task decomposition: decompose adds validate_output when outputSchemaPath is present", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_a",
        outputSchemaPath: "/schemas/step-output.json",
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.ok(result[0]?.toolNames.includes("validate_output"));
});

test("task decomposition: decompose does not add validate_output when outputSchemaPath is null", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_a",
        outputSchemaPath: null,
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.ok(!result[0]?.toolNames.includes("validate_output"));
});

test("task decomposition: decompose handles both compensationModel and outputSchemaPath", () => {
  const service = new TaskDecompositionService();
  const workflow = createMockWorkflow({
    executionSteps: [
      createMockExecutionStep({
        stepId: "step_a",
        compensationModel: "idempotent_replay",
        outputSchemaPath: "/schemas/step-output.json",
        dependsOnStepIds: ["step_seed"],
      }),
    ],
  });

  const result = service.decompose(workflow);

  assert.ok(result[0]?.toolNames.includes("read"));
  assert.ok(result[0]?.toolNames.includes("apply_patch"));
  assert.ok(result[0]?.toolNames.includes("validate_output"));
});
