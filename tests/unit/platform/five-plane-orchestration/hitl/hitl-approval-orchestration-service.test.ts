import assert from "node:assert/strict";
import test from "node:test";
import { HitlApprovalOrchestrationService } from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-approval-orchestration-service.js";
import type { ApprovalService } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import type { ApprovalDecision } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import type { ApprovalNotificationPort } from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-approval-orchestration-service.js";
import type { HITLExplainabilityService } from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-explainability-service.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

// Mock implementations

function createMockApprovalService(): ApprovalService {
  return {
    createRequest: () => ({
      approvalId: newId("approval"),
      taskId: "task-1",
      status: "pending",
      createdAt: nowIso(),
      sourceAgentId: "agent-1",
      reason: "test",
      riskLevel: "medium",
      options: ["option-1"],
      context: {},
      timeoutPolicy: "reject",
    }),
    applyDecision: () => ({} as ApprovalDecision),
    getApproval: () => null,
    resolve: () => ({ approvalId: "", status: "pending", resolvedBy: null, resolutionReason: null, request: {} as any, response: null }),
  } as unknown as ApprovalService;
}

function createMockExplainabilityService(): HITLExplainabilityService {
  return {
    explainApprovalRequired: () => ({
      explanationId: newId("explain"),
      taskId: "task-1",
      executionId: null,
      takeoverSessionId: null,
      decisionType: "approval_required",
      summary: "test explanation",
      factors: [],
      recommendations: [],
      confidenceScore: 0.8,
      generatedAt: nowIso(),
      contextSnapshot: {},
    }),
  } as unknown as HITLExplainabilityService;
}

// Test data factory

function createTestRequest(overrides?: Partial<Parameters<HitlApprovalOrchestrationService["requestApproval"]>[0]>) {
  return {
    taskId: "task-1",
    sourceAgentId: "agent-1",
    title: "Test Approval",
    reason: "Test reason",
    riskLevel: "medium" as const,
    stageRef: "execute" as const,
    options: [
      { optionId: "option-1", label: "Approve", style: "primary" as const, requiresConfirm: false },
      { optionId: "option-2", label: "Reject", style: "danger" as const, requiresConfirm: false },
    ],
    timeoutPolicy: "reject" as const,
    ...overrides,
  };
}

// Tests

test("buildTimeoutDecision creates expired decision when timeoutPolicy is reject", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService(),
    createMockExplainabilityService(),
  );

  const packet = await service.requestApproval(createTestRequest({ timeoutPolicy: "reject" }));
  const decision = service.buildTimeoutDecision(packet.approvalId);

  assert.equal(decision.approvalId, packet.approvalId);
  assert.equal(decision.decisionType, "expired");
  assert.equal(decision.respondedBy, "system:hitl_timeout");
  assert.ok(decision.respondedAt != null);
});

test("buildTimeoutDecision creates confirmed decision when timeoutPolicy is approve", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService(),
    createMockExplainabilityService(),
  );

  const packet = await service.requestApproval(createTestRequest({ timeoutPolicy: "approve" }));
  const decision = service.buildTimeoutDecision(packet.approvalId);

  assert.equal(decision.approvalId, packet.approvalId);
  assert.equal(decision.decisionType, "confirmed");
  assert.equal(decision.confirmed, true);
  assert.equal(decision.respondedBy, "system:hitl_timeout");
  assert.ok(decision.respondedAt != null);
});

test("buildTimeoutDecision uses custom respondedBy when provided", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService(),
    createMockExplainabilityService(),
  );

  const packet = await service.requestApproval(createTestRequest({ timeoutPolicy: "reject" }));
  const decision = service.buildTimeoutDecision(packet.approvalId, "custom:responder");

  assert.equal(decision.respondedBy, "custom:responder");
});

test("buildTimeoutDecision throws when packet not found", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService(),
    createMockExplainabilityService(),
  );

  assert.throws(
    () => service.buildTimeoutDecision("non-existent-id"),
    /hitl_approval\.packet_not_found/,
  );
});

test("getPacket returns null when approval not found", () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService(),
    createMockExplainabilityService(),
  );

  const result = service.getPacket("non-existent-id");
  assert.equal(result, null);
});

test("getPacket returns stored packet after requestApproval", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService(),
    createMockExplainabilityService(),
  );

  const packet = await service.requestApproval(createTestRequest());
  const retrieved = service.getPacket(packet.approvalId);

  assert.ok(retrieved != null);
  assert.equal(retrieved.approvalId, packet.approvalId);
  assert.equal(retrieved.taskId, "task-1");
  assert.equal(retrieved.title, "Test Approval");
});

test("getFeedbackLink returns feedback link after requestApproval", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService(),
    createMockExplainabilityService(),
  );

  const packet = await service.requestApproval(createTestRequest());
  const feedbackLink = service.getFeedbackLink(packet.approvalId);

  assert.ok(feedbackLink != null);
  assert.equal(feedbackLink.approvalId, packet.approvalId);
  assert.equal(feedbackLink.taskId, "task-1");
  assert.equal(feedbackLink.decisionEffect, "continue");
});

test("applyDecision throws when feedback link not found", () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService(),
    createMockExplainabilityService(),
  );

  const decision: ApprovalDecision = {
    approvalId: "non-existent",
    decisionType: "expired",
    respondedBy: "system",
    respondedAt: nowIso(),
  };

  assert.throws(
    () => service.applyDecision(decision),
    /hitl_approval\.feedback_link_not_found/,
  );
});

test("applyDecision with expired approval transitions to block_candidate effect", async () => {
  const mockApprovalService = createMockApprovalService();
  const service = new HitlApprovalOrchestrationService(
    mockApprovalService,
    createMockExplainabilityService(),
  );

  const packet = await service.requestApproval(createTestRequest({ timeoutPolicy: "reject" }));
  const expiredDecision: ApprovalDecision = {
    approvalId: packet.approvalId,
    decisionType: "expired",
    respondedBy: "system:hitl_timeout",
    respondedAt: nowIso(),
  };

  const result = service.applyDecision(expiredDecision);

  assert.equal(result.approvalId, packet.approvalId);
  assert.equal(result.decision.decisionType, "expired");
  assert.equal(result.feedbackLink.decisionEffect, "block_candidate");
});

test("applyDecision with rejected approval transitions to rejected state", async () => {
  const mockApprovalService = createMockApprovalService();
  const service = new HitlApprovalOrchestrationService(
    mockApprovalService,
    createMockExplainabilityService(),
  );

  const packet = await service.requestApproval(createTestRequest());
  const rejectedDecision: ApprovalDecision = {
    approvalId: packet.approvalId,
    decisionType: "rejected",
    respondedBy: "operator-1",
    respondedAt: nowIso(),
  };

  const result = service.applyDecision(rejectedDecision);

  assert.equal(result.approvalId, packet.approvalId);
  assert.equal(result.decision.decisionType, "rejected");
  assert.equal(result.feedbackLink.decisionEffect, "block_candidate");
});

test("applyDecision with confirmed approval transitions to confirmed state", async () => {
  const mockApprovalService = createMockApprovalService();
  const service = new HitlApprovalOrchestrationService(
    mockApprovalService,
    createMockExplainabilityService(),
  );

  const packet = await service.requestApproval(createTestRequest({ timeoutPolicy: "approve" }));
  const confirmedDecision: ApprovalDecision = {
    approvalId: packet.approvalId,
    decisionType: "confirmed",
    confirmed: true,
    respondedBy: "operator-1",
    respondedAt: nowIso(),
  };

  const result = service.applyDecision(confirmedDecision);

  assert.equal(result.approvalId, packet.approvalId);
  assert.equal(result.decision.decisionType, "confirmed");
  assert.equal(result.feedbackLink.decisionEffect, "continue");
});

test("applyDecision with option_selected and rollback transitions to rollback_rollout effect", async () => {
  const mockApprovalService = createMockApprovalService();
  const service = new HitlApprovalOrchestrationService(
    mockApprovalService,
    createMockExplainabilityService(),
  );

  const packet = await service.requestApproval(createTestRequest());
  const rollbackDecision: ApprovalDecision = {
    approvalId: packet.approvalId,
    decisionType: "option_selected",
    selectedOptionId: "rollback",
    respondedBy: "operator-1",
    respondedAt: nowIso(),
  };

  const result = service.applyDecision(rollbackDecision);

  assert.equal(result.feedbackLink.decisionEffect, "rollback_rollout");
});

test("applyDecision with option_selected and advance_rollout transitions to advance_rollout effect", async () => {
  const mockApprovalService = createMockApprovalService();
  const service = new HitlApprovalOrchestrationService(
    mockApprovalService,
    createMockExplainabilityService(),
  );

  const packet = await service.requestApproval(createTestRequest());
  const advanceDecision: ApprovalDecision = {
    approvalId: packet.approvalId,
    decisionType: "option_selected",
    selectedOptionId: "advance_rollout",
    respondedBy: "operator-1",
    respondedAt: nowIso(),
  };

  const result = service.applyDecision(advanceDecision);

  assert.equal(result.feedbackLink.decisionEffect, "advance_rollout");
});

test("applyDecision with option_selected and approve_candidate transitions to approve_candidate effect", async () => {
  const mockApprovalService = createMockApprovalService();
  const service = new HitlApprovalOrchestrationService(
    mockApprovalService,
    createMockExplainabilityService(),
  );

  const packet = await service.requestApproval(createTestRequest());
  const approveDecision: ApprovalDecision = {
    approvalId: packet.approvalId,
    decisionType: "option_selected",
    selectedOptionId: "approve_candidate",
    respondedBy: "operator-1",
    respondedAt: nowIso(),
  };

  const result = service.applyDecision(approveDecision);

  assert.equal(result.feedbackLink.decisionEffect, "approve_candidate");
});

test("applyDecision with text_input transitions to revise_plan effect", async () => {
  const mockApprovalService = createMockApprovalService();
  const service = new HitlApprovalOrchestrationService(
    mockApprovalService,
    createMockExplainabilityService(),
  );

  const packet = await service.requestApproval(createTestRequest());
  const textInputDecision: ApprovalDecision = {
    approvalId: packet.approvalId,
    decisionType: "text_input",
    inputText: "Please provide more details",
    respondedBy: "operator-1",
    respondedAt: nowIso(),
  };

  const result = service.applyDecision(textInputDecision);

  assert.equal(result.feedbackLink.decisionEffect, "revise_plan");
});

test("applyDecision updates feedbackSignalId for non-expired decisions", async () => {
  const mockApprovalService = createMockApprovalService();
  const service = new HitlApprovalOrchestrationService(
    mockApprovalService,
    createMockExplainabilityService(),
  );

  const packet = await service.requestApproval(createTestRequest());
  const decision: ApprovalDecision = {
    approvalId: packet.approvalId,
    decisionType: "confirmed",
    confirmed: true,
    respondedBy: "operator-1",
    respondedAt: nowIso(),
  };

  const result = service.applyDecision(decision);

  assert.ok(result.feedbackLink.feedbackSignalId != null);
});

test("applyDecision keeps feedbackSignalId null for expired decisions", async () => {
  const mockApprovalService = createMockApprovalService();
  const service = new HitlApprovalOrchestrationService(
    mockApprovalService,
    createMockExplainabilityService(),
  );

  const packet = await service.requestApproval(createTestRequest());
  const decision: ApprovalDecision = {
    approvalId: packet.approvalId,
    decisionType: "expired",
    respondedBy: "system:hitl_timeout",
    respondedAt: nowIso(),
  };

  const result = service.applyDecision(decision);

  assert.equal(result.feedbackLink.feedbackSignalId, null);
});

test("notificationPort is called when dispatching packet", async () => {
  const mockApprovalService = createMockApprovalService();
  const mockExplainabilityService = createMockExplainabilityService();

  let dispatchCalled = false;
  let dispatchPacket: any = null;

  const notificationPort: ApprovalNotificationPort = {
    dispatch: async (packet: any) => {
      dispatchCalled = true;
      dispatchPacket = packet;
      return { channel: "test", delivered: true, deliveryId: newId("notif") };
    },
  };

  const service = new HitlApprovalOrchestrationService(
    mockApprovalService,
    mockExplainabilityService,
    notificationPort,
  );

  await service.requestApproval(createTestRequest());

  assert.equal(dispatchCalled, true);
  assert.ok(dispatchPacket != null);
  assert.equal(dispatchPacket.title, "Test Approval");
});

test("notificationPort is optional and service works without it", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService(),
    createMockExplainabilityService(),
    null,
  );

  const packet = await service.requestApproval(createTestRequest());

  assert.ok(packet != null);
  assert.equal(packet.approvalId.length > 0, true);
});

test("listPackets returns all stored packets", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService(),
    createMockExplainabilityService(),
  );

  await service.requestApproval(createTestRequest({ taskId: "task-1" }));
  await service.requestApproval(createTestRequest({ taskId: "task-2" }));

  const packets = service.listPackets();

  assert.equal(packets.length, 2);
});

test("listFeedbackLinks returns all stored feedback links", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService(),
    createMockExplainabilityService(),
  );

  await service.requestApproval(createTestRequest({ taskId: "task-1" }));
  await service.requestApproval(createTestRequest({ taskId: "task-2" }));

  const links = service.listFeedbackLinks();

  assert.equal(links.length, 2);
});

test("requestApproval throws when options are empty", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService(),
    createMockExplainabilityService(),
  );

  assert.rejects(
    async () => service.requestApproval(createTestRequest({ options: [] })),
    /hitl_approval\.options_required/,
  );
});

test("requestApproval throws when critical risk with approve timeout without breakGlassApproved", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService(),
    createMockExplainabilityService(),
  );

  assert.rejects(
    async () => service.requestApproval(
      createTestRequest({
        riskLevel: "critical",
        timeoutPolicy: "approve",
      }),
    ),
    /hitl_approval\.critical_timeout_auto_approve_forbidden/,
  );
});

test("requestApproval accepts critical risk with approve timeout when breakGlassApproved is true", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService(),
    createMockExplainabilityService(),
  );

  const packet = await service.requestApproval(
    createTestRequest({
      riskLevel: "critical",
      timeoutPolicy: "approve",
      breakGlassApproved: true,
    }),
  );

  assert.ok(packet != null);
  assert.equal(packet.riskLevel, "critical");
});

test("requestApproval stores packet with correct deadlineAt", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService(),
    createMockExplainabilityService(),
  );

  const deadlineAt = "2025-01-01T00:00:00.000Z";
  const packet = await service.requestApproval(createTestRequest({ deadlineAt }));

  assert.equal(packet.deadlineAt, deadlineAt);
});

test("requestApproval stores packet with correct timeoutPolicy", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService(),
    createMockExplainabilityService(),
  );

  const packet = await service.requestApproval(createTestRequest({ timeoutPolicy: "approve" }));

  assert.equal(packet.timeoutPolicy, "approve");
});

test("getFeedbackLink returns null for non-existent approval", () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService(),
    createMockExplainabilityService(),
  );

  const result = service.getFeedbackLink("non-existent");
  assert.equal(result, null);
});
