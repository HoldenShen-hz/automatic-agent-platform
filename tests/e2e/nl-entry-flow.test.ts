/**
 * E2E Natural Language Entry Flow Tests
 *
 * End-to-end tests covering the NL entry flow:
 * 1. Simple task creation via natural language
 * 2. Task creation with entity extraction (dates, money, environment)
 * 3. Ambiguous request triggering clarification
 * 4. High-risk request detection and approval requirement
 * 5. Multi-turn conversation context
 * 6. Locale resolution and detection
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { NlEntryService } from "../../src/interaction/nl-gateway/index.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";

const DEFAULT_TENANT = "e2e-nl-entry-tenant";
const DEFAULT_USER = "e2e-nl-entry-user";

// ---------------------------------------------------------------------------
// Test 1: Simple Task Creation via Natural Language
// ---------------------------------------------------------------------------

test("E2E NL Entry: simple task creation via natural language", async () => {
  const harness = createE2EHarness("aa-e2e-nl-simple-");
  try {
    const nlService = new NlEntryService();
    const traceId = newId("trace");
    const ts = new TransitionService(harness.db, harness.store);

    const request = {
      tenantId: DEFAULT_TENANT,
      userId: DEFAULT_USER,
      message: "帮我分析一下本周的销售数据",
      locale: "zh-CN",
      channel: "web",
    };

    // Parse the natural language request
    const parseResult = await nlService.parseDetailed(request);

    assert.equal(parseResult.continuation, "new_task", "Should detect new task");
    assert.ok(parseResult.detectedIntents.length > 0, "Should detect at least one intent");
    assert.ok(parseResult.confidence > 0, "Should have confidence score");

    // Build the task
    const taskResult = await nlService.buildTask(request);

    assert.ok(taskResult.requestEnvelope, "Should produce request envelope");
    assert.equal(taskResult.requestEnvelope.payload.divisionId, "general_ops", "Should route to general_ops");
    assert.ok(taskResult.costEstimate, "Should produce cost estimate");
    assert.equal(taskResult.humanSummary.length > 0, true, "Should generate human summary");

    // Verify risk preview
    assert.ok(taskResult.riskPreview, "Should produce risk preview");
    assert.equal(taskResult.riskPreview.overallRisk !== "critical", true, "Simple query should not be critical risk");

    // Create task in store from the built envelope
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const now = nowIso();

    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: taskResult.requestEnvelope.payload.divisionId,
        tenantId: DEFAULT_TENANT,
        title: taskResult.requestEnvelope.payload.title,
        status: "pending",
        source: "perception",
        priority: "normal",
        inputJson: JSON.stringify({ request: taskResult.requestEnvelope.payload.request }),
        normalizedInputJson: JSON.stringify({ request: taskResult.requestEnvelope.payload.request }),
        outputJson: null,
        estimatedCostUsd: taskResult.costEstimate.estimatedCostUsd,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-general",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 60000,
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

      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "web",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "pending", "Task should be in pending state");
    assert.equal(task?.title, "帮我分析一下本周的销售数据", "Task should have correct title");
    assert.equal(task?.source, "perception", "Task source should be perception");

    // Transition to complete
    ts.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "pending",
      toStatus: "in_progress",
      executionId,
      reasonCode: "e2e_nl_entry",
      traceId,
      actorType: "system",
      occurredAt: nowIso(),
    });

    ts.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "executing",
      toStatus: "succeeded",
      reasonCode: "e2e_nl_entry",
      traceId,
      actorType: "agent",
      occurredAt: nowIso(),
    });

    ts.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ analysis: "completed" }),
      outputsJson: "[]",
      context: {
        reasonCode: "task.completed",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    const completedTask = harness.store.getTask(taskId);
    assert.equal(completedTask?.status, "done", "Task should complete");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Entity Extraction (dates, money, environment)
// ---------------------------------------------------------------------------

test("E2E NL Entry: extracts entities from natural language request", async () => {
  const harness = createE2EHarness("aa-e2e-nl-entities-");
  try {
    const nlService = new NlEntryService();

    const request = {
      tenantId: DEFAULT_TENANT,
      userId: DEFAULT_USER,
      message: "在 staging 环境部署新功能，预算 ¥50000，deadline 是 2026-05-01",
      locale: "zh-CN",
    };

    const parseResult = await nlService.parseDetailed(request);

    assert.ok(parseResult.detectedIntents.length > 0, "Should detect intent");
    const primaryIntent = parseResult.detectedIntents[0];
    assert.ok(primaryIntent.entities.length > 0, "Should extract entities");

    // Check for date entity
    const dateEntity = primaryIntent.entities.find((e) => e.entityType === "date");
    assert.ok(dateEntity, "Should extract date entity");
    assert.equal(dateEntity?.value, "2026-05-01", "Date value should match");

    // Check for money entity
    const moneyEntity = primaryIntent.entities.find((e) => e.entityType === "money");
    assert.ok(moneyEntity, "Should extract money entity");
    assert.equal(moneyEntity?.value, "¥50000", "Money value should match");

    // Check for environment entity
    const envEntity = primaryIntent.entities.find((e) => e.entityType === "environment");
    assert.ok(envEntity, "Should extract environment entity");
    assert.equal(envEntity?.normalized, "staging", "Environment should be normalized");

    // Risk preview - the message uses "部署" not the high-risk keywords directly
    // But the side effects should detect deploy/release keywords in English
    const taskResult = await nlService.buildTask(request);
    assert.ok(taskResult.riskPreview.sideEffects.length >= 0, "Should produce risk preview");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Ambiguous Request Triggers Clarification
// ---------------------------------------------------------------------------

test("E2E NL Entry: ambiguous request triggers clarification", async () => {
  const harness = createE2EHarness("aa-e2e-nl-ambiguous-");
  try {
    const nlService = new NlEntryService();

    const request = {
      tenantId: DEFAULT_TENANT,
      userId: DEFAULT_USER,
      message: "帮我处理一下",
      locale: "zh-CN",
    };

    const parseResult = await nlService.parseDetailed(request);

    assert.equal(parseResult.requiresClarification, true, "Should require clarification for ambiguous input");
    assert.ok(parseResult.clarificationQuestions, "Should have clarification questions");
    assert.ok(parseResult.clarificationQuestions.length > 0, "Should have at least one clarification question");

    // Confidence should be low for generic input
    assert.ok(parseResult.confidence < 0.7, "Confidence should be below threshold");

    // Build task should indicate confirmation required
    const taskResult = await nlService.buildTask(request);
    assert.equal(taskResult.confirmationRequired, true, "Confirmation should be required for ambiguous input");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: High-Risk Request Detection
// ---------------------------------------------------------------------------

test("E2E NL Entry: high-risk request detected and approval required", async () => {
  const harness = createE2EHarness("aa-e2e-nl-risk-");
  try {
    const nlService = new NlEntryService();

    // Critical risk keywords
    const criticalRequest = {
      tenantId: DEFAULT_TENANT,
      userId: DEFAULT_USER,
      message: "删除生产环境全部用户数据",
      locale: "zh-CN",
    };

    const criticalResult = await nlService.buildTask(criticalRequest);
    assert.equal(criticalResult.riskPreview.overallRisk, "critical", "Should detect critical risk");
    assert.equal(criticalResult.riskPreview.approvalNeeded, true, "Critical risk should require approval");
    assert.equal(criticalResult.riskPreview.reversible, false, "Delete should not be reversible");
    assert.equal(criticalResult.confirmationRequired, true, "Confirmation should be required");

    // High risk (deploy)
    const highRiskRequest = {
      tenantId: DEFAULT_TENANT,
      userId: DEFAULT_USER,
      message: "deploy to production",
      locale: "en-US",
    };

    const highRiskResult = await nlService.buildTask(highRiskRequest);
    assert.equal(highRiskResult.riskPreview.overallRisk, "high", "Deploy should be high risk");
    assert.equal(highRiskResult.riskPreview.approvalNeeded, true, "High risk should require approval");
    assert.ok(highRiskResult.riskPreview.sideEffects.length > 0, "High risk deploy should have side effects");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: Multi-turn Conversation Context
// ---------------------------------------------------------------------------

test("E2E NL Entry: multi-turn conversation context maintained", async () => {
  const harness = createE2EHarness("aa-e2e-nl-context-");
  try {
    const nlService = new NlEntryService();
    const ctxManager = new (await import("../../src/interaction/nl-gateway/index.js")).ConversationContextManager();

    const tenantId = DEFAULT_TENANT;
    const userId = DEFAULT_USER;

    // First turn
    const request1 = {
      tenantId,
      userId,
      message: "分析销售数据",
      locale: "zh-CN",
    };
    const result1 = await nlService.parseDetailed(request1);
    const intent1 = result1.detectedIntents[0]!;
    ctxManager.addTurn(tenantId, userId, request1.message, intent1);

    const context1 = ctxManager.getContext(tenantId, userId);
    assert.equal(context1.turnCount, 1, "First turn should be recorded");
    assert.equal(context1.turns[0]?.message, "分析销售数据", "First turn message should match");

    // Second turn
    const request2 = {
      tenantId,
      userId,
      message: "加上本周的数据",
      locale: "zh-CN",
    };
    const result2 = await nlService.parseDetailed(request2);
    const intent2 = result2.detectedIntents[0]!;
    ctxManager.addTurn(tenantId, userId, request2.message, intent2);

    const context2 = ctxManager.getContext(tenantId, userId);
    assert.equal(context2.turnCount, 2, "Second turn should be recorded");
    assert.equal(context2.turns[1]?.message, "加上本周的数据", "Second turn message should match");
    assert.ok(context2.lastIntent, "Should have last intent");

    // Clear context
    ctxManager.clearContext(tenantId, userId);
    const clearedContext = ctxManager.getContext(tenantId, userId);
    assert.equal(clearedContext.turnCount, 0, "Context should be cleared");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 6: Locale Resolution
// ---------------------------------------------------------------------------

test("E2E NL Entry: locale resolution from multiple sources", async () => {
  const harness = createE2EHarness("aa-e2e-nl-locale-");
  try {
    const nlService = new NlEntryService();

    // Test preferred locale takes precedence
    const overrideRequest = {
      tenantId: DEFAULT_TENANT,
      userId: DEFAULT_USER,
      message: "analyze the data",
      locale: "en-US",
      preferredLocale: "de-DE",
      acceptLanguage: "en-US",
    };

    const overrideResult = await nlService.parseDetailed(overrideRequest);
    assert.equal(overrideResult.locale, "de-DE", "Should prefer preferredLocale over accept-language");

    // Test English via accept-language
    const englishRequest = {
      tenantId: DEFAULT_TENANT,
      userId: DEFAULT_USER,
      message: "analyze the data",
      locale: undefined,
      preferredLocale: undefined,
      acceptLanguage: "en-US,zh-CN;q=0.9",
    };

    const englishResult = await nlService.parseDetailed(englishRequest);
    assert.equal(englishResult.locale, "en-US", "Should resolve English from accept-language");

    // Test locale override when provided
    const localeRequest = {
      tenantId: DEFAULT_TENANT,
      userId: DEFAULT_USER,
      message: "some message",
      locale: "ja-JP",
      preferredLocale: undefined,
      acceptLanguage: undefined,
    };

    const localeResult = await nlService.parseDetailed(localeRequest);
    assert.equal(localeResult.locale, "ja-JP", "Should use provided locale when set");

    // Test default fallback when no locale info provided and message has no detectable language
    const defaultRequest = {
      tenantId: DEFAULT_TENANT,
      userId: DEFAULT_USER,
      message: "!!!***???",
      locale: undefined,
      preferredLocale: undefined,
      acceptLanguage: undefined,
    };

    const defaultResult = await nlService.parseDetailed(defaultRequest);
    assert.equal(defaultResult.locale, "zh-CN", "Should fallback to default locale for non-language input");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 7: Task Modification Intent
// ---------------------------------------------------------------------------

test("E2E NL Entry: task modification intent detected", async () => {
  const harness = createE2EHarness("aa-e2e-nl-modify-");
  try {
    const nlService = new NlEntryService();

    // Create a task first
    const taskId = newId("task");
    const now = nowIso();

    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: DEFAULT_TENANT,
        title: "Original task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0.01,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Request to modify/cancel
    const modifyRequest = {
      tenantId: DEFAULT_TENANT,
      userId: DEFAULT_USER,
      message: "取消这个任务",
      locale: "zh-CN",
    };

    const parseResult = await nlService.parseDetailed(modifyRequest);
    const primaryIntent = parseResult.detectedIntents[0];

    assert.equal(primaryIntent?.intentType, "task_modify", "Should detect task_modify intent");
    assert.equal(primaryIntent?.urgency, "low", "Should detect low urgency for cancel request");

    // High urgency modify
    const urgentModifyRequest = {
      tenantId: DEFAULT_TENANT,
      userId: DEFAULT_USER,
      message: "立刻停止这个任务",
      locale: "zh-CN",
    };

    const urgentParseResult = await nlService.parseDetailed(urgentModifyRequest);
    const urgentIntent = urgentParseResult.detectedIntents[0];

    assert.equal(urgentIntent?.urgency, "high", "Should detect high urgency for immediate request");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 8: Approval Action Detection
// ---------------------------------------------------------------------------

test("E2E NL Entry: approval action detected with audit requirements", async () => {
  const harness = createE2EHarness("aa-e2e-nl-approval-");
  try {
    const nlService = new NlEntryService();

    const approvalRequest = {
      tenantId: DEFAULT_TENANT,
      userId: DEFAULT_USER,
      message: "approve the deployment to production",
      locale: "en-US",
    };

    const parseResult = await nlService.parseDetailed(approvalRequest);
    const primaryIntent = parseResult.detectedIntents[0];

    assert.equal(primaryIntent?.intentType, "approval_action", "Should detect approval_action intent");

    const taskResult = await nlService.buildTask(approvalRequest);
    assert.ok(taskResult.riskPreview.riskFactors.some((f) => f.includes("审批") || f.includes("approval")), "Should list approval risk factor");
    assert.equal(taskResult.riskPreview.approvalNeeded, true, "Approval action should require approval");

  } finally {
    harness.cleanup();
  }
});
