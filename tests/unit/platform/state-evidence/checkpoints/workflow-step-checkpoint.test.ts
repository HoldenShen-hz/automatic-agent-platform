import assert from "node:assert/strict";
import test from "node:test";

import {
  createWorkflowStepCheckpoint,
  summarizeWorkflowStepCheckpoint,
  WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
} from "../../../../../src/platform/five-plane-state-evidence/checkpoints/workflow-step-checkpoint.js";

/**
 * Tests for WorkflowStepCheckpoint focusing on:
 * - Checkpoint with nodeRunId/planGraphBundleId per R4-18
 * - Graph version tracking per R8-10
 *
 * @see R4-18: Task must be keyed by canonical ID (taskId) and executionId
 * @see R8-10: Graph version tracking for plan graph evolution
 */
test("createWorkflowStepCheckpoint includes nodeRunId per R4-18", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_123",
    nodeRunId: "node_run_456",
    planGraphBundleId: "bundle_789",
    taskId: "task_abc",
    executionId: "exec_def",
    workflowId: "wf_ghi",
    divisionId: "div_jkl",
    stepId: "step_mno",
    roleId: "role_pqr",
    outputKey: "output_stu",
    status: "succeeded",
    producedAt: "2026-04-01T10:00:00.000Z",
    output: { result: "success" },
    decisionContext: {
      source: "planner",
      request: "execute step",
      routeReason: "completed",
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: ["step_mno"],
      nextStepId: null,
      outputKeys: ["output_stu"],
    },
  });

  assert.equal(checkpoint.nodeRunId, "node_run_456");
});

test("createWorkflowStepCheckpoint includes planGraphBundleId per R4-18", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_123",
    nodeRunId: "node_run_456",
    planGraphBundleId: "bundle_789",
    taskId: "task_abc",
    executionId: "exec_def",
    workflowId: "wf_ghi",
    divisionId: "div_jkl",
    stepId: "step_mno",
    roleId: "role_pqr",
    outputKey: "output_stu",
    status: "succeeded",
    producedAt: "2026-04-01T10:00:00.000Z",
    output: { result: "success" },
    decisionContext: {
      source: "planner",
      request: "execute step",
      routeReason: "completed",
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  assert.equal(checkpoint.planGraphBundleId, "bundle_789");
});

test("createWorkflowStepCheckpoint allows null nodeRunId for early stage checkpoints", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_123",
    nodeRunId: null,
    planGraphBundleId: "bundle_789",
    taskId: "task_abc",
    executionId: "exec_def",
    workflowId: "wf_ghi",
    divisionId: "div_jkl",
    stepId: "step_initial",
    roleId: "role_pqr",
    outputKey: "output_stu",
    status: "succeeded",
    producedAt: "2026-04-01T10:00:00.000Z",
    output: {},
    decisionContext: {
      source: "planner",
      request: "init",
      routeReason: "first step",
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: "step_1",
      outputKeys: [],
    },
  });

  assert.equal(checkpoint.nodeRunId, null);
});

test("createWorkflowStepCheckpoint preserves harnessRunId for graph version tracking per R8-10", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_v2_graph",
    nodeRunId: "node_run_1",
    planGraphBundleId: "bundle_v2",
    taskId: "task_abc",
    executionId: "exec_def",
    workflowId: "wf_ghi",
    divisionId: "div_jkl",
    stepId: "step_mno",
    roleId: "role_pqr",
    outputKey: "output_stu",
    status: "succeeded",
    producedAt: "2026-04-01T10:00:00.000Z",
    output: { version: "2.0" },
    decisionContext: {
      source: "planner",
      request: "execute step",
      routeReason: "completed",
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  assert.equal(checkpoint.harnessRunId, "harness_v2_graph");
  assert.equal(checkpoint.schemaVersion, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION);
});

test("createWorkflowStepCheckpoint includes all graph tracking fields together", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_graph_tracking",
    nodeRunId: "node_abc123",
    planGraphBundleId: "bundle_graph_v3",
    taskId: "task_xyz",
    executionId: "exec_456",
    workflowId: "wf_test",
    divisionId: "div_test",
    stepId: "step_tracking",
    roleId: "role_test",
    outputKey: "output_tracking",
    status: "succeeded",
    producedAt: "2026-04-15T12:00:00.000Z",
    output: { graphVersion: "v3" },
    decisionContext: {
      source: "graph_planner",
      request: "generate plan graph",
      routeReason: "graph evolution",
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  // Verify all R4-18 canonical IDs are present
  assert.equal(checkpoint.taskId, "task_xyz");
  assert.equal(checkpoint.executionId, "exec_456");
  assert.equal(checkpoint.nodeRunId, "node_abc123");
  assert.equal(checkpoint.planGraphBundleId, "bundle_graph_v3");
  assert.equal(checkpoint.harnessRunId, "harness_graph_tracking");
});

test("createWorkflowStepCheckpoint tracks graph evolution via planGraphBundleId", () => {
  // Simulate multiple checkpoints with evolving graph versions
  const checkpointV1 = createWorkflowStepCheckpoint({
    harnessRunId: "harness_v1",
    nodeRunId: "node_1",
    planGraphBundleId: "bundle_v1_initial",
    taskId: "task_evo",
    executionId: "exec_evo",
    workflowId: "wf_evo",
    divisionId: "div_evo",
    stepId: "step_v1",
    roleId: "role_evo",
    outputKey: "output_v1",
    status: "succeeded",
    producedAt: "2026-04-01T10:00:00.000Z",
    output: {},
    decisionContext: {
      source: "planner_v1",
      request: "initial plan",
      routeReason: "first version",
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  const checkpointV2 = createWorkflowStepCheckpoint({
    harnessRunId: "harness_v2",
    nodeRunId: "node_2",
    planGraphBundleId: "bundle_v2_evolved",
    taskId: "task_evo",
    executionId: "exec_evo",
    workflowId: "wf_evo",
    divisionId: "div_evo",
    stepId: "step_v2",
    roleId: "role_evo",
    outputKey: "output_v2",
    status: "succeeded",
    producedAt: "2026-04-01T11:00:00.000Z",
    output: {},
    decisionContext: {
      source: "planner_v2",
      request: "evolved plan",
      routeReason: "graph updated",
      priorStepSummaries: ["step_v1 completed"],
      dependsOnStepIds: ["step_v1"],
    },
    resumeContext: {
      completedStepIds: ["step_v1"],
      nextStepId: null,
      outputKeys: [],
    },
  });

  // Verify different graph versions
  assert.equal(checkpointV1.planGraphBundleId, "bundle_v1_initial");
  assert.equal(checkpointV2.planGraphBundleId, "bundle_v2_evolved");
  assert.notEqual(checkpointV1.planGraphBundleId, checkpointV2.planGraphBundleId);

  // Verify step evolution
  assert.deepEqual(checkpointV2.decisionContext.priorStepSummaries, ["step_v1 completed"]);
  assert.deepEqual(checkpointV2.decisionContext.dependsOnStepIds, ["step_v1"]);
});

test("createWorkflowStepCheckpoint schema version is consistent", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_schema",
    nodeRunId: "node_schema",
    planGraphBundleId: "bundle_schema",
    taskId: "task_schema",
    executionId: "exec_schema",
    workflowId: "wf_schema",
    divisionId: "div_schema",
    stepId: "step_schema",
    roleId: "role_schema",
    outputKey: "output_schema",
    status: "succeeded",
    producedAt: "2026-04-01T10:00:00.000Z",
    output: {},
    decisionContext: {
      source: "test",
      request: "test",
      routeReason: null,
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  assert.equal(checkpoint.schemaVersion, "workflow_step_checkpoint.v1");
  assert.equal(checkpoint.schemaVersion, WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION);
});

test("summarizeWorkflowStepCheckpoint extracts nodeRunId context", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_summary",
    nodeRunId: "node_summary_run",
    planGraphBundleId: "bundle_summary",
    taskId: "task_summary",
    executionId: "exec_summary",
    workflowId: "wf_summary",
    divisionId: "div_summary",
    stepId: "step_summary",
    roleId: "role_summary",
    outputKey: "output_summary",
    status: "succeeded",
    producedAt: "2026-04-20T15:30:00.000Z",
    output: { summary: "checkpoint summary test" },
    decisionContext: {
      source: "test",
      request: "test request",
      routeReason: "testing",
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  const summary = summarizeWorkflowStepCheckpoint("artifact_summary_1", checkpoint);

  assert.equal(summary.artifactId, "artifact_summary_1");
  assert.equal(summary.stepId, "step_summary");
  assert.equal(summary.workflowId, "wf_summary");
  assert.equal(summary.status, "succeeded");
  assert.equal(summary.producedAt, "2026-04-20T15:30:00.000Z");
  assert.equal(summary.source, "test");
});

test("summarizeWorkflowStepCheckpoint handles null nodeRunId", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_null_node",
    nodeRunId: null,
    planGraphBundleId: "bundle_null_node",
    taskId: "task_null_node",
    executionId: "exec_null_node",
    workflowId: "wf_null_node",
    divisionId: "div_null_node",
    stepId: "step_null_node",
    roleId: "role_null_node",
    outputKey: "output_null_node",
    status: "succeeded",
    producedAt: "2026-04-20T16:00:00.000Z",
    output: {},
    decisionContext: {
      source: "test",
      request: "test",
      routeReason: null,
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  assert.equal(checkpoint.nodeRunId, null);

  const summary = summarizeWorkflowStepCheckpoint("artifact_null", checkpoint);
  assert.equal(summary.stepId, "step_null_node");
});

test("createWorkflowStepCheckpoint preserves decision context source for graph tracking", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_decision",
    nodeRunId: "node_decision",
    planGraphBundleId: "bundle_decision",
    taskId: "task_decision",
    executionId: "exec_decision",
    workflowId: "wf_decision",
    divisionId: "div_decision",
    stepId: "step_decision",
    roleId: "role_decision",
    outputKey: "output_decision",
    status: "succeeded",
    producedAt: "2026-04-20T17:00:00.000Z",
    output: {},
    decisionContext: {
      source: "graph_planner_v3",
      request: "generate v3 plan graph",
      routeReason: "evolved from v2",
      priorStepSummaries: ["step_v2", "step_v1"],
      dependsOnStepIds: ["step_v2"],
    },
    resumeContext: {
      completedStepIds: ["step_v2", "step_v1"],
      nextStepId: null,
      outputKeys: [],
    },
  });

  assert.equal(checkpoint.decisionContext.source, "graph_planner_v3");
  assert.equal(checkpoint.decisionContext.routeReason, "evolved from v2");
  assert.deepEqual(checkpoint.decisionContext.priorStepSummaries, ["step_v2", "step_v1"]);
  assert.deepEqual(checkpoint.decisionContext.dependsOnStepIds, ["step_v2"]);
});

test("createWorkflowStepCheckpoint creates defensive copies to prevent mutation", () => {
  const priorStepSummaries = ["step_1", "step_2"];
  const dependsOnStepIds = ["step_1"];

  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_defensive",
    nodeRunId: "node_defensive",
    planGraphBundleId: "bundle_defensive",
    taskId: "task_defensive",
    executionId: "exec_defensive",
    workflowId: "wf_defensive",
    divisionId: "div_defensive",
    stepId: "step_defensive",
    roleId: "role_defensive",
    outputKey: "output_defensive",
    status: "succeeded",
    producedAt: "2026-04-20T18:00:00.000Z",
    output: {},
    decisionContext: {
      source: "test",
      request: "test",
      routeReason: null,
      priorStepSummaries,
      dependsOnStepIds,
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  // Mutate original arrays
  priorStepSummaries.push("step_3");
  dependsOnStepIds.push("step_2");

  // Checkpoint should not be affected
  assert.equal(checkpoint.decisionContext.priorStepSummaries.length, 2);
  assert.equal(checkpoint.decisionContext.dependsOnStepIds.length, 1);
  assert.equal(checkpoint.decisionContext.priorStepSummaries[0], "step_1");
  assert.equal(checkpoint.decisionContext.priorStepSummaries[1], "step_2");
});

test("createWorkflowStepCheckpoint handles failed status with graph tracking", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_failed",
    nodeRunId: "node_failed",
    planGraphBundleId: "bundle_failed",
    taskId: "task_failed",
    executionId: "exec_failed",
    workflowId: "wf_failed",
    divisionId: "div_failed",
    stepId: "step_failed",
    roleId: "role_failed",
    outputKey: "output_failed",
    status: "failed",
    producedAt: "2026-04-20T19:00:00.000Z",
    output: { error: "graph validation failed" },
    decisionContext: {
      source: "graph_planner",
      request: "validate graph",
      routeReason: "failed validation",
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  assert.equal(checkpoint.status, "failed");
  assert.deepEqual(checkpoint.output, { error: "graph validation failed" });
});

test("createWorkflowStepCheckpoint includes executionId for task-execution correlation per R4-18", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_exec",
    nodeRunId: "node_exec",
    planGraphBundleId: "bundle_exec",
    taskId: "task_exec_correlation",
    executionId: "exec_abc123",
    workflowId: "wf_exec",
    divisionId: "div_exec",
    stepId: "step_exec",
    roleId: "role_exec",
    outputKey: "output_exec",
    status: "succeeded",
    producedAt: "2026-04-21T10:00:00.000Z",
    output: {},
    decisionContext: {
      source: "test",
      request: "test",
      routeReason: null,
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  // R4-18 requires taskId and executionId as canonical ID pair
  assert.equal(checkpoint.taskId, "task_exec_correlation");
  assert.equal(checkpoint.executionId, "exec_abc123");
});

test("createWorkflowStepCheckpoint handles null executionId for planning phase", () => {
  const checkpoint = createWorkflowStepCheckpoint({
    harnessRunId: "harness_planning",
    nodeRunId: "node_planning",
    planGraphBundleId: "bundle_planning",
    taskId: "task_planning",
    executionId: null,
    workflowId: "wf_planning",
    divisionId: "div_planning",
    stepId: "step_planning",
    roleId: "role_planning",
    outputKey: "output_planning",
    status: "succeeded",
    producedAt: "2026-04-21T11:00:00.000Z",
    output: {},
    decisionContext: {
      source: "planner",
      request: "initial planning",
      routeReason: "no execution yet",
      priorStepSummaries: [],
      dependsOnStepIds: [],
    },
    resumeContext: {
      completedStepIds: [],
      nextStepId: null,
      outputKeys: [],
    },
  });

  assert.equal(checkpoint.executionId, null);
});
