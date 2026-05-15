/**
 * Integration Test: Planner
 *
 * Tests the planning logic including WorkflowPlanner execution plan creation,
 * TaskDecompositionService decomposition, and plan validation using SQLite context.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext, createSeededIntegrationContext } from "../../../helpers/integration-context.js";
import { WorkflowPlanner, type WorkflowPlannerInput } from "../../../../src/platform/five-plane-orchestration/routing/workflow-planner.js";
import { TaskDecompositionService } from "../../../../src/platform/five-plane-orchestration/planner/task-decomposition-service.js";
import { PlanBuilder } from "../../../../src/platform/five-plane-orchestration/planner/plan-builder.js";
import { parseTaskSituation, parseUnifiedAssessment } from "../../../../src/platform/five-plane-orchestration/oapeflir/types/index.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { getWorkflowDefinition } from "../../../../src/platform/five-plane-orchestration/oapeflir/workflow/minimal-workflow.js";

function createTestTaskSituation(taskId: string) {
  return parseTaskSituation({
    taskId,
    timestamp: Date.now(),
    objective: "test objective",
    currentPhase: "planning",
    userIntent: {
      raw: "test request",
      normalized: "test request",
      confidence: 0.85,
    },
    blockers: [],
    codebaseSnapshot: {
      rootPath: "/test",
      fileCount: 5,
      relevantFiles: [],
      gitRef: "abc123",
    },
    environmentContext: {
      nodeVersion: "20.0.0",
      platform: "darwin",
      workingDirectory: "/test",
      availableTools: ["bash", "read", "write"],
    },
    historicalContext: {
      previousTaskIds: [],
      relatedMemoryRefs: [],
    },
  });
}

function createTestAssessment(taskId: string, situationRef: string) {
  return parseUnifiedAssessment({
    taskId,
    timestamp: Date.now(),
    situationRef,
    phase: "post-execution",
    complexity: "moderate",
    risk: "medium",
    riskAssessment: {
      level: "medium",
      factors: ["multi_step", "review_required"],
    },
    routingDecision: {
      division: "general_ops",
      workflow: "single_division_multi_step_orchestration",
      rationale: "test routing",
    },
    resourceAllocation: {
      modelClass: "claude-sonnet",
      maxTokens: 4000,
      timeoutMs: 60_000,
    },
    approvalPolicy: {
      required: false,
    },
    executionMode: "auto",
  });
}

test("Planner WorkflowPlanner creates single-step plan from single_agent_minimal", () => {
  const ctx = createIntegrationContext("aa-planner-single-");
  try {
    const planner = new WorkflowPlanner();

    const input: WorkflowPlannerInput = {
      workflowId: "single_agent_minimal",
      request: "analyze this request",
    };

    const result = planner.plan(input);

    assert.equal(result.workflow.workflowId, "single_agent_minimal");
    assert.equal(result.executionSteps.length, 1);
    assert.equal(result.executionSteps[0]!.stepId, "analyze_request");
    assert.equal(result.executionSteps[0]!.roleId, "general_executor");
    assert.equal(result.executionSteps[0]!.agentId, "agent_general_executor");
    assert.equal(result.executionSteps[0]!.outputKey, "analysis");
    assert.deepEqual(result.executionSteps[0]!.dependsOnStepIds, []);
    assert.equal(result.planReason, "workflow.single_step_execution");
    assert.deepEqual(result.dependencyEdges, []);
  } finally {
    ctx.cleanup();
  }
});

test("Planner WorkflowPlanner creates multi-step plan with dependency edges", () => {
  const ctx = createIntegrationContext("aa-planner-multi-");
  try {
    const planner = new WorkflowPlanner();

    const input: WorkflowPlannerInput = {
      workflowId: "single_division_multi_step_orchestration",
      request: "plan and execute a complex workflow",
    };

    const result = planner.plan(input);

    assert.equal(result.workflow.workflowId, "single_division_multi_step_orchestration");
    assert.ok(result.executionSteps.length >= 2, "Should have multiple steps");
    assert.equal(result.planReason, "workflow.requires_multi_step_orchestration");

    // Verify dependency edges
    for (const edge of result.dependencyEdges) {
      const fromStep = result.executionSteps.find((s) => s.stepId === edge.fromStepId);
      const toStep = result.executionSteps.find((s) => s.stepId === edge.toStepId);
      assert.ok(fromStep, `Edge fromStep ${edge.fromStepId} should exist`);
      assert.ok(toStep, `Edge toStep ${edge.toStepId} should exist`);
      assert.ok(toStep!.dependsOnStepIds.includes(edge.fromStepId), "Edge should reflect step dependency");
    }
  } finally {
    ctx.cleanup();
  }
});

test("Planner WorkflowPlanner throws StorageError for unknown workflow", () => {
  const ctx = createIntegrationContext("aa-planner-not-found-");
  try {
    const planner = new WorkflowPlanner();

    const input: WorkflowPlannerInput = {
      workflowId: "non_existent_workflow",
      request: "test request",
    };

    assert.throws(
      () => planner.plan(input),
      (err: unknown) => {
        const error = err as { message?: string };
        return error.message?.includes("workflow.not_found:non_existent_workflow") ?? false;
      },
    );
  } finally {
    ctx.cleanup();
  }
});

test("Planner WorkflowPlanner computes agent IDs from role IDs", () => {
  const ctx = createIntegrationContext("aa-planner-agent-id-");
  try {
    const planner = new WorkflowPlanner();

    const input: WorkflowPlannerInput = {
      workflowId: "single_division_multi_step_orchestration",
      request: "multi-step task",
    };

    const result = planner.plan(input);

    for (const step of result.executionSteps) {
      assert.equal(step.agentId, `agent_${step.roleId}`, `Agent ID should be agent_${step.roleId}`);
    }
  } finally {
    ctx.cleanup();
  }
});

test("Planner TaskDecompositionService decomposes workflow into tasks", () => {
  const ctx = createIntegrationContext("aa-planner-decompose-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_division_multi_step_orchestration",
      request: "decomposition test",
    });

    const decompositionService = new TaskDecompositionService();
    const decompositions = decompositionService.decompose(planned);

    assert.equal(decompositions.length, planned.executionSteps.length, "Should have one decomposition per step");
    for (const decomposition of decompositions) {
      assert.ok(decomposition.title.length > 0, "Should have title");
      assert.ok(decomposition.ownerRoleId.length > 0, "Should have ownerRoleId");
      assert.ok(decomposition.toolNames.length > 0, "Should have toolNames");
    }
  } finally {
    ctx.cleanup();
  }
});

test("Planner TaskDecompositionService preserves step dependencies", () => {
  const ctx = createIntegrationContext("aa-planner-deps-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_division_multi_step_orchestration",
      request: "dependency test",
    });

    const decompositionService = new TaskDecompositionService();
    const decompositions = decompositionService.decompose(planned);

    // Find decomposition for draft_solution which depends on intake_triage
    const draftDecomposition = decompositions.find((d) => d.title.includes("draft_solution"));
    assert.ok(draftDecomposition, "Should have draft_solution decomposition");
    assert.ok(draftDecomposition!.dependsOn.includes("intake_triage"), "Should preserve dependency on intake_triage");
  } finally {
    ctx.cleanup();
  }
});

test("Planner TaskDecompositionService assigns correct tools per step", () => {
  const ctx = createIntegrationContext("aa-planner-tools-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_agent_minimal",
      request: "tools test",
    });

    const decompositionService = new TaskDecompositionService();
    const decompositions = decompositionService.decompose(planned);

    // All decompositions should include "read" tool
    for (const decomposition of decompositions) {
      assert.ok(decomposition.toolNames.includes("read"), "Should include read tool");
    }
  } finally {
    ctx.cleanup();
  }
});

test("Planner PlanBuilder creates plan from workflow and assessment", () => {
  const ctx = createIntegrationContext("aa-planner-builder-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_division_multi_step_orchestration",
      request: "build test",
    });

    const situation = createTestTaskSituation("task-planner-001");
    const assessment = createTestAssessment("task-planner-001", `assessment:task-planner-001:${Date.now()}`);

    const builder = new PlanBuilder();
    const result = builder.build({
      observation: situation,
      assessment,
      workflow: planned,
    });

    assert.ok(result.planId, "Should have planId");
    assert.equal(result.taskId, "task-planner-001");
    assert.ok(result.steps.length > 0, "Should have steps");
  } finally {
    ctx.cleanup();
  }
});

test("Planner PlanBuilder orders steps respecting dependency order", () => {
  const ctx = createIntegrationContext("aa-planner-order-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_division_multi_step_orchestration",
      request: "order test",
    });

    const situation = createTestTaskSituation("task-order-001");
    const assessment = createTestAssessment("task-order-001", `assessment:task-order-001:${Date.now()}`);

    const builder = new PlanBuilder();
    const result = builder.build({
      observation: situation,
      assessment,
      workflow: planned,
    });

    const stepIds = result.steps.map((s) => s.stepId);
    const intakeIndex = stepIds.indexOf("intake_triage");
    const draftIndex = stepIds.indexOf("draft_solution");
    const finalIndex = stepIds.indexOf("final_review");

    assert.ok(intakeIndex < draftIndex, "intake_triage should come before draft_solution");
    assert.ok(draftIndex < finalIndex, "draft_solution should come before final_review");
  } finally {
    ctx.cleanup();
  }
});

test("Planner PlanBuilder replan increments version correctly", () => {
  const ctx = createIntegrationContext("aa-planner-replan-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_agent_minimal",
      request: "replan test",
    });

    const situation = createTestTaskSituation("task-replan-001");
    const assessment = createTestAssessment("task-replan-001", `assessment:task-replan-001:${Date.now()}`);

    const builder = new PlanBuilder();
    const original = builder.build({
      observation: situation,
      assessment,
      workflow: planned,
    });

    const replanned = builder.replan(original, {
      observation: situation,
      assessment,
      workflow: planned,
    });

    assert.equal(replanned.version, original.version + 1);
    assert.equal(replanned.parentVersion, original.version);
    assert.ok(replanned.planId !== original.planId, "Should have new planId");
  } finally {
    ctx.cleanup();
  }
});

test("Planner WorkflowPlanner uses seeded context for task persistence", () => {
  const ctx = createSeededIntegrationContext("aa-planner-seeded-");

  try {
    const now = nowIso();
    const taskId = "task-planner-integration";
    const executionId = "exec-planner-integration";

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "coding",
        tenantId: null,
        title: "Planner integration test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ workflowId: "single_agent_minimal", request: "test" }),
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: `trace-${executionId}`,
        attempt: 1,
        timeoutMs: 120_000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const execution = ctx.store.getExecution(executionId);
    assert.ok(execution, "Should retrieve execution from seeded store");
    assert.equal(execution!.workflowId, "single_agent_minimal");
  } finally {
    ctx.cleanup();
  }
});

test("Planner WorkflowPlanner stores output schema path when defined", () => {
  const ctx = createIntegrationContext("aa-planner-schema-");
  try {
    const planner = new WorkflowPlanner();

    const input: WorkflowPlannerInput = {
      workflowId: "single_agent_minimal",
      request: "test schema path",
    };

    const result = planner.plan(input);

    assert.ok(result.executionSteps[0]!.outputSchemaPath, "Should have outputSchemaPath");
    assert.ok(result.executionSteps[0]!.outputSchemaPath!.includes("minimal-output.json"));
  } finally {
    ctx.cleanup();
  }
});

test("Planner WorkflowPlanner preserves workflow division ID in steps", () => {
  const ctx = createIntegrationContext("aa-planner-division-");
  try {
    const planner = new WorkflowPlanner();

    const input: WorkflowPlannerInput = {
      workflowId: "single_agent_minimal",
      request: "test division",
    };

    const result = planner.plan(input);

    assert.equal(result.workflow.divisionId, "general_ops");
    assert.equal(result.executionSteps[0]!.divisionId, "general_ops");
  } finally {
    ctx.cleanup();
  }
});

test("Planner PlanBuilder assigns retry policies based on step maxAttempts", () => {
  const ctx = createIntegrationContext("aa-planner-retry-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_division_multi_step_orchestration",
      request: "retry test",
    });

    const situation = createTestTaskSituation("task-retry-001");
    const assessment = createTestAssessment("task-retry-001", `assessment:task-retry-001:${Date.now()}`);

    const builder = new PlanBuilder();
    const result = builder.build({
      observation: situation,
      assessment,
      workflow: planned,
    });

    // draft_solution has maxAttempts: 2
    const draftStep = result.steps.find((s) => s.stepId === "draft_solution");
    assert.ok(draftStep, "Should have draft_solution step");
    assert.equal(draftStep!.retryPolicy.maxRetries, 1); // maxAttempts - 1
  } finally {
    ctx.cleanup();
  }
});

test("Planner PlanBuilder sets timeout values per step from workflow", () => {
  const ctx = createIntegrationContext("aa-planner-timeout-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_division_multi_step_orchestration",
      request: "timeout test",
    });

    const situation = createTestTaskSituation("task-timeout-001");
    const assessment = createTestAssessment("task-timeout-001", `assessment:task-timeout-001:${Date.now()}`);

    const builder = new PlanBuilder();
    const result = builder.build({
      observation: situation,
      assessment,
      workflow: planned,
    });

    const intakeStep = result.steps.find((s) => s.stepId === "intake_triage");
    assert.equal(intakeStep!.timeout, 60_000);

    const draftStep = result.steps.find((s) => s.stepId === "draft_solution");
    assert.equal(draftStep!.timeout, 180_000);
  } finally {
    ctx.cleanup();
  }
});