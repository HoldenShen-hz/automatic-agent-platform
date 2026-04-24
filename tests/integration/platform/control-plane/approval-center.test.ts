// @ts-nocheck
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
import { ApprovalService } from "../../../../src/platform/control-plane/approval-center/approval-service.js";
import { MultiPartyApprovalService } from "../../../../src/platform/control-plane/approval-center/multi-party-approval-service.js";
import { QuorumCalculator } from "../../../../src/platform/control-plane/approval-center/quorum-calculator.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";

test("ApprovalService: createRequest creates approval with correct fields", () => {
  const ctx = createIntegrationContext("aa-approval-create-");
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
  const ctx = createIntegrationContext("aa-approval-event-");
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
  const ctx = createIntegrationContext("aa-approval-confirm-");
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
  const ctx = createIntegrationContext("aa-approval-reject-");
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
  const ctx = createIntegrationContext("aa-approval-idempotent-");
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
    assert.ok(error.message.includes("approval.not_found"), `Error message: ${error.message}`);
  } finally {
    ctx.cleanup();
  }
});

test("ApprovalService: option_selected decision requires selectedOptionId", () => {
  const ctx = createIntegrationContext("aa-approval-option-");
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
  const ctx = createIntegrationContext("aa-approval-text-");
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

test("MultiPartyApprovalService: createMultiPartyRequest with 2-of-3 required approvals", () => {
  const ctx = createIntegrationContext("aa-multiparty-2of3-");
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
  const ctx = createIntegrationContext("aa-multiparty-single-");
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
  const ctx = createIntegrationContext("aa-multiparty-default-");
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
