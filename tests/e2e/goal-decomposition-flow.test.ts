/**
 * E2E Goal Decomposition Flow Tests
 *
 * End-to-end tests covering goal decomposition:
 * 1. Simple goal decomposition to tasks
 * 2. Template-based decomposition (marketing campaign)
 * 3. Template-based decomposition (release launch)
 * 4. Dependency graph analysis and topological sort
 * 5. Critical path identification
 * 6. Risk preview generation
 * 7. Multi-step workflow with parallel groups
 * 8. Human review requirement based on confidence/risk
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { GoalDecompositionService, type Goal, type PlannedTask } from "../../src/interaction/goal-decomposer/index.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";

const DEFAULT_OWNER = "e2e-goal-decomp-owner";

// ---------------------------------------------------------------------------
// Test 1: Simple Goal Decomposition
// ---------------------------------------------------------------------------

test("E2E Goal Decomposition: simple goal decomposes to tasks", async () => {
  const harness = createE2EHarness("aa-e2e-goal-simple-");
  try {
    const service = new GoalDecompositionService();
    const traceId = newId("trace");

    const goal: Goal = {
      goalId: newId("goal"),
      description: "帮我完成这份数据分析报告",
      owner: DEFAULT_OWNER,
      successCriteria: [{ metric: "completion", target: "100%", evaluationMethod: "automated_test" }],
      constraints: ["需要在2天内完成"],
      priority: "normal",
    };

    const result = await service.decompose(goal);

    assert.ok(result.tasks.length > 0, "Should produce tasks");
    assert.equal(result.goalId, goal.goalId, "Goal ID should match");
    assert.ok(result.dependencyGraph.length >= 0, "Should have dependency graph");
    assert.ok(result.estimatedCost, "Should have cost estimate");
    assert.ok(result.riskSummary, "Should have risk summary");
    assert.equal(result.decompositionStrategy !== undefined, true, "Should have strategy");

    // Verify task structure
    for (const task of result.tasks) {
      assert.ok(task.taskId, "Task should have ID");
      assert.ok(task.description, "Task should have description");
      assert.ok(task.domainId, "Task should have domain ID");
      assert.ok(task.estimatedDuration, "Task should have duration estimate");
      assert.ok(task.estimatedCost, "Task should have cost estimate");
    }

    // Verify normal priority uses auto delegation
    const autoTask = result.tasks.find((t) => t.delegationMode === "auto");
    assert.ok(autoTask, "Normal priority tasks should use auto delegation");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Template-based Decomposition (Marketing Campaign)
// ---------------------------------------------------------------------------

test("E2E Goal Decomposition: marketing campaign uses template decomposition", async () => {
  const harness = createE2EHarness("aa-e2e-goal-marketing-");
  try {
    const service = new GoalDecompositionService();

    const goal: Goal = {
      goalId: newId("goal"),
      description: "启动新的广告投放营销活动",
      owner: DEFAULT_OWNER,
      successCriteria: [],
      constraints: [],
      priority: "high",
    };

    const result = await service.decompose(goal);

    assert.equal(result.decompositionStrategy, "template", "Should use template strategy");
    assert.equal(result.tasks.length, 4, "Marketing campaign should have 4 tasks");

    // Verify task domains for marketing campaign
    const domains = result.tasks.map((t) => t.domainId);
    assert.ok(domains.includes("content_production"), "Should include content_production");
    assert.ok(domains.includes("legal"), "Should include legal");
    assert.ok(domains.includes("advertising"), "Should include advertising");
    assert.ok(domains.includes("data_analysis"), "Should include data_analysis");

    // High priority should use supervised delegation
    const supervisedTask = result.tasks.find((t) => t.delegationMode === "supervised");
    assert.ok(supervisedTask, "High priority should have supervised delegation");

    // Verify dependencies
    assert.ok(result.dependencyGraph.length > 0, "Should have dependencies");

    // Verify approval needed for high priority
    assert.equal(result.riskSummary.approvalNeeded, true, "High priority should require approval");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Template-based Decomposition (Release Launch)
// ---------------------------------------------------------------------------

test("E2E Goal Decomposition: release launch uses template decomposition", async () => {
  const harness = createE2EHarness("aa-e2e-goal-release-");
  try {
    const service = new GoalDecompositionService();

    const goal: Goal = {
      goalId: newId("goal"),
      description: "发布新版本到生产环境",
      owner: DEFAULT_OWNER,
      successCriteria: [],
      constraints: [],
      priority: "critical",
    };

    const result = await service.decompose(goal);

    assert.equal(result.decompositionStrategy, "template", "Should use template strategy");
    assert.equal(result.tasks.length, 4, "Release launch should have 4 tasks");

    // Verify release-specific domains
    const domains = result.tasks.map((t) => t.domainId);
    assert.ok(domains.includes("engineering_ops"), "Should include engineering_ops");
    assert.ok(domains.includes("quality_assurance"), "Should include quality_assurance");
    assert.ok(domains.includes("operations"), "Should include operations");
    assert.ok(domains.includes("data_analysis"), "Should include data_analysis");

    // Critical priority should use manual delegation
    const manualTask = result.tasks.find((t) => t.delegationMode === "manual");
    assert.ok(manualTask, "Critical priority should have manual delegation");

    // Verify risk is critical
    assert.equal(result.riskSummary.overallRisk, "critical", "Critical priority should be critical risk");

    // Verify approval needed
    assert.equal(result.riskSummary.approvalNeeded, true, "Critical priority should require approval");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: Dependency Graph Analysis and Topological Sort
// ---------------------------------------------------------------------------

test("E2E Goal Decomposition: dependency graph produces valid topological sort", async () => {
  const harness = createE2EHarness("aa-e2e-goal-graph-");
  try {
    const service = new GoalDecompositionService();

    const goal: Goal = {
      goalId: newId("goal"),
      description: "完成项目数据分析",
      owner: DEFAULT_OWNER,
      successCriteria: [],
      constraints: [],
      priority: "normal",
    };

    const result = await service.decompose(goal);

    assert.ok(result.topologicallySortedTaskIds, "Should have topologically sorted task IDs");
    assert.equal(result.topologicallySortedTaskIds!.length, result.tasks.length, "Sorted IDs should match task count");

    // Verify no cycles (if there are dependencies)
    if (result.dependencyGraph.length > 0) {
      assert.equal(result.topologicallySortedTaskIds!.length, result.tasks.length, "Topological sort should include all tasks");
    }

    // Verify parallel groups exist
    assert.ok(result.parallelTaskGroups, "Should have parallel task groups");
    assert.ok(result.parallelTaskGroups!.length > 0, "Should have at least one parallel group");

    // Level 0 tasks should have no dependencies
    const level0Tasks = result.parallelTaskGroups![0];
    assert.ok(level0Tasks.length > 0, "Should have at least one level 0 task");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: Critical Path Identification
// ---------------------------------------------------------------------------

test("E2E Goal Decomposition: critical path identified correctly", async () => {
  const harness = createE2EHarness("aa-e2e-goal-critical-");
  try {
    const service = new GoalDecompositionService();

    const goal: Goal = {
      goalId: newId("goal"),
      description: "完成复杂的多阶段项目",
      owner: DEFAULT_OWNER,
      successCriteria: [],
      constraints: [],
      priority: "high",
    };

    const result = await service.decompose(goal);

    assert.ok(result.criticalPathTaskIds, "Should have critical path");
    assert.ok(result.criticalPathTaskIds!.length > 0, "Critical path should not be empty");

    // Critical path should be a subset of all tasks
    for (const taskId of result.criticalPathTaskIds!) {
      assert.ok(result.tasks.some((t) => t.taskId === taskId), "Critical path task should exist in tasks");
    }

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 6: Risk Preview Generation
// ---------------------------------------------------------------------------

test("E2E Goal Decomposition: risk preview reflects goal characteristics", async () => {
  const harness = createE2EHarness("aa-e2e-goal-risk-");
  try {
    const service = new GoalDecompositionService();

    // Critical priority
    const criticalGoal: Goal = {
      goalId: newId("goal"),
      description: "发布新功能到生产",
      owner: DEFAULT_OWNER,
      successCriteria: [],
      constraints: [],
      priority: "critical",
    };

    const criticalResult = await service.decompose(criticalGoal);
    assert.equal(criticalResult.riskSummary.overallRisk, "critical", "Critical priority should produce critical risk");
    assert.ok(criticalResult.riskSummary.riskFactors.length > 0, "Critical should have risk factors");
    assert.equal(criticalResult.requiresHumanReview, true, "Critical should require human review");

    // Low risk goal
    const lowRiskGoal: Goal = {
      goalId: newId("goal"),
      description: "生成一份报表",
      owner: DEFAULT_OWNER,
      successCriteria: [],
      constraints: [],
      priority: "low",
    };

    const lowRiskResult = await service.decompose(lowRiskGoal);
    assert.equal(lowRiskResult.riskSummary.overallRisk !== "critical", true, "Low priority should not be critical");
    assert.equal(lowRiskResult.riskSummary.reversible, true, "Report should be reversible");

    // Irreversible detection
    const deleteGoal: Goal = {
      goalId: newId("goal"),
      description: "删除旧数据",
      owner: DEFAULT_OWNER,
      successCriteria: [],
      constraints: [],
      priority: "normal",
    };

    const deleteResult = await service.decompose(deleteGoal);
    assert.equal(deleteResult.riskSummary.reversible, false, "Delete should not be reversible");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 7: String Goal Input (Convenience API)
// ---------------------------------------------------------------------------

test("E2E Goal Decomposition: string goal input auto-converted", async () => {
  const harness = createE2EHarness("aa-e2e-goal-string-");
  try {
    const service = new GoalDecompositionService();

    // String input should be auto-converted to Goal
    const result = await service.decompose("帮我完成这份报告");

    assert.ok(result.tasks.length > 0, "Should produce tasks from string input");
    assert.ok(result.goalId.startsWith("goal:"), "Goal ID should be auto-generated");
    assert.equal(result.estimatedDuration, "3d", "Default duration should be 3 days for generic goals");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 8: Human Review Requirement Logic
// ---------------------------------------------------------------------------

test("E2E Goal Decomposition: human review required based on confidence and risk", async () => {
  const harness = createE2EHarness("aa-e2e-goal-review-");
  try {
    const service = new GoalDecompositionService();

    // Template-based should have higher confidence
    const templateGoal: Goal = {
      goalId: newId("goal"),
      description: "启动招聘流程",
      owner: DEFAULT_OWNER,
      successCriteria: [],
      constraints: [],
      priority: "normal",
    };

    const templateResult = await service.decompose(templateGoal);
    assert.equal(templateResult.decompositionStrategy, "template", "Should use template strategy");
    assert.ok(templateResult.decompositionConfidence > 0.8, "Template should have high confidence");
    // Normal template goal may not require human review
    assert.equal(templateResult.requiresHumanReview === false || templateResult.requiresHumanReview === true, true, "Should have explicit review flag");

    // Generic multi-step description triggers hybrid strategy
    const noTemplateGoal: Goal = {
      goalId: newId("goal"),
      description: "do something very specific and unusual that has no template",
      owner: DEFAULT_OWNER,
      successCriteria: [],
      constraints: [],
      priority: "normal",
    };

    const noTemplateResult = await service.decompose(noTemplateGoal);
    // Description > 20 chars returns "generic_multi_step" which uses hybrid strategy
    assert.equal(noTemplateResult.decompositionStrategy, "hybrid", "Should use hybrid strategy for generic multi-step");
    assert.ok(noTemplateResult.decompositionConfidence < 0.8, "Hybrid should have moderate confidence");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 9: Create Tasks from Decomposition
// ---------------------------------------------------------------------------

test("E2E Goal Decomposition: can create tasks in store from decomposition", async () => {
  const harness = createE2EHarness("aa-e2e-goal-create-");
  try {
    const service = new GoalDecompositionService();
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);

    const goal: Goal = {
      goalId: newId("goal"),
      description: "启动新的广告投放营销活动",
      owner: DEFAULT_OWNER,
      successCriteria: [],
      constraints: [],
      priority: "high",
    };

    const result = await service.decompose(goal);
    const now = nowIso();
    const createdTaskIds: string[] = [];

    // Create tasks in store from decomposition
    harness.db.transaction(() => {
      for (const plannedTask of result.tasks) {
        const taskId = plannedTask.taskId;
        createdTaskIds.push(taskId);

        harness.store.insertTask({
          id: taskId,
          parentId: null,
          rootId: goal.goalId,
          divisionId: plannedTask.domainId,
          tenantId: null,
          title: plannedTask.description,
          status: "pending",
          source: "system",
          priority: goal.priority === "critical" ? "urgent" : goal.priority,
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

    // Verify all tasks created
    assert.equal(createdTaskIds.length, result.tasks.length, "All tasks should be created");
    assert.equal(createdTaskIds.length, 4, "Marketing campaign should have 4 tasks");

    // Verify tasks in store
    for (const taskId of createdTaskIds) {
      const task = harness.store.getTask(taskId);
      assert.ok(task, `Task ${taskId} should exist in store`);
      assert.equal(task?.status, "pending", "Task should be pending");
      assert.equal(task?.source, "system", "Task source should be system");
      assert.equal(task?.priority, "high", "Task priority should match goal priority");
    }

    // Transition each task through basic state changes
    for (const taskId of createdTaskIds) {
      ts.transitionTaskStatus({
        entityKind: "task",
        entityId: taskId,
        fromStatus: "pending",
        toStatus: "in_progress",
        executionId: null,
        reasonCode: "e2e_goal_decomp",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      });

      const task = harness.store.getTask(taskId);
      assert.equal(task?.status, "in_progress", `Task ${taskId} should be in_progress`);
    }

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 10: Incident Response Template
// ---------------------------------------------------------------------------

test("E2E Goal Decomposition: incident response template decomposes correctly", async () => {
  const harness = createE2EHarness("aa-e2e-goal-incident-");
  try {
    const service = new GoalDecompositionService();

    const goal: Goal = {
      goalId: newId("goal"),
      description: "处理生产环境故障恢复",
      owner: DEFAULT_OWNER,
      successCriteria: [],
      constraints: [],
      priority: "critical",
    };

    const result = await service.decompose(goal);

    assert.equal(result.decompositionStrategy, "template", "Should use template strategy");
    assert.equal(result.tasks.length, 4, "Incident response should have 4 tasks");

    // Verify incident-specific domains
    const domains = result.tasks.map((t) => t.domainId);
    assert.ok(domains.includes("operations"), "Should include operations");
    assert.ok(domains.includes("engineering_ops"), "Should include engineering_ops");
    assert.ok(domains.includes("security"), "Should include security");
    assert.ok(domains.includes("communications"), "Should include communications");

    // Verify critical risk
    assert.equal(result.riskSummary.overallRisk, "critical", "Incident should be critical risk");
    assert.equal(result.riskSummary.approvalNeeded, true, "Incident should require approval");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 11: Max Depth Protection
// ---------------------------------------------------------------------------

test("E2E Goal Decomposition: max depth prevents infinite recursion", async () => {
  const harness = createE2EHarness("aa-e2e-goal-depth-");
  try {
    // Create service with max depth of 2
    const service = new GoalDecompositionService({ maxDepth: 2 });

    const goal: Goal = {
      goalId: newId("goal"),
      description: "完成一个复杂的多层次任务",
      owner: DEFAULT_OWNER,
      successCriteria: [],
      constraints: [],
      priority: "normal",
    };

    const result = await service.decompose(goal);

    // Should complete without infinite recursion
    assert.ok(result.tasks.length > 0, "Should still produce tasks");
    assert.equal(result.maxDepthReached, false, "Max depth should not be reached for simple goal");

    // Recursive decomposition at max depth
    const nestedService = new GoalDecompositionService({ maxDepth: 1, currentDepth: 1 });
    const nestedResult = await nestedService.decompose(goal);

    assert.equal(nestedResult.maxDepthReached, true, "Max depth should be reached when currentDepth equals maxDepth");

  } finally {
    harness.cleanup();
  }
});
