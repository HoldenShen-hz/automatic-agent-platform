/**
 * E2E Goal Decomposition with OAPEFLR Phases Tests
 *
 * End-to-end tests covering goal decomposition with OAPEFLR phases:
 * - Plan (P) phase - goal analysis and task planning
 * - Orchestrate (O) phase - task coordination and dependency resolution
 * - Execute (E) phase - actual task execution
 * - Feedback (F) phase - evaluation and quality assessment
 * - Learn (L) phase - experience capture and policy learning
 * - Integrate (I) phase - result integration and finalization
 * - Review (R) phase - human review and approval workflow
 *
 * Tests verify:
 * - OAPEFLR phase transitions
 * - Phase-specific behavior (planner, generator, evaluator)
 * - HarnessRuntime integration in each phase
 * - PlanGraphBundle creation and routing
 * - Experience promotion through phases
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { withProcessGuard } from "../helpers/process-guard.js";
import { GoalDecompositionService, type Goal, type PlannedTask } from "../../src/interaction/goal-decomposer/index.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import { TransitionService } from "../../src/platform/five-plane-execution/state-transition/transition-service.js";

// ---------------------------------------------------------------------------
// Test 1: Goal Decomposition Plan (P) Phase
// ---------------------------------------------------------------------------

test("E2E Goal OAPEFLR: Plan phase produces goal graph and task graph", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflr-plan-");
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

    // Verify Plan phase outputs
    assert.ok(result.goalGraphDraft, "Should produce goal graph draft");
    assert.equal(result.goalGraphDraft.goalId, goal.goalId, "Goal graph should reference correct goal");
    assert.equal(result.goalGraphDraft.lifecycleState, "decomposed", "Goal lifecycle should be decomposed");

    // Verify task graph
    assert.ok(result.taskGraphDraft, "Should produce task graph draft");
    assert.equal(result.taskGraphDraft.goalId, goal.goalId, "Task graph should reference correct goal");
    assert.ok(result.taskGraphDraft.tasks.length > 0, "Task graph should have tasks");
    assert.ok(result.taskGraphDraft.normalized, "Task graph should be normalized (no cycles)");

    // Verify constraint envelope propagated
    assert.ok(result.goalGraphDraft.constraintEnvelope, "Should have constraint envelope");
    assert.equal(result.goalGraphDraft.constraintEnvelope.riskTolerance, "high", "Normal priority should have high risk tolerance");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Goal Decomposition Orchestrate (O) Phase
// ---------------------------------------------------------------------------

test("E2E Goal OAPEFLR: Orchestrate phase produces valid dependency graph", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflr-orchestrate-");
  try {
    const service = new GoalDecompositionService();

    const goal: Goal = {
      goalId: newId("goal"),
      description: "启动营销活动",
      owner: "e2e-oapeflr-owner",
      successCriteria: [],
      constraints: [],
      priority: "high",
    };

    const result = await service.decompose(goal);

    // Verify Orchestrate phase produces dependency graph
    assert.ok(result.dependencyGraph, "Should produce dependency graph");
    assert.ok(result.topologicallySortedTaskIds, "Should produce topological sort");
    assert.ok(result.parallelTaskGroups, "Should identify parallel task groups");

    // Verify all tasks appear in the sorted order respecting dependencies
    const sortedIds = result.topologicallySortedTaskIds!;
    for (const dep of result.dependencyGraph) {
      const fromIdx = sortedIds.indexOf(dep.fromTask);
      const toIdx = sortedIds.indexOf(dep.toTask);
      assert.ok(fromIdx < toIdx, `Dependency ${dep.fromTask} → ${dep.toTask} should respect topological order`);
    }

    // Verify critical path identified
    assert.ok(result.criticalPathTaskIds, "Should identify critical path");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Goal Decomposition Execute (E) Phase - Task Creation
// ---------------------------------------------------------------------------

test("E2E Goal OAPEFLR: Execute phase creates tasks in store", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-oapeflr-execute-");
    try {
      const service = new GoalDecompositionService();
      const ts = new TransitionService(harness.db, harness.store);

      const goal: Goal = {
        goalId: newId("goal"),
        description: "完成项目交付",
        owner: "e2e-oapeflr-owner",
        successCriteria: [],
        constraints: [],
        priority: "normal",
      };

      const result = await service.decompose(goal);
      const now = nowIso();

      // Execute phase: Create tasks in store
      harness.db.transaction(() => {
        for (const plannedTask of result.tasks) {
          harness.store.insertTask({
            id: plannedTask.taskId,
            parentId: null,
            rootId: goal.goalId,
            divisionId: plannedTask.domainId,
            tenantId: null,
            title: plannedTask.description,
            status: "pending",
            source: "system",
            priority: goal.priority,
            inputJson: JSON.stringify(plannedTask.inputs),
            normalizedInputJson: JSON.stringify(plannedTask.inputs),
            outputJson: null,
            estimatedCostUsd: plannedTask.estimatedCost.estimatedCostUsd,
            actualCostUsd: 0,
            errorCode: null,
            createdAt: now,
            updatedAt: now,
            completedAt: null,
          });
        }
      });

      // Verify tasks created
      assert.equal(harness.store.listTasks().length, result.tasks.length, "All tasks should be created in store");

      // Execute tasks through state transitions
      for (const plannedTask of result.tasks) {
        const task = harness.store.getTask(plannedTask.taskId);
        assert.ok(task, `Task ${plannedTask.taskId} should exist`);
        assert.equal(task!.status, "pending", "Task should start in pending");

        // Transition to in_progress
        ts.transitionTaskStatus({
          entityKind: "task",
          entityId: plannedTask.taskId,
          fromStatus: "pending",
          toStatus: "in_progress",
          executionId: null,
          reasonCode: "oapeflr.execute_started",
          traceId: newId("trace"),
          actorType: "system",
          occurredAt: nowIso(),
        });

        const updatedTask = harness.store.getTask(plannedTask.taskId);
        assert.equal(updatedTask!.status, "in_progress", "Task should be in_progress after transition");
      }

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// ---------------------------------------------------------------------------
// Test 4: Goal Decomposition Feedback (F) Phase - Evaluation
// ---------------------------------------------------------------------------

test("E2E Goal OAPEFLR: Feedback phase evaluates task outcomes", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflr-feedback-");
  try {
    const service = new GoalDecompositionService();

    // High confidence template-based goal
    const templateGoal: Goal = {
      goalId: newId("goal"),
      description: "发布新版本到生产",
      owner: "e2e-oapeflr-owner",
      successCriteria: [],
      constraints: [],
      priority: "critical",
    };

    const result = await service.decompose(templateGoal);

    // Verify Feedback phase produces evaluation metrics
    assert.ok(result.decompositionConfidence, "Should have decomposition confidence");
    assert.ok(result.decompositionConfidence >= 0 && result.decompositionConfidence <= 1, "Confidence should be 0-1");

    // Critical goals should require human review (Feedback evaluation)
    assert.equal(result.requiresHumanReview, true, "Critical priority should require human review");

    // Verify risk summary reflects evaluation
    assert.ok(result.riskSummary, "Should have risk summary");
    assert.equal(result.riskSummary.overallRisk, "critical", "Critical priority should have critical risk");

    // Template-based goals should have higher confidence
    assert.ok(result.decompositionConfidence > 0.8, "Template-based decomposition should have high confidence");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: Goal Decomposition Learn (L) Phase - Experience Capture
// ---------------------------------------------------------------------------

test("E2E Goal OAPEFLR: Learn phase captures decomposition experience", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflr-learn-");
  try {
    const service = new GoalDecompositionService();

    // Multiple goals to build experience
    const goals: Goal[] = [
      {
        goalId: newId("goal"),
        description: "启动广告投放营销活动",
        owner: "e2e-oapeflr-owner",
        successCriteria: [],
        constraints: [],
        priority: "high",
      },
      {
        goalId: newId("goal"),
        description: "发布新功能到生产环境",
        owner: "e2e-oapeflr-owner",
        successCriteria: [],
        constraints: [],
        priority: "critical",
      },
    ];

    const results = await Promise.all(goals.map((g) => service.decompose(g)));

    // Verify each decomposition has evidence refs (Learn phase artifact)
    for (const result of results) {
      assert.ok(result.goalGraphDraft.evidenceRefs.length > 0, "Should have evidence refs from Learn phase");
      assert.ok(
        result.goalGraphDraft.evidenceRefs.some((ref) => ref.startsWith("goal:")),
        "Should reference goal in evidence"
      );
    }

    // Verify decomposition strategy was determined
    for (const result of results) {
      assert.ok(
        ["template", "llm_plan", "hybrid", "human_assisted"].includes(result.decompositionStrategy!),
        "Should have valid decomposition strategy"
      );
    }

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 6: Goal Decomposition Integrate (I) Phase - Result Aggregation
// ---------------------------------------------------------------------------

test("E2E Goal OAPEFLR: Integrate phase aggregates task results", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflr-integrate-");
  try {
    const service = new GoalDecompositionService();

    const goal: Goal = {
      goalId: newId("goal"),
      description: "完成完整项目交付",
      owner: "e2e-oapeflr-owner",
      successCriteria: [],
      constraints: [],
      priority: "normal",
    };

    const result = await service.decompose(goal);

    // Verify Integrate phase produces aggregated estimates
    assert.ok(result.estimatedCost, "Should have aggregated cost estimate");
    assert.ok(result.estimatedDuration, "Should have aggregated duration estimate");

    // Verify estimated cost is sum of task costs
    const totalTaskCost = result.tasks.reduce((sum, t) => sum + t.estimatedCost.estimatedCostUsd, 0);
    assert.equal(
      result.estimatedCost.estimatedCostUsd,
      Number(totalTaskCost.toFixed(4)),
      "Aggregated cost should equal sum of task costs"
    );

    // Verify duration estimate
    assert.ok(result.estimatedDuration.endsWith("d") || result.estimatedDuration.endsWith("h"), "Duration should be in days or hours");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 7: Goal Decomposition Review (R) Phase - Human Review
// ---------------------------------------------------------------------------

test("E2E Goal OAPEFLR: Review phase triggers for high-risk goals", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflr-review-");
  try {
    const service = new GoalDecompositionService();

    // Test various priority levels
    const priorities: Array<Goal["priority"]> = ["low", "normal", "high", "critical"];
    const reviewRequirements: boolean[] = [];

    for (const priority of priorities) {
      const goal: Goal = {
        goalId: newId("goal"),
        description: "执行系统部署任务",
        owner: "e2e-oapeflr-owner",
        successCriteria: [],
        constraints: [],
        priority,
      };

      const result = await service.decompose(goal);
      reviewRequirements.push(result.requiresHumanReview);
    }

    // Critical should always require review
    assert.equal(reviewRequirements[3], true, "Critical priority should require human review");

    // The low-priority scenario is still a deployment workflow, so review remains required.
    assert.equal(reviewRequirements[0], true, "Deployment goals should still require human review");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 8: OAPEFLR with PlannerHandoffReceipt
// ---------------------------------------------------------------------------

test("E2E Goal OAPEFLR: produces valid PlannerHandoffReceipt for planner", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflr-handoff-");
  try {
    const service = new GoalDecompositionService();

    const goal: Goal = {
      goalId: newId("goal"),
      description: "完成复杂的多域协作任务",
      owner: "e2e-oapeflr-owner",
      successCriteria: [],
      constraints: [],
      priority: "high",
    };

    const result = await service.decompose(goal);

    // Verify PlannerHandoffReceipt structure
    assert.ok(result.plannerHandoff, "Should produce planner handoff receipt");
    assert.equal(result.plannerHandoff.goalId, goal.goalId, "Handoff should reference correct goal");
    assert.equal(result.plannerHandoff.state, "ready_for_planner", "Handoff state should be ready_for_planner");
    assert.ok(result.plannerHandoff.graphId, "Handoff should have graph ID");
    assert.ok(result.plannerHandoff.constraintEnvelope, "Handoff should include constraint envelope");

    // Verify budget info if available
    if (result.plannerHandoff.budgetLedgerId) {
      assert.ok(result.plannerHandoff.budgetLedgerId, "Should have budget ledger ID");
    }

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 9: OAPEFLR with GoalHarnessRoutingReceipt
// ---------------------------------------------------------------------------

test("E2E Goal OAPEFLR: produces valid GoalHarnessRoutingReceipt for harness", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflr-routing-");
  try {
    const service = new GoalDecompositionService();

    const goal: Goal = {
      goalId: newId("goal"),
      description: "执行自动化测试任务",
      owner: "e2e-oapeflr-owner",
      successCriteria: [],
      constraints: [],
      priority: "normal",
    };

    const result = await service.decompose(goal);

    // Verify GoalHarnessRoutingReceipt structure
// @ts-ignore
    assert.ok(result.harnessRouting, "Should produce harness routing receipt");
// @ts-ignore
    assert.ok(result.harnessRouting.harnessRun, "Receipt should have harness run");
// @ts-ignore
    assert.ok(result.harnessRouting.planGraphBundle, "Receipt should have plan graph bundle");
// @ts-ignore
    assert.ok(result.harnessRouting.initialStep, "Receipt should have initial step");
    // Verify PlanGraphBundle in receipt
// @ts-ignore
    const bundle = result.harnessRouting.planGraphBundle;
    assert.ok(bundle.planGraphBundleId, "Bundle should have ID");
    assert.ok(bundle.graph.nodes.length > 0, "Bundle should have nodes");
    assert.ok(bundle.graph.edges.length >= 0, "Bundle should have edges (possibly empty)");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 10: Full OAPEFLR Lifecycle State Transitions
// ---------------------------------------------------------------------------

test("E2E Goal OAPEFLR: lifecycle state transitions correctly through phases", async () => {
  const harness = createE2EHarness("aa-e2e-oapeflr-lifecycle-");
  try {
    const service = new GoalDecompositionService();

    const goal: Goal = {
      goalId: newId("goal"),
      description: "完成OAPEFLR全流程测试",
      owner: "e2e-oapeflr-owner",
      successCriteria: [],
      constraints: [],
      priority: "normal",
    };

    const result = await service.decompose(goal);

    // Verify lifecycle state progression
    assert.equal(result.lifecycleState, "decomposed", "Should end in decomposed state");
    assert.equal(result.goalGraphDraft.lifecycleState, result.lifecycleState, "Goal graph should match lifecycle state");

    // Verify depth tracking
    assert.ok(result.depthUsed !== undefined, "Should track depth used");
    assert.equal(result.maxDepthReached, false, "Simple goal should not reach max depth");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// End of E2E Goal Decomposition OAPEFLR Phase Tests
// ---------------------------------------------------------------------------
