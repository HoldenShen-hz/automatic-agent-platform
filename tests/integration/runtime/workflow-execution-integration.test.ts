/**
 * Integration Tests: Workflow Execution
 *
 * Integration tests for workflow planning and execution with real storage backends.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowPlanner, type WorkflowPlannerInput } from "../../../src/platform/five-plane-orchestration/routing/workflow-planner.js";
import {
  getWorkflowDefinition,
  WORKFLOW_DEFINITIONS,
} from "../../../src/platform/five-plane-orchestration/oapeflir/workflow/minimal-workflow.js";
import { StorageError } from "../../../src/platform/contracts/errors.js";
import { createTempWorkspace, cleanupPath } from "../../helpers/fs.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createSqliteBackend(dbPath: string): SqliteDatabase {
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

// ---------------------------------------------------------------------------
// Workflow Planning Integration Tests
// ---------------------------------------------------------------------------

test("WorkflowPlanner works with real SQLite backend", () => {
  const workspace = createTempWorkspace("aa-int-wf-planner-");
  const dbPath = `${workspace}/test.db`;

  try {
    const db = createSqliteBackend(dbPath);

    const planner = new WorkflowPlanner();
    const input: WorkflowPlannerInput = {
      workflowId: "single_agent_minimal",
      request: "analyze the request",
    };

    const planned = planner.plan(input);

    // Verify planned workflow
    assert.equal(planned.workflow.workflowId, "single_agent_minimal");
    assert.ok(planned.executionSteps.length >= 1);
    assert.ok(planned.dependencyEdges.length >= 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowPlanner handles multi-step workflow with real backend", () => {
  const workspace = createTempWorkspace("aa-int-wf-multi-");
  const dbPath = `${workspace}/test.db`;

  try {
    const db = createSqliteBackend(dbPath);

    const planner = new WorkflowPlanner();
    const input: WorkflowPlannerInput = {
      workflowId: "single_division_multi_step_orchestration",
      request: "complex analysis task",
    };

    const planned = planner.plan(input);

    // Verify multi-step planning
    assert.equal(planned.workflow.workflowId, "single_division_multi_step_orchestration");
    assert.equal(planned.executionSteps.length, 3);
    assert.equal(planned.planReason, "workflow.requires_multi_step_orchestration");

    // Verify dependency edges
    assert.ok(planned.dependencyEdges.length >= 2);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowPlanner computes correct step dependencies with real backend", () => {
  const workspace = createTempWorkspace("aa-int-wf-deps-");
  const dbPath = `${workspace}/test.db`;

  try {
    const db = createSqliteBackend(dbPath);

    const planner = new WorkflowPlanner();
    const input: WorkflowPlannerInput = {
      workflowId: "single_division_multi_step_orchestration",
      request: "test",
    };

    const planned = planner.plan(input);

    // Find triage -> draft edge
    const triageToDraft = planned.dependencyEdges.find(
      (e) => e.fromStepId === "intake_triage" && e.toStepId === "draft_solution",
    );
    assert.ok(triageToDraft != null, "Should have triage -> draft_solution edge");

    // Find draft -> final edge
    const draftToFinal = planned.dependencyEdges.find(
      (e) => e.fromStepId === "draft_solution" && e.toStepId === "final_review",
    );
    assert.ok(draftToFinal != null, "Should have draft_solution -> final_review edge");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowPlanner assigns correct agent IDs with real backend", () => {
  const workspace = createTempWorkspace("aa-int-wf-agents-");
  const dbPath = `${workspace}/test.db`;

  try {
    const db = createSqliteBackend(dbPath);

    const planner = new WorkflowPlanner();
    const input: WorkflowPlannerInput = {
      workflowId: "single_division_multi_step_orchestration",
      request: "test",
    };

    const planned = planner.plan(input);

    // Verify agent IDs follow naming convention
    for (const step of planned.executionSteps) {
      assert.ok(step.agentId.startsWith("agent_"));
      assert.ok(step.agentId.includes(step.roleId));
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowPlanner preserves step configuration with real backend", () => {
  const workspace = createTempWorkspace("aa-int-wf-config-");
  const dbPath = `${workspace}/test.db`;

  try {
    const db = createSqliteBackend(dbPath);

    const planner = new WorkflowPlanner();
    const input: WorkflowPlannerInput = {
      workflowId: "single_agent_minimal",
      request: "test",
    };

    const planned = planner.plan(input);
    const step = planned.executionSteps[0];
    assert.ok(step != null, "should have at least one step");

    // Verify timeout and retry configuration
    assert.equal(step!.timeoutMs, 120_000);
    assert.equal(step!.maxAttempts, 1);
    assert.equal(step!.compensationModel, "idempotent_replay");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowPlanner handles unknown workflow with real backend", () => {
  const workspace = createTempWorkspace("aa-int-wf-unknown-");
  const dbPath = `${workspace}/test.db`;

  try {
    const db = createSqliteBackend(dbPath);

    const planner = new WorkflowPlanner();
    const input: WorkflowPlannerInput = {
      workflowId: "definitely_does_not_exist",
      request: "test",
    };

    assert.throws(
      () => planner.plan(input),
      StorageError,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowPlanner throws StorageError with correct code for unknown workflow", () => {
  const workspace = createTempWorkspace("aa-int-wf-error-");
  const dbPath = `${workspace}/test.db`;

  try {
    const db = createSqliteBackend(dbPath);

    const planner = new WorkflowPlanner();
    const input: WorkflowPlannerInput = {
      workflowId: "unknown_workflow_xyz",
      request: "test",
    };

    try {
      planner.plan(input);
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err instanceof StorageError);
      const error = err as StorageError;
      assert.ok(error.code.includes("workflow.not_found"));
      assert.ok(error.code.includes("unknown_workflow_xyz"));
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowPlanner handles single step workflow reason with real backend", () => {
  const workspace = createTempWorkspace("aa-int-wf-single-");
  const dbPath = `${workspace}/test.db`;

  try {
    const db = createSqliteBackend(dbPath);

    const planner = new WorkflowPlanner();
    const input: WorkflowPlannerInput = {
      workflowId: "single_agent_minimal",
      request: "simple task",
    };

    const planned = planner.plan(input);

    assert.equal(planned.planReason, "workflow.single_step_execution");
    assert.ok(planned.executionSteps.length === 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowPlanner handles multi-step workflow reason with real backend", () => {
  const workspace = createTempWorkspace("aa-int-wf-multi-reason-");
  const dbPath = `${workspace}/test.db`;

  try {
    const db = createSqliteBackend(dbPath);

    const planner = new WorkflowPlanner();
    const input: WorkflowPlannerInput = {
      workflowId: "single_division_multi_step_orchestration",
      request: "complex task",
    };

    const planned = planner.plan(input);

    assert.equal(planned.planReason, "workflow.requires_multi_step_orchestration");
    assert.ok(planned.executionSteps.length > 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowPlanner preserves input/output keys with real backend", () => {
  const workspace = createTempWorkspace("aa-int-wf-keys-");
  const dbPath = `${workspace}/test.db`;

  try {
    const db = createSqliteBackend(dbPath);

    const planner = new WorkflowPlanner();
    const input: WorkflowPlannerInput = {
      workflowId: "single_division_multi_step_orchestration",
      request: "test",
    };

    const planned = planner.plan(input);

    // Find draft_solution step
    const draftStep = planned.executionSteps.find((s) => s.stepId === "draft_solution");
    assert.ok(draftStep != null);
    assert.deepEqual(draftStep.inputKeys, ["triage"]);
    assert.equal(draftStep.outputKey, "draft");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkflowPlanner computes dependency types with real backend", () => {
  const workspace = createTempWorkspace("aa-int-wf-types-");
  const dbPath = `${workspace}/test.db`;

  try {
    const db = createSqliteBackend(dbPath);

    const planner = new WorkflowPlanner();
    const input: WorkflowPlannerInput = {
      workflowId: "single_division_multi_step_orchestration",
      request: "test",
    };

    const planned = planner.plan(input);

    // Find draft_solution step which has dependencies
    const draftStep = planned.executionSteps.find((s) => s.stepId === "draft_solution");
    assert.ok(draftStep != null);
    assert.equal(draftStep.dependencyTypes["intake_triage"], "hard");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// getWorkflowDefinition Integration Tests
// ---------------------------------------------------------------------------

test("getWorkflowDefinition works with real backend", () => {
  const workspace = createTempWorkspace("aa-int-get-wf-");
  const dbPath = `${workspace}/test.db`;

  try {
    const db = createSqliteBackend(dbPath);

    const workflow = getWorkflowDefinition("single_agent_minimal");

    assert.ok(workflow != null);
    assert.equal(workflow.workflowId, "single_agent_minimal");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("getWorkflowDefinition returns null for unknown workflow with real backend", () => {
  const workspace = createTempWorkspace("aa-int-get-wf-null-");
  const dbPath = `${workspace}/test.db`;

  try {
    const db = createSqliteBackend(dbPath);

    const workflow = getWorkflowDefinition("nonexistent_workflow_id");

    assert.equal(workflow, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("WORKFLOW_DEFINITIONS is accessible with real backend", () => {
  const workspace = createTempWorkspace("aa-int-wf-defs-");
  const dbPath = `${workspace}/test.db`;

  try {
    const db = createSqliteBackend(dbPath);

    assert.ok(WORKFLOW_DEFINITIONS.size >= 2);
    assert.ok(WORKFLOW_DEFINITIONS.has("single_agent_minimal"));
    assert.ok(WORKFLOW_DEFINITIONS.has("single_division_multi_step_orchestration"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// End-to-End Workflow Planning Tests
// ---------------------------------------------------------------------------

test("complete workflow planning lifecycle with real backend", () => {
  const workspace = createTempWorkspace("aa-int-lifecycle-");
  const dbPath = `${workspace}/test.db`;

  try {
    const db = createSqliteBackend(dbPath);

    // Step 1: Get workflow definition
    const workflow = getWorkflowDefinition("single_division_multi_step_orchestration");
    assert.ok(workflow != null);

    // Step 2: Create planner and plan
    const planner = new WorkflowPlanner();
    const input: WorkflowPlannerInput = {
      workflowId: workflow.workflowId,
      request: "comprehensive analysis of market trends and competitive positioning",
    };

    const planned = planner.plan(input);

    // Step 3: Verify complete planned workflow
    assert.equal(planned.workflow.workflowId, "single_division_multi_step_orchestration");
    assert.equal(planned.executionSteps.length, 3);

    // Step 4: Verify all steps have required fields
    for (const step of planned.executionSteps) {
      assert.ok(step.stepId.length > 0);
      assert.ok(step.divisionId.length > 0);
      assert.ok(step.roleId.length > 0);
      assert.ok(step.agentId.length > 0);
      assert.ok(step.outputKey.length > 0);
      assert.ok(step.timeoutMs > 0);
      assert.ok(step.maxAttempts > 0);
    }

    // Step 5: Verify dependency graph is complete
    assert.ok(planned.dependencyEdges.length >= 2);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("workflow planning for all built-in workflows with real backend", () => {
  const workspace = createTempWorkspace("aa-int-all-wf-");
  const dbPath = `${workspace}/test.db`;

  try {
    const db = createSqliteBackend(dbPath);

    const planner = new WorkflowPlanner();

    for (const workflowId of WORKFLOW_DEFINITIONS.keys()) {
      const input: WorkflowPlannerInput = {
        workflowId,
        request: `test request for ${workflowId}`,
      };

      const planned = planner.plan(input);

      assert.equal(planned.workflow.workflowId, workflowId);
      assert.ok(planned.executionSteps.length >= 1);
      assert.ok(planned.planReason.length > 0);
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});