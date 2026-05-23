/**
 * Comprehensive tests for ApprovalFlowEngine
 * Source: src/platform/five-plane-control-plane/approval-center/approval-flow-engine.ts
 */

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

import { EscalationManager } from "../../../../../src/platform/five-plane-control-plane/approval-center/escalation-manager.js";
import {
  DEFAULT_ESCALATION_RULE,
  DEFAULT_TIMEOUT_CONFIG,
  FlowStatus,
  FlowType,
  type ApprovalFlowConfig,
} from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-flow-types.js";
import { VoteType } from "../../../../../src/platform/five-plane-control-plane/approval-center/quorum-calculator.js";
import { ApprovalFlowEngine } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-flow-engine.js";

describe("ApprovalFlowEngine", () => {

  const createMockEscalationManager = () => new EscalationManager();

  function createFlowConfig(
    overrides: Partial<Omit<ApprovalFlowConfig, "flowId">> & Pick<Omit<ApprovalFlowConfig, "flowId">, "flowType" | "approvers">,
  ): Omit<ApprovalFlowConfig, "flowId"> {
    return {
      timeout: DEFAULT_TIMEOUT_CONFIG,
      escalation: DEFAULT_ESCALATION_RULE,
      ...overrides,
    };
  }

  describe("createFlow", () => {
    it("should create a single-party flow with pending status", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const request = {
        approvalId: "approval-123",
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "high" as const,
        options: ["approve", "reject"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
        createdAt: nowIso(),
      };

      const flow = engine.createFlow(
        createFlowConfig({
          flowType: FlowType.SINGLE,
          approvers: [{ type: "user", identifier: "user-1", can_delegate: false }],
        }),
        request,
      );

      assert.ok(flow.flowId);
      assert.strictEqual(flow.status, FlowStatus.PENDING);
      assert.strictEqual(flow.request.approvalId, "approval-123");
    });

    it("should create a multi-party flow with quorum config", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const request = {
        approvalId: "approval-123",
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need multi-party approval",
        riskLevel: "critical" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
        createdAt: nowIso(),
      };

      const flow = engine.createFlow(
        createFlowConfig({
          flowType: FlowType.MULTI_PARTY,
          approvers: [
            { type: "user", identifier: "user-1", can_delegate: false },
            { type: "user", identifier: "user-2", can_delegate: false },
          ],
          quorum: {
            minApprovals: 2,
            minRejectionsToDeny: 2,
          },
        }),
        request,
      );

      assert.ok(flow.flowId);
      assert.strictEqual(flow.config.quorum?.minApprovals, 2);
    });

    it("should set expiration time when timeout configured", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const request = {
        approvalId: "approval-123",
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "low" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "approve" as const,
        createdAt: nowIso(),
      };

      const flow = engine.createFlow(
        createFlowConfig({
          flowType: FlowType.SINGLE,
          approvers: [{ type: "user", identifier: "user-1", can_delegate: false }],
          timeout: {
            warnAfterMs: 60000,
            escalateAfterMs: 120000,
            autoActionAfterMs: 300000,
            autoAction: "deny" as const,
          },
        }),
        request,
      );

      assert.ok(flow.expiresAt);
    });
  });

  describe("submitVote", () => {
    it("should accept approve vote on single-party flow", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const request = {
        approvalId: "approval-123",
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "low" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
        createdAt: nowIso(),
      };

      const flow = engine.createFlow(
        createFlowConfig({
          flowType: FlowType.SINGLE,
          approvers: [{ type: "user", identifier: "user-1", can_delegate: false }],
        }),
        request,
      );

      const result = engine.submitVote(flow.flowId, "user-1", VoteType.APPROVE);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.flowStatus, FlowStatus.APPROVED);
    });

    it("should reject vote from non-configured approver", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const request = {
        approvalId: "approval-123",
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "low" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
        createdAt: nowIso(),
      };

      const flow = engine.createFlow(
        createFlowConfig({
          flowType: FlowType.SINGLE,
          approvers: [{ type: "user", identifier: "user-1", can_delegate: false }],
        }),
        request,
      );

      const result = engine.submitVote(flow.flowId, "user-unauthorized", VoteType.APPROVE);

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes("not configured"));
    });

    it("should return error for non-existent flow", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const result = engine.submitVote("nonexistent-flow-id", "user-1", VoteType.APPROVE);

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes("not found"));
    });

    it("should reject vote on already finalized flow", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const request = {
        approvalId: "approval-123",
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "low" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
        createdAt: nowIso(),
      };

      const flow = engine.createFlow(
        createFlowConfig({
          flowType: FlowType.SINGLE,
          approvers: [{ type: "user", identifier: "user-1", can_delegate: false }],
        }),
        request,
      );

      // First vote approves
      engine.submitVote(flow.flowId, "user-1", VoteType.APPROVE);

      // Second vote should fail
      const result = engine.submitVote(flow.flowId, "user-1", VoteType.REJECT);

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes("not pending"));
    });
  });

  describe("delegateApproval", () => {
    it("should create delegation when approver can delegate", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const request = {
        approvalId: "approval-123",
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "low" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
        createdAt: nowIso(),
      };

      const flow = engine.createFlow(
        createFlowConfig({
          flowType: FlowType.SINGLE,
          approvers: [{ type: "user", identifier: "user-1", can_delegate: true }],
        }),
        request,
      );

      const result = engine.delegateApproval(flow.flowId, "user-1", "user-2");

      assert.strictEqual(result.success, true);
      assert.ok(result.delegation);
    });

    it("should fail when approver cannot delegate", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const request = {
        approvalId: "approval-123",
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "low" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
        createdAt: nowIso(),
      };

      const flow = engine.createFlow(
        createFlowConfig({
          flowType: FlowType.SINGLE,
          approvers: [{ type: "user", identifier: "user-1", can_delegate: false }],
        }),
        request,
      );

      const result = engine.delegateApproval(flow.flowId, "user-1", "user-2");

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes("cannot delegate"));
    });
  });

  describe("checkEscalation", () => {
    it("should return null when escalation not needed", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const request = {
        approvalId: "approval-123",
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "low" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
        createdAt: nowIso(),
      };

      const flow = engine.createFlow(
        createFlowConfig({
          flowType: FlowType.SINGLE,
          approvers: [{ type: "user", identifier: "user-1", can_delegate: false }],
        }),
        request,
      );

      const result = engine.checkEscalation(flow.flowId);

      assert.strictEqual(result, null);
    });

    it("should return null for finalized flow", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const request = {
        approvalId: "approval-123",
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "low" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
        createdAt: nowIso(),
      };

      const flow = engine.createFlow(
        createFlowConfig({
          flowType: FlowType.SINGLE,
          approvers: [{ type: "user", identifier: "user-1", can_delegate: false }],
        }),
        request,
      );

      engine.submitVote(flow.flowId, "user-1", VoteType.APPROVE);

      const result = engine.checkEscalation(flow.flowId);

      assert.strictEqual(result, null);
    });
  });

  describe("addFeedback", () => {
    it("should add feedback and increment iteration", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const request = {
        approvalId: "approval-123",
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need feedback",
        riskLevel: "low" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
        createdAt: nowIso(),
      };

      const flow = engine.createFlow(
        createFlowConfig({
          flowType: FlowType.SINGLE,
          approvers: [{ type: "user", identifier: "user-1", can_delegate: false }],
          feedbackLoop: {
            maxIterations: 5,
            requireReplanOnReject: true,
          },
        }),
        request,
      );

      const result = engine.addFeedback(flow.flowId, {
        feedbackType: "approve",
        principal: "user-1",
        guidance: "Looks good",
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.newIteration, 1);
    });

    it("should finalize flow when approved via feedback", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const request = {
        approvalId: "approval-123",
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need feedback",
        riskLevel: "low" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
        createdAt: nowIso(),
      };

      const flow = engine.createFlow(
        createFlowConfig({
          flowType: FlowType.SINGLE,
          approvers: [{ type: "user", identifier: "user-1", can_delegate: false }],
          feedbackLoop: {
            maxIterations: 5,
            requireReplanOnReject: true,
          },
        }),
        request,
      );

      const result = engine.addFeedback(flow.flowId, {
        feedbackType: "approve",
        principal: "user-1",
      });

      assert.strictEqual(result.flowStatus, FlowStatus.APPROVED);
    });

    it("should return error when max iterations reached", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const request = {
        approvalId: "approval-123",
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need feedback",
        riskLevel: "low" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
        createdAt: nowIso(),
      };

      const flow = engine.createFlow(
        createFlowConfig({
          flowType: FlowType.SINGLE,
          approvers: [{ type: "user", identifier: "user-1", can_delegate: false }],
          feedbackLoop: {
            maxIterations: 1,
            requireReplanOnReject: true,
          },
        }),
        request,
      );

      // First feedback
      engine.addFeedback(flow.flowId, {
        feedbackType: "reject_with_guidance",
        principal: "user-1",
      });

      // Second feedback should fail
      const result = engine.addFeedback(flow.flowId, {
        feedbackType: "reject_with_guidance",
        principal: "user-1",
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error?.includes("Max iterations"));
    });
  });

  describe("getFlowStatus", () => {
    it("should return null for non-existent flow", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const result = engine.getFlowStatus("nonexistent");

      assert.strictEqual(result, null);
    });

    it("should return flow state for existing flow", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const request = {
        approvalId: "approval-123",
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "low" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
        createdAt: nowIso(),
      };

      const flow = engine.createFlow(
        createFlowConfig({
          flowType: FlowType.SINGLE,
          approvers: [{ type: "user", identifier: "user-1", can_delegate: false }],
        }),
        request,
      );

      const result = engine.getFlowStatus(flow.flowId);

      assert.ok(result);
      assert.strictEqual(result?.flowId, flow.flowId);
    });
  });

  describe("getFlowsForTask", () => {
    it("should return all flows for a task", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const request = {
        approvalId: "approval-123",
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "low" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
        createdAt: nowIso(),
      };

      engine.createFlow(
        createFlowConfig({
          flowType: FlowType.SINGLE,
          approvers: [{ type: "user", identifier: "user-1", can_delegate: false }],
        }),
        request,
      );

      const result = engine.getFlowsForTask("task-123");

      assert.strictEqual(result.length, 1);
    });
  });

  describe("createMultiPartyFlow", () => {
    it("should create multi-party flow with correct quorum", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const request = {
        approvalId: "approval-123",
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need multi-party approval",
        riskLevel: "critical" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
        createdAt: nowIso(),
      };

      const flow = engine.createMultiPartyFlow(
        request,
        2,
        [
          { type: "user", identifier: "user-1", can_delegate: false },
          { type: "user", identifier: "user-2", can_delegate: false },
        ],
      );

      assert.strictEqual(flow.config.flowType, FlowType.MULTI_PARTY);
      assert.strictEqual(flow.config.quorum?.minApprovals, 2);
    });
  });

  describe("createSinglePartyFlow", () => {
    it("should create single-party flow", () => {
      const escalationManager = createMockEscalationManager();
      const engine = new ApprovalFlowEngine(escalationManager);

      const request = {
        approvalId: "approval-123",
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "low" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
        createdAt: nowIso(),
      };

      const flow = engine.createSinglePartyFlow(
        request,
        { type: "user", identifier: "user-1", can_delegate: false },
      );

      assert.strictEqual(flow.config.flowType, FlowType.SINGLE);
      assert.strictEqual(flow.config.approvers.length, 1);
    });
  });
});
