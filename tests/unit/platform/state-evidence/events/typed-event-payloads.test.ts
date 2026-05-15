import assert from "node:assert/strict";
import test from "node:test";

import type {
  ClassifiedAnomalyEventPayload,
  TaskStatusChangedPayload,
  WorkflowStepCompletedPayload,
  DecisionRequestedPayload,
  DecisionRespondedPayload,
  DivisionOutcomePayload,
  SubtaskOutcomePayload,
  CostLimitReachedPayload,
  StreamChunkEmittedPayload,
  DispatchTicketPayload,
  WorkerLifecyclePayload,
  TakeoverPayload,
  RecoveryPayload,
  KnowledgeChunkIndexedPayload,
  LearningKnowledgePromotedPayload,
  DomainLifecyclePayload,
  PluginLifecycleEventPayload,
  PluginInvocationEventPayload,
  DelegationCreatedPayload,
  DelegationCompletedPayload,
  DelegationFailedPayload,
  PromptInjectedPayload,
  PromptRenderedPayload,
  PromptValidationFailedPayload,
  CostBudgetCreatedPayload,
  CostBudgetExceededPayload,
  CostActualizedPayload,
  TenantProvisionedPayload,
  TenantSuspendedPayload,
  TenantDeletedPayload,
  PackInstalledPayload,
  PackUninstalledPayload,
  MarketplaceListingPublishedPayload,
  MarketplaceListingPurchasedPayload,
  SloBreachedPayload,
  SloRecoveredPayload,
  ComplianceAuditRecordedPayload,
  ComplianceViolationDetectedPayload,
  KnowledgeDocumentIndexedPayload,
  KnowledgeQueryProcessedPayload,
  ApprovalContext,
  PromptRuntimeContext,
  CostMetadata,
} from "../../../../../src/platform/five-plane-state-evidence/events/typed-event-payloads.js";

test("ClassifiedAnomalyEventPayload structure is correct", () => {
  const payload: ClassifiedAnomalyEventPayload = {
    eventId: "evt_123",
    metricName: "provider_503_rate",
    anomalyEventClass: "E3_EXTERNAL_DEPENDENCY",
    unifiedSeverity: "SEV1",
    legacySeverity: "emergency",
    statisticalCategory: "level_shift",
    occurredAt: "2026-04-23T00:00:00.000Z",
    context: { statusCode: 503 },
  };
  assert.equal(payload.anomalyEventClass, "E3_EXTERNAL_DEPENDENCY");
  assert.equal(payload.unifiedSeverity, "SEV1");
});

test("TaskStatusChangedPayload structure is correct", () => {
  const payload: TaskStatusChangedPayload = {
    fromStatus: "pending",
    toStatus: "in_progress",
    reasonCode: "scheduler_dispatch",
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.fromStatus, "pending");
  assert.equal(payload.toStatus, "in_progress");
  assert.equal(payload.reasonCode, "scheduler_dispatch");
});

test("TaskStatusChangedPayload allows optional traceContext", () => {
  const payload: TaskStatusChangedPayload = {
    fromStatus: "queued",
    toStatus: "pending",
    reasonCode: "task_queued",
    occurredAt: "2026-04-14T00:00:00.000Z",
    traceContext: {
      traceId: "trace_123",
      spanId: "span_456",
      parentSpanId: null,
      correlationId: null,
    },
  };
  assert.ok(payload.traceContext !== undefined);
  assert.equal(payload.traceContext?.traceId, "trace_123");
});

test("WorkflowStepCompletedPayload structure is correct", () => {
  const payload: WorkflowStepCompletedPayload = {
    workflowId: "wf_123",
    stepId: "step_1",
    outputKey: "result",
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.workflowId, "wf_123");
  assert.equal(payload.stepId, "step_1");
  assert.equal(payload.outputKey, "result");
});

test("WorkflowStepCompletedPayload allows null outputKey", () => {
  const payload: WorkflowStepCompletedPayload = {
    workflowId: "wf_456",
    stepId: "step_2",
    outputKey: null,
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.outputKey, null);
});

test("DecisionRequestedPayload structure is correct", () => {
  const payload: DecisionRequestedPayload = {
    approvalId: "approval_123",
    decisionType: "option_selected",
    requestedAt: "2026-04-14T00:00:00.000Z",
    taskId: "task_456",
    riskLevel: "high",
  };
  assert.equal(payload.approvalId, "approval_123");
  assert.equal(payload.decisionType, "option_selected");
  assert.equal(payload.riskLevel, "high");
});

test("DecisionRequestedPayload allows minimal definition", () => {
  const payload: DecisionRequestedPayload = {
    approvalId: "approval_minimal",
  };
  assert.equal(payload.approvalId, "approval_minimal");
  assert.equal(payload.decisionType, undefined);
  assert.equal(payload.taskId, undefined);
});

test("DecisionRespondedPayload structure is correct", () => {
  const payload: DecisionRespondedPayload = {
    approvalId: "approval_123",
    decisionType: "confirmed",
    responseStatus: "approved",
    respondedAt: "2026-04-14T00:00:00.000Z",
    selectedOptionId: null,
    decision: "approved",
    reasonCode: "user_confirmed",
  };
  assert.equal(payload.approvalId, "approval_123");
  assert.equal(payload.decision, "approved");
});

test("DivisionOutcomePayload structure is correct", () => {
  const payload: DivisionOutcomePayload = {
    divisionId: "platform_team",
    workflowId: "wf_deploy",
    executionId: "exec_789",
    occurredAt: "2026-04-14T00:00:00.000Z",
    reasonCode: "workflow_completed",
  };
  assert.equal(payload.divisionId, "platform_team");
  assert.equal(payload.workflowId, "wf_deploy");
});

test("DivisionOutcomePayload allows null workflowId", () => {
  const payload: DivisionOutcomePayload = {
    divisionId: "general",
    workflowId: null,
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.workflowId, null);
});

test("SubtaskOutcomePayload structure is correct", () => {
  const payload: SubtaskOutcomePayload = {
    subtaskId: "subtask_123",
    parentTaskId: "task_456",
    occurredAt: "2026-04-14T00:00:00.000Z",
    reasonCode: "subtask_completed",
  };
  assert.equal(payload.subtaskId, "subtask_123");
  assert.equal(payload.parentTaskId, "task_456");
});

test("CostLimitReachedPayload structure is correct", () => {
  const payload: CostLimitReachedPayload = {
    budgetId: "budget_monthly",
    currentCostUsd: 95.50,
    limitUsd: 100.00,
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.budgetId, "budget_monthly");
  assert.equal(payload.currentCostUsd, 95.50);
  assert.equal(payload.limitUsd, 100.00);
});

test("StreamChunkEmittedPayload structure is correct", () => {
  const payload: StreamChunkEmittedPayload = {
    streamId: "stream_abc",
    chunkIndex: 5,
    chunkType: "text",
    emittedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.streamId, "stream_abc");
  assert.equal(payload.chunkIndex, 5);
  assert.equal(payload.chunkType, "text");
});

test("DispatchTicketPayload structure is correct", () => {
  const payload: DispatchTicketPayload = {
    ticketId: "ticket_123",
    executionId: "exec_456",
    occurredAt: "2026-04-14T00:00:00.000Z",
    workerId: "worker_xyz",
    reasonCode: "task_dispatched",
  };
  assert.equal(payload.ticketId, "ticket_123");
  assert.equal(payload.executionId, "exec_456");
  assert.equal(payload.workerId, "worker_xyz");
});

test("DispatchTicketPayload allows minimal definition", () => {
  const payload: DispatchTicketPayload = {
    ticketId: "ticket_minimal",
    executionId: "exec_minimal",
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.ticketId, "ticket_minimal");
  assert.equal(payload.workerId, undefined);
  assert.equal(payload.reasonCode, undefined);
});

test("WorkerLifecyclePayload structure is correct", () => {
  const payload: WorkerLifecyclePayload = {
    workerId: "worker_123",
    executionId: "exec_456",
    occurredAt: "2026-04-14T00:00:00.000Z",
    leaseId: "lease_789",
    reasonCode: "worker_busy",
  };
  assert.equal(payload.workerId, "worker_123");
  assert.equal(payload.executionId, "exec_456");
  assert.equal(payload.leaseId, "lease_789");
});

test("WorkerLifecyclePayload allows null executionId", () => {
  const payload: WorkerLifecyclePayload = {
    workerId: "worker_idle",
    executionId: null,
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.executionId, null);
});

test("TakeoverPayload structure is correct", () => {
  const payload: TakeoverPayload = {
    takeoverId: "takeover_123",
    executionId: "exec_456",
    occurredAt: "2026-04-14T00:00:00.000Z",
    actionType: "take_over_task",
  };
  assert.equal(payload.takeoverId, "takeover_123");
  assert.equal(payload.executionId, "exec_456");
  assert.equal(payload.actionType, "take_over_task");
});

test("TakeoverPayload allows minimal definition", () => {
  const payload: TakeoverPayload = {
    takeoverId: "takeover_minimal",
    executionId: "exec_minimal",
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.takeoverId, "takeover_minimal");
  assert.equal(payload.actionType, undefined);
});

test("RecoveryPayload structure is correct", () => {
  const payload: RecoveryPayload = {
    executionId: "exec_123",
    decisionId: "decision_456",
    occurredAt: "2026-04-14T00:00:00.000Z",
    reasonCode: "execution_failed",
  };
  assert.equal(payload.executionId, "exec_123");
  assert.equal(payload.decisionId, "decision_456");
  assert.equal(payload.reasonCode, "execution_failed");
});

test("RecoveryPayload allows minimal definition", () => {
  const payload: RecoveryPayload = {
    executionId: "exec_minimal",
    occurredAt: "2026-04-14T00:00:00.000Z",
    reasonCode: "recovery_initiated",
  };
  assert.equal(payload.executionId, "exec_minimal");
  assert.equal(payload.decisionId, undefined);
});

// ============================================================================
// Additional Payload Tests (Domain, Plugin, Delegation, Prompt, Cost, Tenant, Pack, Marketplace, SLO, Compliance, Knowledge)
// ============================================================================

test("KnowledgeChunkIndexedPayload structure is correct", () => {
  const payload: KnowledgeChunkIndexedPayload = {
    namespace: "docs",
    documentId: "doc_123",
    chunkId: "chunk_456",
    trustLevel: "high",
    keywordCount: 42,
    relationCount: 7,
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.namespace, "docs");
  assert.equal(payload.trustLevel, "high");
  assert.equal(payload.keywordCount, 42);
});

test("LearningKnowledgePromotedPayload structure is correct", () => {
  const payload: LearningKnowledgePromotedPayload = {
    learningObjectId: "lo_123",
    learningType: "concept",
    documentId: "doc_456",
    namespace: "docs",
    trustLevel: "verified",
    promotedCount: 15,
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.learningObjectId, "lo_123");
  assert.equal(payload.promotedCount, 15);
});

test("DomainLifecyclePayload structure is correct", () => {
  const payload: DomainLifecyclePayload = {
    domainId: "coding",
    status: "active",
    capabilityCount: 5,
    pluginCount: 12,
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.domainId, "coding");
  assert.equal(payload.capabilityCount, 5);
  assert.equal(payload.pluginCount, 12);
});

test("PluginLifecycleEventPayload structure is correct", () => {
  const payload: PluginLifecycleEventPayload = {
    pluginId: "plugin.coding.presenter",
    domainId: "coding",
    spiType: "presenter",
    lifecycleState: "initializing",
    bindingId: "binding_abc",
    occurredAt: "2026-04-14T00:00:00.000Z",
    reasonCode: "plugin_loaded",
    errorMessage: null,
  };
  assert.equal(payload.pluginId, "plugin.coding.presenter");
  assert.equal(payload.lifecycleState, "initializing");
});

test("PluginInvocationEventPayload structure is correct", () => {
  const payload: PluginInvocationEventPayload = {
    pluginId: "plugin.coding.presenter",
    domainId: "coding",
    spiType: "presenter",
    phase: "init",
    invocationId: "inv_123",
    lifecycleState: "initializing",
    runtimeIsolation: "sandboxed_process",
    activeInvocationCount: 3,
    queuedInvocationCount: 1,
    bindingId: "binding_abc",
    occurredAt: "2026-04-14T00:00:00.000Z",
    durationMs: 150,
    status: "started",
  };
  assert.equal(payload.invocationId, "inv_123");
  assert.equal(payload.runtimeIsolation, "sandboxed_process");
  assert.equal(payload.activeInvocationCount, 3);
});

test("DelegationCreatedPayload structure is correct", () => {
  const payload: DelegationCreatedPayload = {
    delegationId: "del_123",
    sourceTaskId: "task_source",
    targetAgentId: "agent_target",
    delegatedBy: "user_1",
    scope: ["read", "write"],
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.delegationId, "del_123");
  assert.deepEqual(payload.scope, ["read", "write"]);
});

test("DelegationCompletedPayload structure is correct", () => {
  const payload: DelegationCompletedPayload = {
    delegationId: "del_123",
    sourceTaskId: "task_source",
    targetAgentId: "agent_target",
    completedAt: "2026-04-14T00:00:00.000Z",
    resultSummary: "Task completed successfully",
  };
  assert.equal(payload.completedAt, "2026-04-14T00:00:00.000Z");
  assert.equal(payload.resultSummary, "Task completed successfully");
});

test("DelegationCompletedPayload allows null resultSummary", () => {
  const payload: DelegationCompletedPayload = {
    delegationId: "del_456",
    sourceTaskId: "task_source",
    targetAgentId: "agent_target",
    completedAt: "2026-04-14T00:00:00.000Z",
    resultSummary: null,
  };
  assert.equal(payload.resultSummary, null);
});

test("DelegationFailedPayload structure is correct", () => {
  const payload: DelegationFailedPayload = {
    delegationId: "del_123",
    sourceTaskId: "task_source",
    targetAgentId: "agent_target",
    failedAt: "2026-04-14T00:00:00.000Z",
    reasonCode: "agent_unavailable",
    errorMessage: "Agent failed to respond",
  };
  assert.equal(payload.reasonCode, "agent_unavailable");
  assert.equal(payload.errorMessage, "Agent failed to respond");
});

test("DelegationFailedPayload allows minimal definition", () => {
  const payload: DelegationFailedPayload = {
    delegationId: "del_789",
    sourceTaskId: "task_source",
    targetAgentId: "agent_target",
    failedAt: "2026-04-14T00:00:00.000Z",
    reasonCode: "timeout",
  };
  assert.equal(payload.reasonCode, "timeout");
  assert.equal(payload.errorMessage, undefined);
});

test("PromptInjectedPayload structure is correct", () => {
  const payload: PromptInjectedPayload = {
    promptId: "prompt_123",
    injectionType: "system",
    templateVersion: "1.0.0",
    occurredAt: "2026-04-14T00:00:00.000Z",
    runtimeContext: {
      tenantId: "tenant_1",
      userId: "user_1",
      taskId: "task_123",
    },
  };
  assert.equal(payload.promptId, "prompt_123");
  assert.equal(payload.injectionType, "system");
  assert.equal(payload.runtimeContext?.tenantId, "tenant_1");
});

test("PromptInjectedPayload allows null runtimeContext", () => {
  const payload: PromptInjectedPayload = {
    promptId: "prompt_456",
    injectionType: "user",
    templateVersion: "1.0.0",
    occurredAt: "2026-04-14T00:00:00.000Z",
    runtimeContext: null,
  };
  assert.equal(payload.runtimeContext, null);
});

test("PromptRenderedPayload structure is correct", () => {
  const payload: PromptRenderedPayload = {
    promptId: "prompt_123",
    renderId: "render_abc",
    templateId: "tmpl_xyz",
    renderDurationMs: 50,
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.renderId, "render_abc");
  assert.equal(payload.renderDurationMs, 50);
});

test("PromptRenderedPayload allows minimal definition", () => {
  const payload: PromptRenderedPayload = {
    promptId: "prompt_789",
    renderId: "render_def",
    templateId: "tmpl_ghi",
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.renderDurationMs, undefined);
});

test("PromptValidationFailedPayload structure is correct", () => {
  const payload: PromptValidationFailedPayload = {
    promptId: "prompt_123",
    validationErrors: ["missing required field 'title'", "invalid type for 'age'"],
    occurredAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.promptId, "prompt_123");
  assert.equal(payload.validationErrors.length, 2);
});

test("CostBudgetCreatedPayload structure is correct", () => {
  const payload: CostBudgetCreatedPayload = {
    budgetId: "budget_monthly",
    budgetName: "Monthly API Budget",
    limitUsd: 1000.00,
    period: "monthly",
    createdAt: "2026-04-01T00:00:00.000Z",
  };
  assert.equal(payload.budgetId, "budget_monthly");
  assert.equal(payload.limitUsd, 1000.00);
  assert.equal(payload.period, "monthly");
});

test("CostBudgetCreatedPayload period must be valid enum value", () => {
  const hourlyPayload: CostBudgetCreatedPayload = {
    budgetId: "budget_hourly",
    budgetName: "Hourly API Budget",
    limitUsd: 10.00,
    period: "hourly",
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  const dailyPayload: CostBudgetCreatedPayload = {
    budgetId: "budget_daily",
    budgetName: "Daily API Budget",
    limitUsd: 100.00,
    period: "daily",
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(hourlyPayload.period, "hourly");
  assert.equal(dailyPayload.period, "daily");
});

test("CostBudgetExceededPayload structure is correct", () => {
  const payload: CostBudgetExceededPayload = {
    budgetId: "budget_monthly",
    currentCostUsd: 1050.00,
    limitUsd: 1000.00,
    exceededAt: "2026-04-14T12:00:00.000Z",
    autoBlock: true,
  };
  assert.equal(payload.currentCostUsd, 1050.00);
  assert.equal(payload.autoBlock, true);
});

test("CostBudgetExceededPayload allows minimal definition", () => {
  const payload: CostBudgetExceededPayload = {
    budgetId: "budget_monthly",
    currentCostUsd: 1050.00,
    limitUsd: 1000.00,
    exceededAt: "2026-04-14T12:00:00.000Z",
  };
  assert.equal(payload.autoBlock, undefined);
});

test("CostActualizedPayload structure is correct", () => {
  const payload: CostActualizedPayload = {
    costId: "cost_abc",
    budgetId: "budget_monthly",
    amountUsd: 0.25,
    costCategory: "api_call",
    actualizedAt: "2026-04-14T00:00:00.000Z",
    metadata: {
      provider: "openai",
      model: "gpt-4",
      region: "us-east-1",
      usageType: "completion",
    },
  };
  assert.equal(payload.costId, "cost_abc");
  assert.equal(payload.metadata?.provider, "openai");
});

test("CostActualizedPayload allows null metadata", () => {
  const payload: CostActualizedPayload = {
    costId: "cost_def",
    budgetId: "budget_monthly",
    amountUsd: 0.10,
    costCategory: "api_call",
    actualizedAt: "2026-04-14T00:00:00.000Z",
    metadata: null,
  };
  assert.equal(payload.metadata, null);
});

test("TenantProvisionedPayload structure is correct", () => {
  const payload: TenantProvisionedPayload = {
    tenantId: "tenant_123",
    plan: "enterprise",
    provisionedAt: "2026-04-01T00:00:00.000Z",
    region: "us-east-1",
  };
  assert.equal(payload.tenantId, "tenant_123");
  assert.equal(payload.plan, "enterprise");
  assert.equal(payload.region, "us-east-1");
});

test("TenantProvisionedPayload allows null region", () => {
  const payload: TenantProvisionedPayload = {
    tenantId: "tenant_456",
    plan: "starter",
    provisionedAt: "2026-04-01T00:00:00.000Z",
    region: null,
  };
  assert.equal(payload.region, null);
});

test("TenantSuspendedPayload structure is correct", () => {
  const payload: TenantSuspendedPayload = {
    tenantId: "tenant_123",
    reasonCode: "payment_overdue",
    suspendedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.reasonCode, "payment_overdue");
});

test("TenantDeletedPayload structure is correct", () => {
  const payload: TenantDeletedPayload = {
    tenantId: "tenant_123",
    deletedAt: "2026-04-14T00:00:00.000Z",
    cascading: false,
  };
  assert.equal(payload.cascading, false);
});

test("TenantDeletedPayload allows minimal definition", () => {
  const payload: TenantDeletedPayload = {
    tenantId: "tenant_789",
    deletedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.cascading, undefined);
});

test("PackInstalledPayload structure is correct", () => {
  const payload: PackInstalledPayload = {
    packId: "pack_coding_v1",
    packVersion: "1.2.3",
    installedAt: "2026-04-01T00:00:00.000Z",
    installedBy: "user_123",
  };
  assert.equal(payload.packId, "pack_coding_v1");
  assert.equal(payload.packVersion, "1.2.3");
});

test("PackUninstalledPayload structure is correct", () => {
  const payload: PackUninstalledPayload = {
    packId: "pack_coding_v1",
    packVersion: "1.2.3",
    uninstalledAt: "2026-04-14T00:00:00.000Z",
    reasonCode: "user_requested",
  };
  assert.equal(payload.reasonCode, "user_requested");
});

test("PackUninstalledPayload allows minimal definition", () => {
  const payload: PackUninstalledPayload = {
    packId: "pack_coding_v1",
    packVersion: "1.2.3",
    uninstalledAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.reasonCode, undefined);
});

test("MarketplaceListingPublishedPayload structure is correct", () => {
  const payload: MarketplaceListingPublishedPayload = {
    listingId: "listing_abc",
    packId: "pack_coding_v1",
    publishedAt: "2026-04-01T00:00:00.000Z",
    publisherId: "publisher_123",
  };
  assert.equal(payload.listingId, "listing_abc");
  assert.equal(payload.publisherId, "publisher_123");
});

test("MarketplaceListingPurchasedPayload structure is correct", () => {
  const payload: MarketplaceListingPurchasedPayload = {
    listingId: "listing_abc",
    purchaseId: "purchase_xyz",
    purchaserTenantId: "tenant_456",
    purchasedAt: "2026-04-14T00:00:00.000Z",
    amountUsd: 29.99,
  };
  assert.equal(payload.purchaseId, "purchase_xyz");
  assert.equal(payload.amountUsd, 29.99);
});

test("MarketplaceListingPurchasedPayload allows minimal definition", () => {
  const payload: MarketplaceListingPurchasedPayload = {
    listingId: "listing_abc",
    purchaseId: "purchase_def",
    purchaserTenantId: "tenant_789",
    purchasedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.amountUsd, undefined);
});

test("SloBreachedPayload structure is correct", () => {
  const payload: SloBreachedPayload = {
    sloId: "slo_latency",
    sloName: "API Latency SLO",
    currentValue: 250,
    targetValue: 100,
    breachedAt: "2026-04-14T12:00:00.000Z",
    metricName: "p99_latency_ms",
  };
  assert.equal(payload.sloId, "slo_latency");
  assert.equal(payload.currentValue, 250);
  assert.equal(payload.targetValue, 100);
});

test("SloRecoveredPayload structure is correct", () => {
  const payload: SloRecoveredPayload = {
    sloId: "slo_latency",
    sloName: "API Latency SLO",
    recoveredAt: "2026-04-14T14:00:00.000Z",
    breachDurationMs: 7200000,
  };
  assert.equal(payload.sloId, "slo_latency");
  assert.equal(payload.breachDurationMs, 7200000);
});

test("SloRecoveredPayload allows minimal definition", () => {
  const payload: SloRecoveredPayload = {
    sloId: "slo_availability",
    sloName: "API Availability SLO",
    recoveredAt: "2026-04-14T14:00:00.000Z",
  };
  assert.equal(payload.breachDurationMs, undefined);
});

test("ComplianceAuditRecordedPayload structure is correct", () => {
  const payload: ComplianceAuditRecordedPayload = {
    auditId: "audit_123",
    actorId: "user_456",
    action: "task.create",
    resourceKind: "task",
    resourceId: "task_789",
    recordedAt: "2026-04-14T00:00:00.000Z",
    complianceFramework: "SOC2",
  };
  assert.equal(payload.auditId, "audit_123");
  assert.equal(payload.complianceFramework, "SOC2");
});

test("ComplianceAuditRecordedPayload allows null complianceFramework", () => {
  const payload: ComplianceAuditRecordedPayload = {
    auditId: "audit_abc",
    actorId: "user_456",
    action: "task.create",
    resourceKind: "task",
    resourceId: "task_789",
    recordedAt: "2026-04-14T00:00:00.000Z",
    complianceFramework: null,
  };
  assert.equal(payload.complianceFramework, null);
});

test("ComplianceViolationDetectedPayload structure is correct", () => {
  const payload: ComplianceViolationDetectedPayload = {
    violationId: "violation_123",
    framework: "GDPR",
    severity: "high",
    detectedAt: "2026-04-14T00:00:00.000Z",
    resourceId: "user_data_456",
    description: "User data retention policy violated",
  };
  assert.equal(payload.violationId, "violation_123");
  assert.equal(payload.severity, "high");
});

test("ComplianceViolationDetectedPayload severity must be valid enum value", () => {
  const lowPayload: ComplianceViolationDetectedPayload = {
    violationId: "violation_1",
    framework: "GDPR",
    severity: "low",
    detectedAt: "2026-04-14T00:00:00.000Z",
    resourceId: "resource_1",
    description: "Minor violation",
  };
  const criticalPayload: ComplianceViolationDetectedPayload = {
    violationId: "violation_2",
    framework: "HIPAA",
    severity: "critical",
    detectedAt: "2026-04-14T00:00:00.000Z",
    resourceId: "resource_2",
    description: "Critical violation",
  };
  assert.equal(lowPayload.severity, "low");
  assert.equal(criticalPayload.severity, "critical");
});

test("KnowledgeDocumentIndexedPayload structure is correct", () => {
  const payload: KnowledgeDocumentIndexedPayload = {
    documentId: "doc_123",
    namespace: "docs",
    chunkCount: 50,
    indexedAt: "2026-04-14T00:00:00.000Z",
    trustLevel: "verified",
  };
  assert.equal(payload.documentId, "doc_123");
  assert.equal(payload.chunkCount, 50);
});

test("KnowledgeQueryProcessedPayload structure is correct", () => {
  const payload: KnowledgeQueryProcessedPayload = {
    queryId: "query_abc",
    namespace: "docs",
    resultCount: 10,
    queryDurationMs: 25,
    processedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.queryId, "query_abc");
  assert.equal(payload.resultCount, 10);
  assert.equal(payload.queryDurationMs, 25);
});

test("KnowledgeQueryProcessedPayload allows minimal definition", () => {
  const payload: KnowledgeQueryProcessedPayload = {
    queryId: "query_def",
    namespace: "docs",
    resultCount: 5,
    processedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(payload.queryDurationMs, undefined);
});

test("ApprovalContext structure is correct", () => {
  const payload: ApprovalContext = {
    sessionId: "session_123",
    approvalSessionId: "approval_456",
    permissionSessionId: "permission_789",
    classification: "confidential",
    title: "Approve high-risk operation",
    stageRef: "stage_1",
    loopIteration: 3,
    refId: "ref_abc",
    recommendedOptionId: "option_2",
    deadlineAt: "2026-04-15T00:00:00.000Z",
    taskId: "task_def",
    executionId: "exec_ghi",
  };
  assert.equal(payload.sessionId, "session_123");
  assert.equal(payload.loopIteration, 3);
});

test("ApprovalContext allows partial definition", () => {
  const payload: ApprovalContext = {
    taskId: "task_minimal",
    executionId: "exec_minimal",
  };
  assert.equal(payload.sessionId, undefined);
  assert.equal(payload.loopIteration, undefined);
});

test("PromptRuntimeContext structure is correct", () => {
  const payload: PromptRuntimeContext = {
    tenantId: "tenant_123",
    userId: "user_456",
    taskId: "task_789",
    executionId: "exec_abc",
  };
  assert.equal(payload.tenantId, "tenant_123");
  assert.equal(payload.userId, "user_456");
});

test("PromptRuntimeContext allows minimal definition", () => {
  const payload: PromptRuntimeContext = {
    tenantId: "tenant_minimal",
  };
  assert.equal(payload.userId, undefined);
});

test("CostMetadata structure is correct", () => {
  const payload: CostMetadata = {
    provider: "openai",
    model: "gpt-4o",
    region: "us-east-1",
    usageType: "completion",
  };
  assert.equal(payload.provider, "openai");
  assert.equal(payload.model, "gpt-4o");
});

test("CostMetadata allows minimal definition", () => {
  const payload: CostMetadata = {
    provider: "anthropic",
  };
  assert.equal(payload.model, undefined);
  assert.equal(payload.region, undefined);
});
