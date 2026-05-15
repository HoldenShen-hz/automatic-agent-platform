/**
 * Unit tests for HitlApprovalOrchestrationService
 * Tests approval request creation, timeout handling, break-glass emergency approvals
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalService } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { HITLExplainabilityService } from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-explainability-service.js";
import { HitlApprovalOrchestrationService } from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-approval-orchestration-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "hitl-approval-test.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

import { join } from "node:path";

test("HitlApprovalOrchestrationService creates approval request with all modes", async () => {
  const h = createHarness("aa-hitl-mode-test-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_mode_test", executionId: "exec_mode_test" });
    const approvalService = new ApprovalService(h.db, h.store);
    const explainabilityService = new HITLExplainabilityService(h.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const modes = [
      "single_approval",
      "multi_party_approval",
      "delegated_approval",
      "iterative_feedback",
      "collaborative_edit",
      "informed_confirmation",
      "circuit_breaker_human",
    ];

    for (const mode of modes) {
      const context =
        mode === "multi_party_approval"
          ? { requiredApprovals: 2 }
          : mode === "delegated_approval"
            ? { delegationTarget: "delegate_1" }
            : mode === "collaborative_edit"
              ? { sharedArtifactRef: "artifact:shared-doc-1" }
              : undefined;
      const options =
        mode === "iterative_feedback"
          ? [
              { optionId: "approve", label: "Approve", style: "primary" as const, requiresConfirm: true },
              { optionId: "request_changes", label: "Request changes", style: "secondary" as const, requiresConfirm: false },
            ]
          : [{ optionId: "approve", label: "Approve", style: "primary" as const, requiresConfirm: true }];
      const packet = await service.requestApproval({
        taskId: "task_mode_test",
        executionId: "exec_mode_test",
        sourceAgentId: "test_agent",
        mode: mode as any,
        title: `Test ${mode}`,
        reason: "Testing mode",
        riskLevel: mode === "circuit_breaker_human" ? "critical" : "medium",
        stageRef: "plan",
        options,
        timeoutPolicy: "reject",
        ...(context != null ? { context } : {}),
      });

      assert.equal(packet.mode, mode, `Mode ${mode} should match`);
      assert.ok(packet.explanation, `Explanation should exist for ${mode}`);
    }
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HitlApprovalOrchestrationService applies text input decision with revise_plan effect", async () => {
  const h = createHarness("aa-hitl-text-decision-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_text_1", executionId: "exec_text_1" });
    const approvalService = new ApprovalService(h.db, h.store);
    const explainabilityService = new HITLExplainabilityService(h.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const deliveries: string[] = [];
    const mockPort = {
      async dispatch(packet) {
        deliveries.push(packet.approvalId);
        return { channel: "console", delivered: true, deliveryId: packet.approvalId };
      },
    };

    // @ts-ignore - testing with mock port
    const serviceWithPort = new HitlApprovalOrchestrationService(approvalService, explainabilityService, mockPort);

    const packet = await serviceWithPort.requestApproval({
      taskId: "task_text_1",
      executionId: "exec_text_1",
      sourceAgentId: "planner",
      mode: "iterative_feedback",
      title: "Plan revision needed",
      reason: "Ambiguous requirements",
      riskLevel: "high",
      stageRef: "plan",
      options: [
        { optionId: "approve_candidate", label: "Approve", style: "primary", requiresConfirm: true },
        { optionId: "request_changes", label: "Request changes", style: "secondary", requiresConfirm: false },
      ],
      timeoutPolicy: "reject",
    });

    const result = serviceWithPort.applyDecision({
      approvalId: packet.approvalId,
      decisionType: "text_input",
      inputText: "Please revise to use cn-sh region only",
      respondedBy: "operator_1",
      respondedAt: new Date().toISOString(),
    });

    assert.equal(result.feedbackLink.decisionEffect, "revise_plan");
    assert.ok(result.feedbackLink.feedbackSignalId?.startsWith("feedback_signal_"));
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HitlApprovalOrchestrationService rejects critical risk with auto-approve timeout without break-glass", async () => {
  const h = createHarness("aa-hitl-critical-block-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_critical_1", executionId: "exec_critical_1" });
    const approvalService = new ApprovalService(h.db, h.store);
    const explainabilityService = new HITLExplainabilityService(h.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    await assert.rejects(
      async () => {
        await service.requestApproval({
          taskId: "task_critical_1",
          executionId: "exec_critical_1",
          sourceAgentId: "ops_agent",
          mode: "circuit_breaker_human",
          title: "Critical release gate",
          reason: "Production deployment",
          riskLevel: "critical",
          stageRef: "release",
          options: [{ optionId: "approve", label: "Approve", style: "primary", requiresConfirm: true }],
          timeoutPolicy: "approve",
        });
      },
      /hitl_approval\.critical_timeout_auto_approve_forbidden/,
    );
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HitlApprovalOrchestrationService allows critical risk with break-glass approved", async () => {
  const h = createHarness("aa-hitl-break-glass-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_breakglass_1", executionId: "exec_breakglass_1" });
    const approvalService = new ApprovalService(h.db, h.store);
    const explainabilityService = new HITLExplainabilityService(h.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const packet = await service.requestApproval({
      taskId: "task_breakglass_1",
      executionId: "exec_breakglass_1",
      sourceAgentId: "ops_agent",
      mode: "circuit_breaker_human",
      title: "Emergency break-glass approval",
      reason: "Production incident requires immediate action",
      riskLevel: "critical",
      stageRef: "execute",
      options: [{ optionId: "emergency_approve", label: "Emergency Approve", style: "danger", requiresConfirm: true }],
      timeoutPolicy: "approve",
      breakGlassApproved: true,
    });

    assert.equal(packet.approvalId.startsWith("approval_"), true);
    assert.equal(packet.riskLevel, "critical");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HitlApprovalOrchestrationService builds timeout decision with approve policy", async () => {
  const h = createHarness("aa-hitl-timeout-approve-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_timeout_1", executionId: "exec_timeout_1" });
    const approvalService = new ApprovalService(h.db, h.store);
    const explainabilityService = new HITLExplainabilityService(h.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const packet = await service.requestApproval({
      taskId: "task_timeout_1",
      executionId: "exec_timeout_1",
      sourceAgentId: "agent_1",
      mode: "informed_confirmation",
      title: "Wait for confirmation",
      reason: "Need human confirmation",
      riskLevel: "medium",
      stageRef: "execute",
      options: [{ optionId: "confirm", label: "Confirm", style: "primary", requiresConfirm: true }],
      timeoutPolicy: "approve",
    });

    const timeoutDecision = service.buildTimeoutDecision(packet.approvalId);

    assert.equal(timeoutDecision.decisionType, "confirmed");
    assert.equal(timeoutDecision.confirmed, true);
    assert.equal(timeoutDecision.respondedBy, "system:hitl_timeout");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HitlApprovalOrchestrationService builds timeout decision with reject policy", async () => {
  const h = createHarness("aa-hitl-timeout-reject-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_timeout_2", executionId: "exec_timeout_2" });
    const approvalService = new ApprovalService(h.db, h.store);
    const explainabilityService = new HITLExplainabilityService(h.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const packet = await service.requestApproval({
      taskId: "task_timeout_2",
      executionId: "exec_timeout_2",
      sourceAgentId: "agent_2",
      mode: "single_approval",
      title: "Single approval",
      reason: "Standard approval",
      riskLevel: "medium",
      stageRef: "plan",
      options: [{ optionId: "approve", label: "Approve", style: "primary", requiresConfirm: true }],
      timeoutPolicy: "reject",
    });

    const timeoutDecision = service.buildTimeoutDecision(packet.approvalId);

    assert.equal(timeoutDecision.decisionType, "expired");
    assert.equal(timeoutDecision.respondedBy, "system:hitl_timeout");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HitlApprovalOrchestrationService applies option-based decision with approve_candidate effect", async () => {
  const h = createHarness("aa-hitl-option-decision-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_option_1", executionId: "exec_option_1" });
    const approvalService = new ApprovalService(h.db, h.store);
    const explainabilityService = new HITLExplainabilityService(h.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const packet = await service.requestApproval({
      taskId: "task_option_1",
      executionId: "exec_option_1",
      sourceAgentId: "planner",
      mode: "single_approval",
      title: "Candidate approval",
      reason: "Candidate ready for review",
      riskLevel: "medium",
      stageRef: "plan",
      options: [
        { optionId: "approve_candidate", label: "Approve Candidate", style: "primary", requiresConfirm: true },
        { optionId: "reject_candidate", label: "Reject", style: "danger", requiresConfirm: true },
      ],
      timeoutPolicy: "reject",
    });

    const result = service.applyDecision({
      approvalId: packet.approvalId,
      decisionType: "selected",
      selectedOptionId: "approve_candidate",
      respondedBy: "operator_1",
      respondedAt: new Date().toISOString(),
    });

    assert.equal(result.feedbackLink.decisionEffect, "approve_candidate");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HitlApprovalOrchestrationService applies rejection decision with block_candidate effect", async () => {
  const h = createHarness("aa-hitl-reject-decision-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_reject_1", executionId: "exec_reject_1" });
    const approvalService = new ApprovalService(h.db, h.store);
    const explainabilityService = new HITLExplainabilityService(h.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const packet = await service.requestApproval({
      taskId: "task_reject_1",
      executionId: "exec_reject_1",
      sourceAgentId: "planner",
      mode: "single_approval",
      title: "Rejection test",
      reason: "Testing rejection",
      riskLevel: "high",
      stageRef: "plan",
      options: [
        { optionId: "approve", label: "Approve", style: "primary", requiresConfirm: true },
        { optionId: "reject", label: "Reject", style: "danger", requiresConfirm: true },
      ],
      timeoutPolicy: "reject",
    });

    const result = service.applyDecision({
      approvalId: packet.approvalId,
      decisionType: "rejected",
      respondedBy: "operator_1",
      respondedAt: new Date().toISOString(),
    });

    assert.equal(result.feedbackLink.decisionEffect, "block_candidate");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HitlApprovalOrchestrationService throws when packet not found for buildTimeoutDecision", async () => {
  const h = createHarness("aa-hitl-timeout-notfound-");
  try {
    const approvalService = new ApprovalService(h.db, h.store);
    const explainabilityService = new HITLExplainabilityService(h.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    assert.throws(
      () => service.buildTimeoutDecision("nonexistent_approval"),
      /hitl_approval\.packet_not_found/,
    );
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HitlApprovalOrchestrationService stores and retrieves packets", async () => {
  const h = createHarness("aa-hitl-packet-storage-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_packet_1", executionId: "exec_packet_1" });
    const approvalService = new ApprovalService(h.db, h.store);
    const explainabilityService = new HITLExplainabilityService(h.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const packet = await service.requestApproval({
      taskId: "task_packet_1",
      executionId: "exec_packet_1",
      sourceAgentId: "agent_1",
      mode: "single_approval",
      title: "Packet storage test",
      reason: "Testing packet retrieval",
      riskLevel: "low",
      stageRef: "plan",
      options: [{ optionId: "approve", label: "Approve", style: "primary", requiresConfirm: true }],
      timeoutPolicy: "reject",
    });

    const retrieved = service.getPacket(packet.approvalId);
    assert.ok(retrieved, "Packet should be retrievable");
    assert.equal(retrieved!.approvalId, packet.approvalId);

    const allPackets = service.listPackets();
    assert.ok(allPackets.length > 0, "Should have at least one packet");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("HitlApprovalOrchestrationService stores and retrieves feedback links", async () => {
  const h = createHarness("aa-hitl-feedback-link-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_feedback_1", executionId: "exec_feedback_1" });
    const approvalService = new ApprovalService(h.db, h.store);
    const explainabilityService = new HITLExplainabilityService(h.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const packet = await service.requestApproval({
      taskId: "task_feedback_1",
      executionId: "exec_feedback_1",
      sourceAgentId: "agent_1",
      mode: "single_approval",
      title: "Feedback link test",
      reason: "Testing feedback link",
      riskLevel: "medium",
      stageRef: "plan",
      options: [{ optionId: "approve", label: "Approve", style: "primary", requiresConfirm: true }],
      timeoutPolicy: "reject",
    });

    const feedbackLink = service.getFeedbackLink(packet.approvalId);
    assert.ok(feedbackLink, "Feedback link should exist");
    assert.equal(feedbackLink!.approvalId, packet.approvalId);
    assert.equal(feedbackLink!.stageRef, "plan");

    service.applyDecision({
      approvalId: packet.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "operator_1",
      respondedAt: new Date().toISOString(),
    });

    const updatedLink = service.getFeedbackLink(packet.approvalId);
    assert.ok(updatedLink, "Updated feedback link should exist");
    assert.ok(updatedLink!.feedbackSignalId, "Should have feedback signal ID after confirmation");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
