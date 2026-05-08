/**
 * E2E Planning and Goal Decomposition Tests
 *
 * End-to-end tests covering:
 * 1. Plan generation and DAG validation
 * 2. PlanGraphBundle creation and validation
 * 3. OAPEFLIR loop with assess/plan/execute phases
 * 4. Learning from feedback loop with quality grading
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 * Pattern: createE2EHarness for full stack context.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";
import { GoalDecompositionService, type Goal } from "../../src/interaction/goal-decomposer/index.js";
import { PlanDagValidator } from "../../src/platform/five-plane-orchestration/planner/plan-dag-validator.js";
import { PlanBuilder } from "../../src/platform/five-plane-orchestration/planner/plan-builder.js";
import { FeedbackImprovementService } from "../../src/scale-ecosystem/feedback-loop/feedback-improvement-service.js";
import { FeedbackQualityGrader } from "../../src/scale-ecosystem/feedback-loop/quality-grader.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import type { PlanStep } from "../../src/platform/five-plane-orchestration/oapeflir/types/index.js";

// ---------------------------------------------------------------------------
// Test 1: Plan DAG Validator - valid plan passes validation
// ---------------------------------------------------------------------------

test("E2E Plan DAG Validator: valid linear plan passes validation", () => {
  const harness = createE2EHarness("aa-e2e-plan-valid-");
  try {
    const validator = new PlanDagValidator();

    const steps: PlanStep[] = [
      {
        stepId: "step_1",
        action: "read",
        title: "Read configuration",
        inputs: {},
        outputs: ["config_data"],
        dependencies: [],
        status: "pending",
        timeout: 30000,
        retryPolicy: { maxRetries: 2, backoffMs: 250 },
      },
      {
        stepId: "step_2",
        action: "execute",
        title: "Process data",
        inputs: { configRef: "step_1" },
        outputs: ["processed_data"],
        dependencies: ["step_1"],
        status: "pending",
        timeout: 60000,
        retryPolicy: { maxRetries: 1, backoffMs: 500 },
      },
      {
        stepId: "step_3",
        action: "write",
        title: "Write results",
        inputs: { dataRef: "step_2" },
        outputs: ["final_result"],
        dependencies: ["step_2"],
        status: "pending",
        timeout: 30000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
    ];

    const result = validator.validate(steps);

    assert.equal(result.valid, true, "Valid linear plan should pass validation");
    assert.equal(result.orderedSteps.length, 3, "Should return all 3 steps in order");
    assert.equal(result.issues.length, 0, "Should have no issues");
    // Verify topological order is preserved
    assert.equal(result.orderedSteps[0]?.stepId, "step_1", "First step should be step_1");
    assert.equal(result.orderedSteps[1]?.stepId, "step_2", "Second step should be step_2");
    assert.equal(result.orderedSteps[2]?.stepId, "step_3", "Third step should be step_3");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Plan DAG Validator - cycle detection
// ---------------------------------------------------------------------------

test("E2E Plan DAG Validator: cycle detected in circular dependency plan", () => {
  const harness = createE2EHarness("aa-e2e-plan-cycle-");
  try {
    const validator = new PlanDagValidator();

    const steps: PlanStep[] = [
      {
        stepId: "step_a",
        action: "execute",
        title: "Step A",
        inputs: {},
        outputs: ["a_output"],
        dependencies: ["step_c"], // cycle: a depends on c
        status: "pending",
        timeout: 30000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
      {
        stepId: "step_b",
        action: "execute",
        title: "Step B",
        inputs: {},
        outputs: ["b_output"],
        dependencies: ["step_a"], // b depends on a
        status: "pending",
        timeout: 30000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
      {
        stepId: "step_c",
        action: "execute",
        title: "Step C",
        inputs: {},
        outputs: ["c_output"],
        dependencies: ["step_b"], // c depends on b - forms cycle a->b->c->a
        status: "pending",
        timeout: 30000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
    ];

    const result = validator.validate(steps);

    assert.equal(result.valid, false, "Plan with cycle should fail validation");
    assert.ok(result.issues.includes("planning.cycle_detected"), "Should detect cycle");
    assert.ok(result.orderedSteps.length < steps.length, "Should return partial ordering");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Plan DAG Validator - self dependency detection
// ---------------------------------------------------------------------------

test("E2E Plan DAG Validator: self-dependency detected and reported", () => {
  const harness = createE2EHarness("aa-e2e-plan-self-dep-");
  try {
    const validator = new PlanDagValidator();

    const steps: PlanStep[] = [
      {
        stepId: "self_step",
        action: "execute",
        title: "Self dependent step",
        inputs: {},
        outputs: ["output"],
        dependencies: ["self_step"], // self-dependency
        status: "pending",
        timeout: 30000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
    ];

    const result = validator.validate(steps);

    assert.equal(result.valid, false, "Self-dependent plan should fail validation");
    assert.ok(result.issues.some(i => i.includes("self_dependency")), "Should detect self-dependency");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: Plan DAG Validator - missing dependency detection
// ---------------------------------------------------------------------------

test("E2E Plan DAG Validator: missing dependency reported", () => {
  const harness = createE2EHarness("aa-e2e-plan-missing-dep-");
  try {
    const validator = new PlanDagValidator();

    const steps: PlanStep[] = [
      {
        stepId: "step_x",
        action: "execute",
        title: "Step X",
        inputs: {},
        outputs: ["x_output"],
        dependencies: ["nonexistent_step"], // missing dependency
        status: "pending",
        timeout: 30000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
    ];

    const result = validator.validate(steps);

    assert.equal(result.valid, false, "Plan with missing dependency should fail");
    assert.ok(result.issues.some(i => i.includes("missing_dependency")), "Should report missing dependency");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: Plan DAG Validator - no entry node detection
// ---------------------------------------------------------------------------

test("E2E Plan DAG Validator: plan without entry node fails validation", () => {
  const harness = createE2EHarness("aa-e2e-plan-no-entry-");
  try {
    const validator = new PlanDagValidator();

    // All steps have dependencies - no entry point
    const steps: PlanStep[] = [
      {
        stepId: "step_1",
        action: "execute",
        title: "Step 1",
        inputs: {},
        outputs: ["output"],
        dependencies: ["step_2"], // depends on another step
        status: "pending",
        timeout: 30000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
      {
        stepId: "step_2",
        action: "execute",
        title: "Step 2",
        inputs: {},
        outputs: ["output"],
        dependencies: ["step_1"], // circular - also no entry
        status: "pending",
        timeout: 30000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
    ];

    const result = validator.validate(steps);

    // Either cycle or no-entry-node should be detected
    assert.ok(!result.valid || result.issues.some(i => i.includes("no_entry_node")), "Should fail due to no entry node or cycle");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 6: Plan DAG Validator - worst path analysis
// ---------------------------------------------------------------------------

test("E2E Plan DAG Validator: worst path analysis identifies critical path", () => {
  const harness = createE2EHarness("aa-e2e-plan-worst-path-");
  try {
    const validator = new PlanDagValidator();

    // Create a diamond-shaped DAG where one path is longer
    const steps: PlanStep[] = [
      {
        stepId: "start",
        action: "execute",
        title: "Start",
        inputs: {},
        outputs: [],
        dependencies: [],
        status: "pending",
        timeout: 10000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
      {
        stepId: "fast_path",
        action: "execute",
        title: "Fast path",
        inputs: {},
        outputs: [],
        dependencies: ["start"],
        status: "pending",
        timeout: 10000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
      {
        stepId: "slow_path_1",
        action: "execute",
        title: "Slow path part 1",
        inputs: {},
        outputs: [],
        dependencies: ["start"],
        status: "pending",
        timeout: 30000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
      {
        stepId: "slow_path_2",
        action: "execute",
        title: "Slow path part 2",
        inputs: {},
        outputs: [],
        dependencies: ["slow_path_1"],
        status: "pending",
        timeout: 30000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
      {
        stepId: "end",
        action: "execute",
        title: "End",
        inputs: {},
        outputs: [],
        dependencies: ["fast_path", "slow_path_2"], // merge point
        status: "pending",
        timeout: 10000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
      },
    ];

// @ts-ignore
    const result = validator.analyzeWorstPath(steps);

    assert.ok(result, "Should return worst path analysis");
    assert.ok(result!.pathNodeIds.includes("slow_path_1"), "Slow path should be in worst path");
    assert.ok(result!.pathNodeIds.includes("slow_path_2"), "Slow path part 2 should be in worst path");
    assert.ok(result!.estimatedCost > 50000, "Slow path cost should exceed single step timeout");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 7: Plan Builder - builds valid plan from workflow
// ---------------------------------------------------------------------------

test("E2E Plan Builder: builds valid plan graph bundle from workflow", () => {
  const harness = createE2EHarness("aa-e2e-plan-builder-");
  try {
    const planBuilder = new PlanBuilder();

    // Mock workflow input
    const workflow = {
      workflowId: "test_workflow",
      executionSteps: [
        {
          stepId: "build_step",
          inputKeys: ["config"],
          outputKey: "artifact",
          maxAttempts: 2,
          timeoutMs: 60000,
        },
        {
          stepId: "test_step",
          inputKeys: ["artifact"],
          outputKey: "test_result",
          maxAttempts: 1,
          timeoutMs: 30000,
        },
      ],
    };

    const input = {
      observation: {
        taskId: "task-plan-build",
        taskTitle: "Build and test",
        taskStatus: "in_progress" as const,
        timestamp: nowIso(),
        taskPriority: "normal" as const,
        taskContext: { request: "build and test" },
        runtimeContext: {},
      },
      assessment: {
        assessmentId: "assess-1",
        taskId: "task-plan-build",
        summary: "Ready to plan",
        confidence: 0.9,
        recommendations: [],
        assessedAt: nowIso(),
      },
      workflow,
      harnessRunId: "harness-run-1",
    };

// @ts-ignore
    const bundle = planBuilder.buildGraphBundle(input);

    assert.ok(bundle.planGraphBundleId, "Should produce bundle with ID");
    assert.ok(bundle.graph.nodes.length >= 2, "Should have nodes for each step");
    assert.ok(bundle.graph.edges.length >= 1, "Should have edges between steps");
    assert.ok(bundle.validationReport, "Should have validation report");
    assert.equal(bundle.graph.entryNodeIds.length > 0, true, "Should have entry nodes");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 8: Goal Decomposition with plan validation
// ---------------------------------------------------------------------------

test("E2E Goal Decomposition: decomposed tasks form valid DAG", async () => {
  const harness = createE2EHarness("aa-e2e-goal-plan-");
  try {
    const service = new GoalDecompositionService();
    const validator = new PlanDagValidator();

    const goal: Goal = {
      goalId: newId("goal"),
      description: "启动新的广告投放营销活动",
      owner: "e2e-plan-owner",
      successCriteria: [],
      constraints: [],
      priority: "high",
    };

    const result = await service.decompose(goal);

    // Convert decomposed tasks to PlanSteps for validation
// @ts-ignore
    const steps: PlanStep[] = result.tasks.map((task) => ({
      stepId: task.taskId,
      action: "execute",
      title: task.description,
      inputs: task.inputs as Record<string, unknown>,
      outputs: task.expectedOutputs,
      dependencies: result.dependencyGraph
        .filter(d => d.toTask === task.taskId)
        .map(d => d.fromTask),
      status: "pending",
      timeout: 60000,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
    }));

    const validation = validator.validate(steps);

    assert.equal(validation.valid, true, "Goal decomposition should produce valid DAG");
    assert.ok(validation.orderedSteps.length === result.tasks.length, "All tasks should be in order");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 9: Feedback Loop - improvement candidate lifecycle
// ---------------------------------------------------------------------------

test("E2E Feedback Loop: improvement candidate follows approval lifecycle", () => {
  const harness = createE2EHarness("aa-e2e-feedback-");
  try {
    const service = new FeedbackImprovementService();

    // Ingest feedback to create candidate
    const result = service.ingest({
      taskId: "task-feedback-1",
      executionId: "exec-feedback-1",
// @ts-ignore
      feedbackSignals: [
        {
          signalId: "sig-1",
          taskId: "task-feedback-1",
          source: "user",
          category: "correction",
          severity: "error",
          payload: { reasonCode: "user_correction", summary: "Wrong approach" },
          stepOutputRefs: ["step-output-1"],
          timestamp: new Date().toISOString(),
        },
      ],
      outcome: "partial",
    });

// @ts-ignore
    assert.ok(result.feedback.batchId, "Should produce feedback batch with ID");
    assert.ok(result.learningSignals.length > 0, "Should produce learning signals");
    assert.ok(result.candidates.length > 0, "Should produce improvement candidates");

    const candidate = result.candidates[0]!;
    assert.equal(candidate.reviewStatus, "proposed", "New candidate should be proposed");

    // Review and approve candidate
    const decision = service.review(candidate.candidateId, "reviewer-1", "approved", {
      rolloutGatePassed: true,
      policyGatePassed: true,
    });

    assert.equal(decision.decision, "approved", "Should be approved");
    assert.equal(decision.rolloutGatePassed, true, "Rollout gate should pass");
    assert.equal(decision.policyGatePassed, true, "Policy gate should pass");

    // Release candidate
    const released = service.release(candidate.candidateId, "release-owner");
    assert.equal(released.reviewStatus, "released", "Should be released");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 10: Feedback Loop - rejection blocks release
// ---------------------------------------------------------------------------

test("E2E Feedback Loop: rejected candidate cannot be released", () => {
  const harness = createE2EHarness("aa-e2e-feedback-reject-");
  try {
    const service = new FeedbackImprovementService();

    const result = service.ingest({
      taskId: "task-feedback-reject",
      executionId: "exec-feedback-reject",
// @ts-ignore
      feedbackSignals: [
        {
          signalId: "sig-reject",
          taskId: "task-feedback-reject",
          source: "validation",
          category: "failure",
          severity: "error",
          payload: { reasonCode: "validation_failure" },
          stepOutputRefs: [],
          timestamp: new Date().toISOString(),
        },
      ],
      outcome: "failed",
    });

    const candidate = result.candidates[0]!;

    // Reject candidate
    const decision = service.review(candidate.candidateId, "reviewer-1", "rejected", {
      rolloutGatePassed: false,
      policyGatePassed: false,
    });

    assert.equal(decision.decision, "rejected", "Should be rejected");

    // Attempt to release rejected candidate should throw
    assert.throws(
      () => service.release(candidate.candidateId, "release-owner"),
// @ts-ignore
      (err: Unknown) => err instanceof Error && err.message.includes("requires_approval"),
      "Should throw when releasing rejected candidate"
    );

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 11: Feedback Quality Grader - grades signal quality
// ---------------------------------------------------------------------------

test("E2E Feedback Quality Grader: human correction receives high grade", () => {
  const harness = createE2EHarness("aa-e2e-grader-");
  try {
    const grader = new FeedbackQualityGrader();

    const signals = [
      {
        signalId: "sig-human-correct",
        taskId: "task-grade-1",
        source: "user" as const,
        category: "correction" as const,
        severity: "error" as const,
        payload: { summary: "Should have used different approach", reasonCode: "user_correction" },
        stepOutputRefs: ["step-1", "step-2"],
        timestamp: Date.now() - 1000, // recent
      },
    ];

    const grade = grader.gradeSignals(signals);

    assert.ok(grade.score.overall > 0.5, "Human correction should score above threshold");
    assert.ok(["low", "medium", "high"].includes(grade.grade), "Should have valid grade");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 12: Feedback Quality Grader - old signals discarded
// ---------------------------------------------------------------------------

test("E2E Feedback Quality Grader: signals exceeding max age get discarded", () => {
  const harness = createE2EHarness("aa-e2e-grader-old-");
  try {
    const grader = new FeedbackQualityGrader({ maxAgeDays: 7 });

    const signals = [
      {
        signalId: "sig-old",
        taskId: "task-grade-old",
        source: "user" as const,
        category: "correction" as const,
        severity: "warning" as const,
        payload: { summary: "Old feedback" },
        stepOutputRefs: [],
        timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days old
      },
    ];

    const grade = grader.gradeSignals(signals);

    assert.equal(grade.grade, "discard", "Old signals should be discarded");
    assert.ok(grade.reasons.some(r => r.includes("max age")), "Should mention age violation");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 13: Feedback Quality Grader - diversity affects score
// ---------------------------------------------------------------------------

test("E2E Feedback Quality Grader: diverse signal sources improve score", () => {
  const harness = createE2EHarness("aa-e2e-grader-diverse-");
  try {
    const grader = new FeedbackQualityGrader();

    const signals = [
      {
        signalId: "sig-user",
        taskId: "task-diverse",
        source: "user" as const,
        category: "correction" as const,
        severity: "error" as const,
        payload: { summary: "User correction" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
      {
        signalId: "sig-hitl",
        taskId: "task-diverse",
        source: "hitl" as const,
        category: "failure" as const,
        severity: "critical" as const,
        payload: { summary: "HITL detected issue" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
      {
        signalId: "sig-validation",
        taskId: "task-diverse",
        source: "validation" as const,
        category: "success" as const,
        severity: "warning" as const,
        payload: { summary: "Validation passed" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ];

    const singleGrade = grader.gradeSignals([signals[0]!]);
    const diverseGrade = grader.gradeSignals(signals);

    assert.ok(diverseGrade.score.diversityScore > singleGrade.score.diversityScore, "Multiple sources should have higher diversity score");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 14: OAPEFLIR Lifecycle - assess/plan/execute phases
// ---------------------------------------------------------------------------

test("E2E OAPEFLIR: goal decomposition produces all phase artifacts", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflr-phases-");
  try {
    const service = new GoalDecompositionService();

    const goal: Goal = {
      goalId: newId("goal"),
      description: "完成数据分析和报告生成",
      owner: "e2e-oapeflr-owner",
      successCriteria: [{ metric: "completion", target: "100%", evaluationMethod: "automated_test" }],
      constraints: ["预算 1000 元", "2天内完成"],
      priority: "normal",
    };

    const result = await service.decompose(goal);

    // PLAN phase artifacts
    assert.ok(result.taskGraphDraft, "Should produce task graph (PLAN phase)");
    assert.ok(result.topologicallySortedTaskIds, "Should produce topological sort");

    // ORCHESTRATE phase artifacts
    assert.ok(result.dependencyGraph, "Should produce dependency graph (ORCHESTRATE)");
    assert.ok(result.parallelTaskGroups, "Should identify parallel task groups");

    // EXECUTE phase - tasks created (verified by existence of taskIds)
    assert.ok(result.tasks.length > 0, "Should produce tasks for execution");

    // FEEDBACK phase artifacts
    assert.ok(result.decompositionConfidence !== undefined, "Should have confidence score");
    assert.ok(result.riskSummary, "Should have risk summary for feedback");

    // LEARN phase artifacts
    assert.ok(result.goalGraphDraft.evidenceRefs.length > 0, "Should have evidence refs for learning");

    // INTEGRATE phase artifacts
    assert.ok(result.estimatedCost, "Should have integrated cost estimate");
    assert.ok(result.estimatedDuration, "Should have integrated duration estimate");

    // REVIEW phase
    assert.equal(result.lifecycleState, "decomposed", "Should end in decomposed state");

    // PLANNER HANDOFF
    assert.ok(result.plannerHandoff, "Should produce planner handoff receipt");
    assert.equal(result.plannerHandoff.state, "ready_for_planner", "Should be ready for planner");

    // HARNESS ROUTING
// @ts-ignore
    assert.ok(result.harnessRouting, "Should produce harness routing receipt");
// @ts-ignore
    assert.ok(result.harnessRouting.harnessRun, "Should have harness run");
// @ts-ignore
    assert.ok(result.harnessRouting.planGraphBundle, "Should have plan graph bundle");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 15: OAPEFLIR - constraint envelope propagation
// ---------------------------------------------------------------------------

test("E2E OAPEFLIR: constraint envelope propagates to all tasks", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflr-constraints-");
  try {
    const service = new GoalDecompositionService();

    const goal: Goal = {
      goalId: newId("goal"),
      description: "部署应用到生产环境",
      owner: "e2e-constraint-owner",
      successCriteria: [],
      constraints: ["预算 500 元"],
      priority: "critical",
    };

    const result = await service.decompose(goal);

    // Verify constraint envelope exists and is propagated
    assert.ok(result.goalGraphDraft.constraintEnvelope, "Should have constraint envelope");

    const envelope = result.goalGraphDraft.constraintEnvelope;
    assert.equal(envelope.riskTolerance, "low", "Critical priority should have low risk tolerance");
    assert.equal(envelope.requiresApproval, true, "Deploy should require approval");

    // Verify all tasks have constraint envelope
    for (const task of result.tasks) {
      assert.ok(task.constraintEnvelope, `Task ${task.taskId} should have constraint envelope`);
    }

    // Verify budget allocations if budget was specified
// @ts-ignore
    if (envelope.budgetAllocations && envelope.budgetAllocations.length > 0) {
// @ts-ignore
      assert.equal(envelope.budgetAllocations.length, result.tasks.length, "Should have budget for each task");
    }

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 16: OAPEFLIR - critical path identification
// ---------------------------------------------------------------------------

test("E2E OAPEFLIR: critical path identified in multi-task decomposition", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflr-critical-path-");
  try {
    const service = new GoalDecompositionService();

    const goal: Goal = {
      goalId: newId("goal"),
      description: "完成复杂的多阶段项目",
      owner: "e2e-critical-path-owner",
      successCriteria: [],
      constraints: [],
      priority: "high",
    };

    const result = await service.decompose(goal);

    // Verify critical path exists and is valid
    assert.ok(result.criticalPathTaskIds, "Should identify critical path");
    assert.ok(result.criticalPathTaskIds!.length > 0, "Critical path should not be empty");

    // Critical path tasks should all exist in task list
    for (const taskId of result.criticalPathTaskIds!) {
      assert.ok(result.tasks.some(t => t.taskId === taskId), `Critical path task ${taskId} should exist`);
    }

    // Critical path should be a subset of topological sort
    const criticalPathSet = new Set(result.criticalPathTaskIds);
    for (let i = 0; i < (result.topologicallySortedTaskIds?.length ?? 0); i++) {
      const taskId = result.topologicallySortedTaskIds![i];
// @ts-ignore
      if (criticalPathSet.has(taskId)) {
        // Verify all dependencies of critical path task appear before it
        const deps = result.dependencyGraph.filter(d => d.toTask === taskId);
        for (const dep of deps) {
          const depIndex = result.topologicallySortedTaskIds!.indexOf(dep.fromTask);
          assert.ok(depIndex < i, `Critical path dependency ${dep.fromTask} should come before ${taskId}`);
        }
      }
    }

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 17: Learning Loop - feedback creates learning signal
// ---------------------------------------------------------------------------

test("E2E Learning Loop: feedback signals generate learning signals", () => {
  const harness = createE2EHarness("aa-e2e-learning-");
  try {
    const service = new FeedbackImprovementService();

    // Multiple feedback signals
    const result = service.ingest({
      taskId: "task-learn-1",
      executionId: "exec-learn-1",
// @ts-ignore
      feedbackSignals: [
        {
          signalId: "sig-learn-1",
          taskId: "task-learn-1",
          source: "user",
          category: "correction",
          severity: "error",
          payload: { reasonCode: "wrong_tool_selection", summary: "Should have used bash not read" },
          stepOutputRefs: ["step-output-1"],
          timestamp: new Date().toISOString(),
        },
        {
          signalId: "sig-learn-2",
          taskId: "task-learn-1",
          source: "user",
          category: "correction",
          severity: "warning",
          payload: { reasonCode: "wrong_tool_selection", summary: "Same issue again" },
          stepOutputRefs: ["step-output-2"],
          timestamp: new Date().toISOString(),
        },
      ],
      outcome: "partial",
    });

    // Verify learning signals are generated
    assert.ok(result.learningSignals.length > 0, "Should produce learning signals");

    // Verify signals have learning type
    for (const signal of result.learningSignals) {
      assert.ok(signal.learningType, "Learning signal should have type");
      assert.ok(signal.taskId, "Should reference task");
    }

    // Verify improvement candidates are created
    assert.ok(result.candidates.length > 0, "Should create improvement candidates");

    // Verify snapshot can be built
    const snapshot = service.buildSnapshot(result.feedback.signals);
    assert.ok(snapshot.generatedAt, "Snapshot should have timestamp");
    assert.equal(snapshot.candidateCount, result.candidates.length, "Should reflect candidate count");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 18: Learning Loop - strategy learning from feedback
// ---------------------------------------------------------------------------

test("E2E Learning Loop: feedback loop snapshot reflects analysis", () => {
  const harness = createE2EHarness("aa-e2e-learning-snapshot-");
  try {
    const service = new FeedbackImprovementService();

    // High-quality feedback (human corrections with detailed context)
    const result = service.ingest({
      taskId: "task-high-quality",
      executionId: "exec-high-quality",
// @ts-ignore
      feedbackSignals: [
        {
          signalId: "sig-hq-1",
          taskId: "task-high-quality",
          source: "user",
          category: "correction",
          severity: "error",
          payload: {
            reasonCode: "failure_pattern",
            summary: "Repeated failure on database queries - timeout issues"
          },
          stepOutputRefs: ["step-db-1", "step-db-2", "step-db-3"],
          timestamp: new Date().toISOString(),
        },
      ],
      outcome: "failed",
    });

    const snapshot = service.buildSnapshot(result.feedback.signals);

    // Verify snapshot structure
    assert.ok(snapshot.analysis, "Snapshot should have analysis");
    assert.equal(snapshot.candidateCount, 1, "Should have one candidate from failure pattern");

    // Verify tracking summary
    assert.ok(snapshot.trackingSummary, "Should have tracking summary");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// End of E2E Planning and Goal Decomposition Tests
// ---------------------------------------------------------------------------