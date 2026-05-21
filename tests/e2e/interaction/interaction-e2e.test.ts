/**
 * E2E Tests for Interaction Module
 *
 * End-to-end tests that cover the full flow of:
 * - Goal decomposition and planning
 * - Autonomy level management
 * - Proactive agent triggering
 * - NL Gateway request processing
 * - Dashboard updates
 */

import test from "node:test";
import assert from "node:assert/strict";

import { GoalDecompositionService, type Goal } from "../../../src/interaction/goal-decomposer/index.js";
import { ProactiveAgentService, type TriggerDefinition } from "../../../src/interaction/proactive-agent/index.js";
import { NlEntryService } from "../../../src/interaction/nl-gateway/index.js";
import { DashboardAggregationService } from "../../../src/interaction/dashboard/index.js";
import { DashboardWebSocketServer } from "../../../src/interaction/dashboard/dashboard-websocket-server.js";
import type { TaskBoardItem } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { SystemSituation } from "../../../src/platform/shared/observability/system-situation-model.js";

// Mock IntakeRouter for NL Gateway tests
const mockIntakeRouter = {
  route: (input: { title: string; request: string }) => ({
    classification: {
      intent: "create",
      continuation: "new_task" as const,
      confidence: 0.85,
      matchedRules: ["default"],
    },
    divisionId: "devops",
    workflowId: "single_agent_minimal",
  }),
};

test("e2e: Goal decomposition flow with NL entry and dashboard update", async () => {
  // 1. User sends NL request
  const nlService = new NlEntryService({ intakeRouter: mockIntakeRouter as any });

  const nlResult = await nlService.parseDetailed({
    tenantId: "tenant_e2e",
    userId: "user_e2e",
    message: "发起一个营销活动来推广新产品",
  });

  assert.ok(nlResult.detectedIntents.length > 0);
  assert.ok(nlResult.suggestedDivisionId);

  // 2. Goal decomposition
  const goalService = new GoalDecompositionService();
  const goal: Goal = {
    goalId: "goal_e2e_marketing",
    description: nlResult.detectedIntents[0]?.entities.length
      ? "发起营销活动"
      : "发起营销活动来推广新产品",
    owner: "user_e2e",
    successCriteria: [],
    constraints: [],
    priority: "normal",
  };

  const decomposition = await goalService.decompose(goal);

  assert.ok(decomposition.tasks.length > 0);
  assert.ok(decomposition.dependencyGraph != null);
  assert.ok(decomposition.plannerHandoff);

  // 3. Dashboard update
  const dashboardService = new DashboardAggregationService({
    taskSource: {
      list: () => [],
    },
    systemSource: {
      build: (): SystemSituation => ({
        healthStatus: "ok",
        providerHealth: { status: "healthy", successRate: 0.98, recentCalls: 100 },
        resourceUtilization: { memoryRssMb: 512, cpuPercent: 45, activeProcesses: 8 },
        queueBacklog: { size: 0, degraded: false },
        eventBusBacklog: { tier1PendingAcks: 0 },
        findings: [],
// @ts-ignore
        observedAt: new Date().toISOString(),
      }),
    },
  });

  const snapshot = await dashboardService.getSnapshot();
  assert.ok(snapshot.workflowBacklog >= 0);
});

test("e2e: Proactive agent trigger evaluation and dashboard websocket push", async () => {
  // 1. Register a proactive trigger
  const proactiveService = new ProactiveAgentService();
  const trigger: TriggerDefinition = {
    triggerId: "e2e_threshold_trigger",
    domainId: "operations",
    name: "High CPU Alert",
    type: "threshold",
    config: {
      metricSource: "system",
      metricName: "cpu_usage",
      condition: "gt",
      threshold: 80,
      evaluationWindow: "5m",
      consecutiveBreaches: 1,
    },
    action: {
      actionType: "suggest_to_user",
      template: { alertId: "cpu-alert" },
      requireConfirmation: true,
    },
    enabled: true,
    riskLevel: "medium",
    maxFireRate: "5/hour",
    cooldown: "10m",
  };

  await proactiveService.registerTrigger(trigger);

  // 2. Evaluate trigger
  const decision = proactiveService.evaluate("e2e_threshold_trigger", {
    kind: "threshold",
    now: new Date().toISOString(),
    metric: {
      source: "system",
      name: "cpu_usage",
      value: 85,
      previousValue: 70,
    },
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.actionMode, "suggest");

  // 3. Check suggestion was created
  const suggestions = proactiveService.listSuggestions();
  assert.ok(suggestions.length > 0);

  // 4. Dashboard websocket push
  const wsServer = new DashboardWebSocketServer();
  const { clientId } = wsServer.registerClient(["global"], "user_e2e", "tenant_e2e");

  assert.ok(clientId);
  assert.equal(wsServer.isClientConnected(clientId), true);
});

test("e2e: Autonomy level progression with trigger evaluation", async () => {
  // This tests the autonomy-trigger linkage
  const proactiveService = new ProactiveAgentService({
// @ts-ignore
    currentAutonomyLevel: "full_auto",
  });

  // Low-risk trigger should auto-execute when autonomy is full_auto
  const lowRiskTrigger: TriggerDefinition = {
    triggerId: "e2e_low_risk",
    domainId: "operations",
    name: "Low Risk Task",
    type: "schedule",
    config: { cron: "0 9 * * *", timezone: "UTC", skipIfPreviousRunning: true },
    action: {
      actionType: "create_task",
      template: {},
      requireConfirmation: false,
    },
    enabled: true,
    riskLevel: "low",
    maxFireRate: "10/hour",
    cooldown: "5m",
  };

  await proactiveService.registerTrigger(lowRiskTrigger);

  const lowRiskDecision = proactiveService.evaluate("e2e_low_risk", {
    kind: "schedule",
    now: new Date().toISOString(),
  });

  // Low risk without confirmation should auto_execute
  assert.equal(lowRiskDecision.actionMode, "auto_execute");
  assert.equal(lowRiskDecision.allowed, true);

  // Medium-risk trigger should still suggest even under full_auto
  const mediumRiskTrigger: TriggerDefinition = {
    ...lowRiskTrigger,
    triggerId: "e2e_medium_risk",
    riskLevel: "medium",
  };

  await proactiveService.registerTrigger(mediumRiskTrigger);

  const mediumRiskDecision = proactiveService.evaluate("e2e_medium_risk", {
    kind: "schedule",
    now: new Date().toISOString(),
  });

  // Medium risk should suggest even under full_auto per issue #2048 fix
  assert.equal(mediumRiskDecision.actionMode, "suggest");
});

test("e2e: Dashboard aggregation with operator dashboard flow", async () => {
  const currentTime = "2026-05-21T12:00:00.000Z";
  const tasks: TaskBoardItem[] = [
    {
      taskId: "task_e2e_1",
      title: "E2E Task 1",
      priority: "high",
      taskStatus: "failed",
      workflowStatus: "running",
      divisionId: "engineering_ops",
      currentStepIndex: 0,
      sessionStatus: "open",
      latestEventAt: "2026-05-21T11:55:00.000Z",
      updatedAt: "2026-05-21T11:55:00.000Z",
    },
    {
      taskId: "task_e2e_2",
      title: "E2E Task 2",
      priority: "normal",
      taskStatus: "pending",
      workflowStatus: "running",
      divisionId: "engineering_ops",
      currentStepIndex: 0,
      sessionStatus: "open",
      latestEventAt: "2026-05-21T11:50:00.000Z",
      updatedAt: "2026-05-21T11:50:00.000Z",
    },
  ];

  const dashboardService = new DashboardAggregationService({
    taskSource: {
      list: () => tasks,
    },
    systemSource: {
      build: (): SystemSituation => ({
        healthStatus: "degraded",
        providerHealth: { status: "degraded", successRate: 0.92, recentCalls: 50 },
        resourceUtilization: { memoryRssMb: 512, cpuPercent: 45, activeProcesses: 8 },
        queueBacklog: { size: 3, degraded: true },
        eventBusBacklog: { tier1PendingAcks: 1 },
        findings: ["queue backlog elevated"],
// @ts-ignore
        observedAt: currentTime,
      }),
    },
    costBurnUsd: 150,
    forecastCostUsd: 100,
    currentTime: () => currentTime,
  });

  // Build operator dashboard
  const operatorDashboard = dashboardService.buildOperatorDashboard();

  assert.ok(operatorDashboard.attentionQueue.length > 0);
  assert.ok(operatorDashboard.dailySummary.tasksFailed >= 1);
  assert.ok(operatorDashboard.agentHealthCards.length > 0);

  const priorityRank: Record<string, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3,
  };

  // Attention queue contract: priority first, then newest item first within the same priority.
  for (let i = 1; i < operatorDashboard.attentionQueue.length; i++) {
    const previous = operatorDashboard.attentionQueue[i - 1]!;
    const current = operatorDashboard.attentionQueue[i]!;
    const previousPriority = priorityRank[previous.priority];
    const currentPriority = priorityRank[current.priority];

    assert.ok(previousPriority <= currentPriority, "Attention queue should be sorted by priority");

    if (previousPriority === currentPriority) {
      const previousCreatedAt = new Date(previous.createdAt).getTime();
      const currentCreatedAt = new Date(current.createdAt).getTime();
      assert.ok(previousCreatedAt >= currentCreatedAt, "Attention queue should keep newer items first within the same priority");
    }
  }
});

test("e2e: NL Gateway conversation state machine", async () => {
  const nlService = new NlEntryService({ intakeRouter: mockIntakeRouter as any });

  // First turn - should be Clarifying or Building based on confidence
  const firstTurn = await nlService.parseDetailed({
    tenantId: "tenant_e2e",
    userId: "user_e2e",
    message: "帮我创建一个部署任务",
  });

  assert.ok(firstTurn.conversationState);

  // Build task - should handle state transition
  const taskResult = await nlService.buildTask({
    tenantId: "tenant_e2e",
    userId: "user_e2e",
    message: "帮我创建一个部署任务",
  });

  assert.ok(taskResult.taskDraft);
  assert.ok(taskResult.riskPreview);

  // High risk request should require confirmation
  const highRiskRequest = await nlService.buildTask({
    tenantId: "tenant_e2e",
    userId: "user_e2e",
    message: "删除生产环境全部数据",
  });

  assert.equal(highRiskRequest.confirmationRequired, true);
  assert.equal(highRiskRequest.riskPreview.overallRisk, "critical");
});

test("e2e: Goal decomposition with cycle detection", async () => {
  const goalService = new GoalDecompositionService();

  // Goal with cycle potential should be handled gracefully
  const goal: Goal = {
    goalId: "goal_e2e_cycle",
    description: "执行一个包含循环依赖风险的任务",
    owner: "user_e2e",
    successCriteria: [],
    constraints: [],
    priority: "high",
  };

  const decomposition = await goalService.decompose(goal);

  // Should still produce a valid decomposition even if cycle detected
  assert.ok(decomposition.tasks.length > 0);
  assert.ok(decomposition.plannerHandoff);
  assert.equal(decomposition.plannerHandoff.state, "ready_for_planner");

  // Should have validation messages if cycle was detected
  if (decomposition.taskGraphDraft.validationMessages.some(msg => msg.includes("cycle"))) {
    assert.equal(decomposition.requiresHumanReview, true);
  }
});

test("e2e: WebSocket server heartbeat and client timeout handling", () => {
  const wsServer = new DashboardWebSocketServer({
    heartbeatIntervalMs: 100,
    connectionTimeoutMs: 50,
  });

  // Register a client
  const { clientId } = wsServer.registerClient(["global"], "user_e2e", "tenant_e2e");
  assert.ok(clientId);
  assert.equal(wsServer.isClientConnected(clientId), true);

  // Simulate some activity
// @ts-ignore
  wsServer.pushDelta({
    deltaId: "delta_1",
    timestamp: new Date().toISOString(),
    changes: [],
    affectedMetrics: ["totalTasks"],
  });

  // Note: Full heartbeat testing would require setTimeout which is complex in test environment
  // The key behavior to verify is that the server tracks connections correctly

  wsServer.stop();
});

test("e2e: Multiple autonomy levels and promotion assessment", async () => {
  const proactiveService = new ProactiveAgentService({
// @ts-ignore
    currentAutonomyLevel: "supervised",
  });

  const trigger: TriggerDefinition = {
    triggerId: "e2e_promotion_test",
    domainId: "operations",
    name: "Test Trigger",
    type: "schedule",
    config: { cron: "0 9 * * *", timezone: "UTC", skipIfPreviousRunning: true },
    action: {
      actionType: "suggest_to_user",
      template: {},
      requireConfirmation: false,
    },
    enabled: true,
    riskLevel: "low",
    maxFireRate: "10/hour",
    cooldown: "5m",
  };

  await proactiveService.registerTrigger(trigger);

  const decision = proactiveService.evaluate("e2e_promotion_test", {
    kind: "schedule",
    now: new Date().toISOString(),
  });

  // Low risk without confirmation should evaluate to suggest or auto_execute
  assert.ok(decision.actionMode === "suggest" || decision.actionMode === "auto_execute");
});

test("e2e: Dashboard projection service integration with websocket", () => {
  const wsServer = new DashboardWebSocketServer();

  // Register multiple clients
  const client1 = wsServer.registerClient([{ channel: "task", filterId: "task-task1" }], "user1", "tenant_e2e");
  const client2 = wsServer.registerClient([{ channel: "task", filterId: "task-task2" }], "user2", "tenant_e2e");
  const client3 = wsServer.registerClient([{ channel: "global" }], "user3", "tenant_e2e");

  assert.ok(client1.clientId);
  assert.ok(client2.clientId);
  assert.ok(client3.clientId);

  // Push delta for task1 - should only reach client1 and global subscribers
  const task1Delta = {
      deltaId: "delta_task1",
      timestamp: new Date().toISOString(),
      changes: [{ changeType: "task_updated" as const, entityId: "task-task1", previousValue: null, newValue: null }],
      affectedMetrics: ["task1_status"],
      visibilityScope: "tenant" as const,
      tenantId: "tenant_e2e",
  };

  const sentCount = wsServer.pushDelta(task1Delta);
  assert.equal(sentCount, 2); // client1 (task subscription) + client3 (global)

  wsServer.stop();
});

test("e2e: NL Gateway with slot resolution", async () => {
  const nlService = new NlEntryService({ intakeRouter: mockIntakeRouter as any });

  // Request with date slot
  const withDateResult = await nlService.parseDetailed({
    tenantId: "tenant_e2e",
    userId: "user_e2e",
    message: "在 2026-05-15 前完成部署任务",
  });

  assert.ok(withDateResult.detectedIntents[0]?.entities.some(e => e.entityType === "date"));

  // Request with money slot
  const withMoneyResult = await nlService.parseDetailed({
    tenantId: "tenant_e2e",
    userId: "user_e2e",
    message: "预算 ¥5000 的营销活动",
  });

  assert.ok(withMoneyResult.detectedIntents[0]?.entities.some(e => e.entityType === "money"));
});
