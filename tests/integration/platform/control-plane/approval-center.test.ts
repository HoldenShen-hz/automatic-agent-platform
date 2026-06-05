/**
 * Integration Test: Approval Center
 *
 * Tests the core approval center services including:
 * - ApprovalService: createRequest, applyDecision
 * - MultiPartyApprovalService: N-of-M approval workflows
 * - QuorumCalculator: approval quorum calculations
 *
 * Uses createIntegrationContext() with SQLite for integration testing.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { ApprovalService } from "../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { MultiPartyApprovalService } from "../../../../src/platform/five-plane-control-plane/approval-center/multi-party-approval-service.js";
import { QuorumCalculator } from "../../../../src/platform/five-plane-control-plane/approval-center/quorum-calculator.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";

function seedApprovalTarget(
  ctx: ReturnType<typeof createIntegrationContext>,
  taskId: string,
  executionId: string,
): void {
  const now = nowIso();
  ctx.db.transaction(() => {
    ctx.store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general-ops",
      tenantId: null,
      title: `Seeded approval task ${taskId}`,
      status: "in_progress",
      source: "user",
      priority: "normal",
      inputJson: "{}",
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
      agentId: "agent-seeded",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: `trace-${executionId}`,
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
  });
}

function createApprovalContext(prefix: string, taskId: string, executionId: string) {
  const ctx = createIntegrationContext(prefix);
  seedApprovalTarget(ctx, taskId, executionId);
  return ctx;
}

test("ApprovalService: createRequest creates approval with correct fields", () => {
  const ctx = createApprovalContext("aa-approval-create-", "task-approval-001", "exec-approval-001");
  try {
    const service = new ApprovalService(ctx.db, ctx.store);

    const approval = service.createRequest({
      taskId: "task-approval-001",
      executionId: "exec-approval-001",
      sourceAgentId: "test-agent",
      reason: "Test approval request",
      riskLevel: "low",
      options: ["approve", "reject"],
      context: { source: "integration-test" },
      timeoutPolicy: "remain_pending",
    });

    assert.ok(approval.approvalId.startsWith("approval_"));
    assert.strictEqual(approval.taskId, "task-approval-001");
    assert.strictEqual(approval.executionId, "exec-approval-001");
    assert.strictEqual(approval.sourceAgentId, "test-agent");
    assert.strictEqual(approval.reason, "Test approval request");
    assert.strictEqual(approval.riskLevel, "low");
    assert.deepStrictEqual(approval.options, ["approve", "reject"]);
    assert.strictEqual(approval.timeoutPolicy, "remain_pending");
    assert.ok(approval.createdAt, "Should have createdAt timestamp");
  } finally {
    ctx.cleanup();
  }
});

test("ApprovalService: createRequest emits decision:requested event", () => {
  const ctx = createApprovalContext("aa-approval-event-", "task-event-001", "exec-event-001");
  try {
    const service = new ApprovalService(ctx.db, ctx.store);

    service.createRequest({
      taskId: "task-event-001",
      executionId: "exec-event-001",
      sourceAgentId: "test-agent",
      reason: "Event test",
      riskLevel: "medium",
      options: ["proceed", "cancel"],
      context: {},
      timeoutPolicy: "approve",
    });

    const events = ctx.store.listEventsForTask("task-event-001");
    const decisionEvent = events.find((e) => e.eventType === "decision:requested");
    assert.ok(decisionEvent, "Should have decision:requested event");
    const payload = JSON.parse(decisionEvent.payloadJson);
    assert.strictEqual(payload.taskId, "task-event-001");
  } finally {
    ctx.cleanup();
  }
});

test("ApprovalService: applyDecision confirms pending request", () => {
  const ctx = createApprovalContext("aa-approval-confirm-", "task-confirm-001", "exec-confirm-001");
  try {
    const service = new ApprovalService(ctx.db, ctx.store);

    const approval = service.createRequest({
      taskId: "task-confirm-001",
      executionId: "exec-confirm-001",
      sourceAgentId: "test-agent",
      reason: "Confirm test",
      riskLevel: "low",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "remain_pending",
    });

    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "test-operator",
      respondedAt: nowIso(),
    });

    const events = ctx.store.listEventsForTask("task-confirm-001");
    const respondedEvent = events.find((e) => e.eventType === "decision:responded");
    assert.ok(respondedEvent, "Should have decision:responded event");
  } finally {
    ctx.cleanup();
  }
});

test("ApprovalService: applyDecision rejects pending request", () => {
  const ctx = createApprovalContext("aa-approval-reject-", "task-reject-001", "exec-reject-001");
  try {
    const service = new ApprovalService(ctx.db, ctx.store);

    const approval = service.createRequest({
      taskId: "task-reject-001",
      executionId: "exec-reject-001",
      sourceAgentId: "test-agent",
      reason: "Reject test",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "reject",
    });

    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "rejected",
      respondedBy: "test-operator",
      respondedAt: nowIso(),
    });

    const events = ctx.store.listEventsForTask("task-reject-001");
    const respondedEvent = events.find((e) => e.eventType === "decision:responded");
    assert.ok(respondedEvent, "Should have decision:responded event");
  } finally {
    ctx.cleanup();
  }
});

test("ApprovalService: applyDecision is idempotent for non-pending approval", () => {
  const ctx = createApprovalContext("aa-approval-idempotent-", "task-idempotent-001", "exec-idempotent-001");
  try {
    const service = new ApprovalService(ctx.db, ctx.store);

    const approval = service.createRequest({
      taskId: "task-idempotent-001",
      executionId: "exec-idempotent-001",
      sourceAgentId: "test-agent",
      reason: "Idempotent test",
      riskLevel: "low",
      options: ["approve"],
      context: {},
      timeoutPolicy: "remain_pending",
    });

    // First decision
    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });

    // Second decision on already-answered - should be no-op
    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "operator-2",
      respondedAt: nowIso(),
    });

    const events = ctx.store.listEventsForTask("task-idempotent-001");
    const respondedEvents = events.filter((e) => e.eventType === "decision:responded");
    assert.strictEqual(respondedEvents.length, 1, "Should only have one decision:responded event");
  } finally {
    ctx.cleanup();
  }
});

test("ApprovalService: applyDecision throws for non-existent approval", () => {
  const ctx = createIntegrationContext("aa-approval-notfound-");
  try {
    const service = new ApprovalService(ctx.db, ctx.store);

    let error: Error | null = null;
    try {
      service.applyDecision({
        approvalId: "non-existent-approval",
        decisionType: "confirmed",
        confirmed: true,
        respondedBy: "test-operator",
        respondedAt: nowIso(),
      });
    } catch (e) {
      error = e as Error;
    }
    assert.ok(error, "Should throw an error for non-existent approval");
    assert.ok(error.message.includes("Approval not found"), `Error message: ${error.message}`);
  } finally {
    ctx.cleanup();
  }
});

test("ApprovalService: option_selected decision requires selectedOptionId", () => {
  const ctx = createApprovalContext("aa-approval-option-", "task-option-001", "exec-option-001");
  try {
    const service = new ApprovalService(ctx.db, ctx.store);

    const approval = service.createRequest({
      taskId: "task-option-001",
      executionId: "exec-option-001",
      sourceAgentId: "test-agent",
      reason: "Option test",
      riskLevel: "medium",
      options: ["option-a", "option-b", "option-c"],
      context: {},
      timeoutPolicy: "remain_pending",
    });

    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "option_selected",
      selectedOptionId: "option-b",
      respondedBy: "test-operator",
      respondedAt: nowIso(),
    });

    const events = ctx.store.listEventsForTask("task-option-001");
    const respondedEvent = events.find((e) => e.eventType === "decision:responded");
    assert.ok(respondedEvent, "Should have decision:responded event");
    const payload = JSON.parse(respondedEvent.payloadJson);
    assert.strictEqual(payload.selectedOptionId, "option-b");
  } finally {
    ctx.cleanup();
  }
});

test("ApprovalService: text_input decision requires inputText", () => {
  const ctx = createApprovalContext("aa-approval-text-", "task-text-001", "exec-text-001");
  try {
    const service = new ApprovalService(ctx.db, ctx.store);

    const approval = service.createRequest({
      taskId: "task-text-001",
      executionId: "exec-text-001",
      sourceAgentId: "test-agent",
      reason: "Text input test",
      riskLevel: "low",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "remain_pending",
    });

    service.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "text_input",
      inputText: "Approved with modifications: increased timeout to 120s",
      respondedBy: "test-operator",
      respondedAt: nowIso(),
    });

    const events = ctx.store.listEventsForTask("task-text-001");
    const respondedEvent = events.find((e) => e.eventType === "decision:responded");
    assert.ok(respondedEvent, "Should have decision:responded event");
    const payload = JSON.parse(respondedEvent.payloadJson);
    assert.strictEqual(payload.inputText, "Approved with modifications: increased timeout to 120s");
  } finally {
    ctx.cleanup();
  }
});

test("ApprovalService: delegatePendingApproval updates escalation target without resolving the approval", () => {
  const ctx = createApprovalContext("aa-approval-delegate-", "task-delegate-001", "exec-delegate-001");
  try {
    const service = new ApprovalService(ctx.db, ctx.store);

    const approval = service.createRequest({
      taskId: "task-delegate-001",
      executionId: "exec-delegate-001",
      sourceAgentId: "test-agent",
      reason: "Delegate test",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: {
        escalationTarget: "ops-director",
      },
      timeoutPolicy: "remain_pending",
    });

    service.delegatePendingApproval({
      approvalId: approval.approvalId,
      delegateTo: "domain-admin",
      respondedBy: "test-operator",
      respondedAt: nowIso(),
    });

    const stored = ctx.store.approval.getApproval(approval.approvalId);
    assert.ok(stored, "Stored approval should exist");
    assert.strictEqual(stored.status, "requested");
    const request = JSON.parse(stored.requestJson) as {
      context: Record<string, unknown>;
      escalationChain?: Array<{ reviewerRef?: string }>;
    };
    assert.strictEqual(request.context.escalationTarget, "domain-admin");
    assert.strictEqual(request.context.delegatedBy, "test-operator");
    assert.ok(Array.isArray(request.escalationChain));
    assert.strictEqual(request.escalationChain?.at(-1)?.reviewerRef, "domain-admin");

    const delegateEvent = ctx.store
      .listEventsForTask("task-delegate-001")
      .find((event) => event.eventType === "approval:delegated");
    assert.ok(delegateEvent, "Should record approval:delegated event");
  } finally {
    ctx.cleanup();
  }
});

test("ApprovalService: delegatePendingApproval does not duplicate the same operator hop", () => {
  const ctx = createApprovalContext("aa-approval-delegate-dedupe-", "task-delegate-dedupe-001", "exec-delegate-dedupe-001");
  try {
    const service = new ApprovalService(ctx.db, ctx.store);

    const approval = service.createRequest({
      taskId: "task-delegate-dedupe-001",
      executionId: "exec-delegate-dedupe-001",
      sourceAgentId: "test-agent",
      reason: "Delegate dedupe test",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: {
        escalationTarget: "ops-director",
      },
      timeoutPolicy: "remain_pending",
    });

    service.delegatePendingApproval({
      approvalId: approval.approvalId,
      delegateTo: "risk-lead",
      respondedBy: "test-operator",
      respondedAt: nowIso(),
    });

    service.delegatePendingApproval({
      approvalId: approval.approvalId,
      delegateTo: "risk-lead",
      respondedBy: "test-operator",
      respondedAt: nowIso(),
    });

    const stored = ctx.store.approval.getApproval(approval.approvalId);
    assert.ok(stored, "Stored approval should exist");
    const request = JSON.parse(stored.requestJson) as {
      escalationChain?: Array<{ reviewerRef?: string }>;
    };
    assert.ok(Array.isArray(request.escalationChain));
    assert.strictEqual(request.escalationChain?.length, 1);
    assert.strictEqual(request.escalationChain?.[0]?.reviewerRef, "risk-lead");
  } finally {
    ctx.cleanup();
  }
});

test("ApprovalService: delegatePendingApproval collapses pre-existing duplicate operator hops", () => {
  const ctx = createApprovalContext("aa-approval-delegate-repair-", "task-delegate-repair-001", "exec-delegate-repair-001");
  try {
    const service = new ApprovalService(ctx.db, ctx.store);

    const approval = service.createRequest({
      taskId: "task-delegate-repair-001",
      executionId: "exec-delegate-repair-001",
      sourceAgentId: "test-agent",
      reason: "Delegate repair test",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: {
        escalationTarget: "risk-lead",
      },
      escalationChain: [
        { level: 1, reviewerType: "operator", reviewerRef: "risk-lead", timeoutMs: 0, onTimeout: "reject" },
        { level: 2, reviewerType: "operator", reviewerRef: "risk-lead", timeoutMs: 0, onTimeout: "reject" },
      ],
      timeoutPolicy: "remain_pending",
    });

    service.delegatePendingApproval({
      approvalId: approval.approvalId,
      delegateTo: "risk-lead",
      respondedBy: "test-operator",
      respondedAt: nowIso(),
    });

    const stored = ctx.store.approval.getApproval(approval.approvalId);
    assert.ok(stored, "Stored approval should exist");
    const request = JSON.parse(stored.requestJson) as {
      escalationChain?: Array<{ reviewerRef?: string; level?: number }>;
    };
    assert.ok(Array.isArray(request.escalationChain));
    assert.strictEqual(request.escalationChain?.length, 1);
    assert.strictEqual(request.escalationChain?.[0]?.reviewerRef, "risk-lead");
    assert.strictEqual(request.escalationChain?.[0]?.level, 1);
  } finally {
    ctx.cleanup();
  }
});

test("ApprovalService: deferPendingApproval updates deadline and keeps approval pending", () => {
  const ctx = createApprovalContext("aa-approval-defer-", "task-defer-001", "exec-defer-001");
  try {
    const service = new ApprovalService(ctx.db, ctx.store);

    const approval = service.createRequest({
      taskId: "task-defer-001",
      executionId: "exec-defer-001",
      sourceAgentId: "test-agent",
      reason: "Defer test",
      riskLevel: "medium",
      options: ["approve", "reject"],
      context: {
        deadlineAt: "2026-04-16T02:00:00.000Z",
      },
      timeoutPolicy: "remain_pending",
    });

    service.deferPendingApproval({
      approvalId: approval.approvalId,
      until: "2026-04-16T04:30:00.000Z",
      respondedBy: "test-operator",
      respondedAt: nowIso(),
    });

    const stored = ctx.store.approval.getApproval(approval.approvalId);
    assert.ok(stored, "Stored approval should exist");
    assert.strictEqual(stored.status, "requested");
    const request = JSON.parse(stored.requestJson) as {
      context: Record<string, unknown>;
    };
    assert.strictEqual(request.context.deadlineAt, "2026-04-16T04:30:00.000Z");
    assert.strictEqual(request.context.deferredBy, "test-operator");

    const deferredEvent = ctx.store
      .listEventsForTask("task-defer-001")
      .find((event) => event.eventType === "approval:deferred");
    assert.ok(deferredEvent, "Should record approval:deferred event");
  } finally {
    ctx.cleanup();
  }
});

test("MultiPartyApprovalService: createMultiPartyRequest with 2-of-3 required approvals", () => {
  const ctx = createApprovalContext("aa-multiparty-2of3-", "task-mp-001", "exec-mp-001");
  try {
    const service = new MultiPartyApprovalService(ctx.db, ctx.store);

    const approval = service.createMultiPartyRequest(
      {
        taskId: "task-mp-001",
        executionId: "exec-mp-001",
        sourceAgentId: "test-agent",
        reason: "Multi-party approval test",
        riskLevel: "high",
        options: ["approve", "reject", "escalate"],
        context: { operation: "production_deployment" },
        timeoutPolicy: "approve",
      },
      { requiredApprovals: 2, approverGroups: ["ops-team", "security-team"] },
    );

    assert.ok(approval.approvalId.startsWith("approval_"));
    assert.strictEqual(approval.requiredApprovals, 2);
    assert.deepStrictEqual(approval.approverGroups, ["ops-team", "security-team"]);
    assert.strictEqual(approval.approvalsReceived, 0);
    assert.strictEqual(approval.context.multiPartyEnabled, true);
  } finally {
    ctx.cleanup();
  }
});

test("MultiPartyApprovalService: createMultiPartyRequest with single approval", () => {
  const ctx = createApprovalContext("aa-multiparty-single-", "task-mp-single-001", "exec-mp-single-001");
  try {
    const service = new MultiPartyApprovalService(ctx.db, ctx.store);

    const approval = service.createMultiPartyRequest(
      {
        taskId: "task-mp-single-001",
        executionId: "exec-mp-single-001",
        sourceAgentId: "test-agent",
        reason: "Single approver test",
        riskLevel: "low",
        options: ["approve", "reject"],
        context: {},
        timeoutPolicy: "remain_pending",
      },
      { requiredApprovals: 1 },
    );

    assert.strictEqual(approval.requiredApprovals, 1);
    assert.strictEqual(approval.approvalsReceived, 0);
  } finally {
    ctx.cleanup();
  }
});

test("MultiPartyApprovalService: createMultiPartyRequest defaults to single approval", () => {
  const ctx = createApprovalContext("aa-multiparty-default-", "task-mp-default-001", "exec-mp-default-001");
  try {
    const service = new MultiPartyApprovalService(ctx.db, ctx.store);

    const approval = service.createMultiPartyRequest({
      taskId: "task-mp-default-001",
      executionId: "exec-mp-default-001",
      sourceAgentId: "test-agent",
      reason: "Default approval test",
      riskLevel: "low",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "remain_pending",
    });

    assert.strictEqual(approval.requiredApprovals, 1);
  } finally {
    ctx.cleanup();
  }
});

test("QuorumCalculator: calculateQuorum returns correct threshold", () => {
  const ctx = createIntegrationContext("aa-quorum-basic-");
  try {
    const calculator = new QuorumCalculator();

    // 2-of-3 requires 2 approvals
    assert.strictEqual(calculator.calculateQuorum(2, 3), 2);

    // 3-of-5 requires 3 approvals
    assert.strictEqual(calculator.calculateQuorum(3, 5), 3);

    // 1-of-1 is just 1
    assert.strictEqual(calculator.calculateQuorum(1, 1), 1);
  } finally {
    ctx.cleanup();
  }
});

test("QuorumCalculator: isQuorumMet correctly evaluates approval count", () => {
  const ctx = createIntegrationContext("aa-quorum-met-");
  try {
    const calculator = new QuorumCalculator();

    // 2 approvals with threshold of 2 = met
    assert.strictEqual(calculator.isQuorumMet(2, 2), true);

    // 1 approval with threshold of 2 = not met
    assert.strictEqual(calculator.isQuorumMet(1, 2), false);

    // 3 approvals with threshold of 2 = met
    assert.strictEqual(calculator.isQuorumMet(3, 2), true);
  } finally {
    ctx.cleanup();
  }
});

test("QuorumCalculator: calculatePercentage returns correct value", () => {
  const ctx = createIntegrationContext("aa-quorum-pct-");
  try {
    const calculator = new QuorumCalculator();

    assert.strictEqual(calculator.calculatePercentage(2, 3), 66.67);
    assert.strictEqual(calculator.calculatePercentage(1, 3), 33.33);
    assert.strictEqual(calculator.calculatePercentage(3, 3), 100);
    assert.strictEqual(calculator.calculatePercentage(0, 3), 0);
  } finally {
    ctx.cleanup();
  }
});

test("ApprovalService: different risk levels produce valid approvals", () => {
  const ctx = createIntegrationContext("aa-approval-risklevels-");
  try {
    const service = new ApprovalService(ctx.db, ctx.store);
    const riskLevels: Array<"low" | "medium" | "high" | "critical"> = ["low", "medium", "high", "critical"];

    for (const riskLevel of riskLevels) {
      seedApprovalTarget(ctx, `task-risk-${riskLevel}`, `exec-risk-${riskLevel}`);
      const approval = service.createRequest({
        taskId: `task-risk-${riskLevel}`,
        executionId: `exec-risk-${riskLevel}`,
        sourceAgentId: "test-agent",
        reason: `Testing ${riskLevel} risk level`,
        riskLevel,
        options: ["approve", "reject"],
        context: {},
        timeoutPolicy: riskLevel === "critical" ? "reject" : "remain_pending",
      });

      assert.strictEqual(approval.riskLevel, riskLevel);
    }
  } finally {
    ctx.cleanup();
  }
});

test("ApprovalService: different timeout policies are preserved", () => {
  const ctx = createIntegrationContext("aa-approval-timeouts-");
  try {
    const service = new ApprovalService(ctx.db, ctx.store);
    const policies: Array<"reject" | "approve" | "remain_pending"> = ["reject", "approve", "remain_pending"];

    for (const timeoutPolicy of policies) {
      seedApprovalTarget(ctx, `task-timeout-${timeoutPolicy}`, `exec-timeout-${timeoutPolicy}`);
      const approval = service.createRequest({
        taskId: `task-timeout-${timeoutPolicy}`,
        executionId: `exec-timeout-${timeoutPolicy}`,
        sourceAgentId: "test-agent",
        reason: `Testing ${timeoutPolicy} policy`,
        riskLevel: "low",
        options: ["approve", "reject"],
        context: {},
        timeoutPolicy,
      });

      assert.strictEqual(approval.timeoutPolicy, timeoutPolicy);
    }
  } finally {
    ctx.cleanup();
  }
});
