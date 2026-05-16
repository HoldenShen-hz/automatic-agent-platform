/**
 * Integration Test: Planner
 *
 * Tests the planning subsystem including WorkflowPlanner, TaskDecompositionService,
 * PlanBuilder, PlanDagValidator, PlanEvaluator, and ReplanningService using SQLite
 * context.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { createIntegrationContext, createSeededIntegrationContext } from "../../../../helpers/integration-context.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { WorkflowPlanner, type WorkflowPlannerInput } from "../../../../../src/platform/five-plane-orchestration/routing/workflow-planner.js";
import { TaskDecompositionService } from "../../../../../src/platform/five-plane-orchestration/planner/task-decomposition-service.js";
import { PlanBuilder } from "../../../../../src/platform/five-plane-orchestration/planner/plan-builder.js";
import { PlanDagValidator } from "../../../../../src/platform/five-plane-orchestration/planner/plan-dag-validator.js";
import { PlanEvaluator } from "../../../../../src/platform/five-plane-orchestration/planner/plan-evaluator.js";
import { ReplanningService } from "../../../../../src/platform/five-plane-orchestration/planner/replanning-service.js";
import { parseTaskSituation, parseUnifiedAssessment, type Plan, type PlanStep } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/index.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

function createPlannerContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "planner-integration.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, dbPath, db, store };
}

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

// ---------------------------------------------------------------------------
// WorkflowPlanner tests
// ---------------------------------------------------------------------------

test("Planner WorkflowPlanner creates single-step plan from single_agent_minimal", () => {
  const ctx = createPlannerContext("aa-planner-single-");
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
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Planner WorkflowPlanner creates multi-step plan with dependency edges", () => {
  const ctx = createPlannerContext("aa-planner-multi-");
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

    // Verify dependency edges reflect step dependencies
    for (const edge of result.dependencyEdges) {
      const fromStep = result.executionSteps.find((s) => s.stepId === edge.fromStepId);
      const toStep = result.executionSteps.find((s) => s.stepId === edge.toStepId);
      assert.ok(fromStep, `Edge fromStep ${edge.fromStepId} should exist`);
      assert.ok(toStep, `Edge toStep ${edge.toStepId} should exist`);
      assert.ok(toStep!.dependsOnStepIds.includes(edge.fromStepId), "Edge should reflect step dependency");
    }
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Planner WorkflowPlanner throws for unknown workflow", () => {
  const ctx = createPlannerContext("aa-planner-not-found-");
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
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Planner WorkflowPlanner computes agent IDs from role IDs", () => {
  const ctx = createPlannerContext("aa-planner-agent-id-");
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
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Planner WorkflowPlanner preserves workflow division ID in steps", () => {
  const ctx = createPlannerContext("aa-planner-division-");
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
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Planner WorkflowPlanner stores output schema path when defined", () => {
  const ctx = createPlannerContext("aa-planner-schema-");
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
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

// ---------------------------------------------------------------------------
// TaskDecompositionService tests
// ---------------------------------------------------------------------------

test("Planner TaskDecompositionService decomposes workflow into tasks", () => {
  const ctx = createPlannerContext("aa-planner-decompose-");
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
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Planner TaskDecompositionService preserves step dependencies", () => {
  const ctx = createPlannerContext("aa-planner-deps-");
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
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Planner TaskDecompositionService omits read tool for dependency-free steps", () => {
  const ctx = createPlannerContext("aa-planner-tools-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_agent_minimal",
      request: "tools test",
    });

    const decompositionService = new TaskDecompositionService();
    const decompositions = decompositionService.decompose(planned);

    for (const decomposition of decompositions) {
      assert.ok(!decomposition.toolNames.includes("read"), "Dependency-free step should not include read tool");
    }
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

// ---------------------------------------------------------------------------
// PlanBuilder tests
// ---------------------------------------------------------------------------

test("Planner PlanBuilder creates plan from workflow and assessment", () => {
  const ctx = createPlannerContext("aa-planner-builder-");
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
    assert.equal(result.strategy, "linear");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Planner PlanBuilder orders steps respecting dependency order", () => {
  const ctx = createPlannerContext("aa-planner-order-");
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
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Planner PlanBuilder replan increments version correctly", () => {
  const ctx = createPlannerContext("aa-planner-replan-");
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
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Planner PlanBuilder assigns retry policies based on step maxAttempts", () => {
  const ctx = createPlannerContext("aa-planner-retry-");
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
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Planner PlanBuilder sets timeout values per step from workflow", () => {
  const ctx = createPlannerContext("aa-planner-timeout-");
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
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

// ---------------------------------------------------------------------------
// PlanDagValidator tests
// ---------------------------------------------------------------------------

test("Planner PlanDagValidator produces valid result for linear DAG", () => {
  const steps: PlanStep[] = [
    {
      stepId: "step_1",
      action: "read",
      title: "First step",
      inputs: { ownerRoleId: "planner", inputKeys: [] },
      outputs: [],
      dependencies: [],
      status: "pending",
      timeout: 60000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
    {
      stepId: "step_2",
      action: "write",
      title: "Second step",
      inputs: { ownerRoleId: "generator", inputKeys: ["step_1"] },
      outputs: [],
      dependencies: ["step_1"],
      status: "pending",
      timeout: 60000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ];

  const validator = new PlanDagValidator();
  const result = validator.validate(steps);

  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
  assert.equal(result.orderedSteps.length, 2);
  assert.equal(result.orderedSteps[0]!.stepId, "step_1");
  assert.equal(result.orderedSteps[1]!.stepId, "step_2");
});

test("Planner PlanDagValidator detects self-dependency", () => {
  const steps: PlanStep[] = [
    {
      stepId: "step_self",
      action: "read",
      title: "Self dependent step",
      inputs: { ownerRoleId: "planner", inputKeys: [] },
      outputs: [],
      dependencies: ["step_self"],
      status: "pending",
      timeout: 60000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ];

  const validator = new PlanDagValidator();
  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.includes("planning.self_dependency")));
});

test("Planner PlanDagValidator detects missing dependency", () => {
  const steps: PlanStep[] = [
    {
      stepId: "step_missing",
      action: "write",
      title: "Missing dependency step",
      inputs: { ownerRoleId: "generator", inputKeys: [] },
      outputs: [],
      dependencies: ["nonexistent_step"],
      status: "pending",
      timeout: 60000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ];

  const validator = new PlanDagValidator();
  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.includes("planning.missing_dependency")));
});

test("Planner PlanDagValidator detects cycle", () => {
  const steps: PlanStep[] = [
    {
      stepId: "step_a",
      action: "read",
      title: "Step A",
      inputs: { ownerRoleId: "planner", inputKeys: [] },
      outputs: [],
      dependencies: ["step_b"],
      status: "pending",
      timeout: 60000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
    {
      stepId: "step_b",
      action: "write",
      title: "Step B",
      inputs: { ownerRoleId: "generator", inputKeys: [] },
      outputs: [],
      dependencies: ["step_a"],
      status: "pending",
      timeout: 60000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    },
  ];

  const validator = new PlanDagValidator();
  const result = validator.validate(steps);

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.includes("planning.cycle_detected")));
});

// ---------------------------------------------------------------------------
// PlanEvaluator tests
// ---------------------------------------------------------------------------

test("Planner PlanEvaluator marks plan viable when no issues", () => {
  const ctx = createPlannerContext("aa-evaluator-viable-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_agent_minimal",
      request: "evaluate viable",
    });

    const situation = createTestTaskSituation("task-eval-001");
    const assessment = createTestAssessment("task-eval-001", `assessment:task-eval-001:${Date.now()}`);

    const builder = new PlanBuilder();
    const plan = builder.build({
      observation: situation,
      assessment,
      workflow: planned,
    });

    const evaluator = new PlanEvaluator();
    const result = evaluator.evaluate(plan, assessment);

    assert.equal(result.viable, true);
    assert.equal(result.issues.length, 0);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Planner PlanEvaluator detects missing critical approval constraint", () => {
  const ctx = createPlannerContext("aa-evaluator-critical-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_agent_minimal",
      request: "evaluate critical risk",
    });

    const situation = createTestTaskSituation("task-eval-critical-001");
    const criticalAssessment = parseUnifiedAssessment({
      taskId: "task-eval-critical-001",
      timestamp: Date.now(),
      situationRef: `assessment:task-eval-critical-001:${Date.now()}`,
      phase: "post-execution",
      complexity: "moderate",
      risk: "critical",
      riskAssessment: {
        level: "critical",
        factors: ["production_deployment"],
      },
      routingDecision: {
        division: "general_ops",
        workflow: "single_agent_minimal",
        rationale: "critical deployment",
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

    const builder = new PlanBuilder();
    const plan = builder.build({
      observation: situation,
      assessment: criticalAssessment,
      workflow: planned,
    });

    const evaluator = new PlanEvaluator();
    const result = evaluator.evaluate(plan, criticalAssessment);

    assert.equal(result.viable, false);
    assert.ok(result.issues.some((i) => i.includes("planning.missing_critical_approval_constraint")));
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

// ---------------------------------------------------------------------------
// ReplanningService tests
// ---------------------------------------------------------------------------

test("Planner ReplanningService decides replan for repairable feedback", () => {
  const ctx = createPlannerContext("aa-replan-repair-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_agent_minimal",
      request: "replan repairable",
    });

    const situation = createTestTaskSituation("task-replan-001");
    const assessment = createTestAssessment("task-replan-001", `assessment:task-replan-001:${Date.now()}`);

    const builder = new PlanBuilder();
    const plan = builder.build({
      observation: situation,
      assessment,
      workflow: planned,
    });

    const feedback = {
      feedbackId: "fb_001",
      taskId: plan.taskId,
      executionId: null,
      planId: plan.planId,
      signals: [
        {
          signalId: "sig_1",
          taskId: plan.taskId,
          source: "execution" as const,
          category: "correction" as const,
          severity: "warning" as const,
          payload: { summary: "repair needed", reasonCode: "repair_required", durationMs: 30 },
          stepOutputRefs: ["step_1"],
          timestamp: Date.now(),
        },
      ],
      outcome: "repairable" as const,
      emittedAt: Date.now(),
    };

    const replanning = new ReplanningService();
    const trigger = replanning.createTrigger(plan.taskId, "feedback.repair_required", "feedback", "repair required");
    const decision = replanning.decide(plan, feedback, trigger);

    assert.equal(decision.shouldReplan, true);
    assert.equal(decision.taskId, plan.taskId);
    assert.equal(decision.nextPlanVersion, plan.version + 1);
    assert.equal(decision.strategy, "replanned");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Planner ReplanningService decides no replan for successful feedback", () => {
  const ctx = createPlannerContext("aa-replan-ok-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_agent_minimal",
      request: "replan success",
    });

    const situation = createTestTaskSituation("task-replan-ok-001");
    const assessment = createTestAssessment("task-replan-ok-001", `assessment:task-replan-ok-001:${Date.now()}`);

    const builder = new PlanBuilder();
    const plan = builder.build({
      observation: situation,
      assessment,
      workflow: planned,
    });

    const feedback = {
      feedbackId: "fb_ok_001",
      taskId: plan.taskId,
      executionId: null,
      planId: plan.planId,
      signals: [
        {
          signalId: "sig_ok_1",
          taskId: plan.taskId,
          source: "execution" as const,
          category: "success" as const,
          severity: "info" as const,
          payload: { summary: "all good", reasonCode: "success", durationMs: 100 },
          stepOutputRefs: ["step_1"],
          timestamp: Date.now(),
        },
      ],
      outcome: "completed" as const,
      emittedAt: Date.now(),
    };

    const replanning = new ReplanningService();
    const decision = replanning.decide(plan, feedback);

    assert.equal(decision.shouldReplan, false);
    assert.equal(decision.nextPlanVersion, null);
    assert.equal(decision.strategy, null);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

// ---------------------------------------------------------------------------
// Seeded context test
// ---------------------------------------------------------------------------

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
