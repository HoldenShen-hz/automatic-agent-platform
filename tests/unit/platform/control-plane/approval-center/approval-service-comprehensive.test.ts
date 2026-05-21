/**
 * Comprehensive tests for ApprovalService
 * Source: src/platform/five-plane-control-plane/approval-center/approval-service.ts
 */

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";

import { ApprovalService, validateApprovalDecision } from "../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";

// Mock dependencies before imports
const mockRepository = {
  insertApproval: mock.fn(),
  insertEvent: mock.fn(),
  getApproval: mock.fn(),
  updateApprovalDecisionCas: mock.fn(),
  updateExecutionStatus: mock.fn(),
  listApprovalsByTask: mock.fn(),
  updateApprovalRequest: mock.fn(),
};

const mockStore = {
  execution: {
    getExecution: mock.fn(),
  },
};

const mockDb = {
  transaction: mock.fn((fn) => fn()),
  connection: {},
};

const mockDirectiveSink = {
  emitDecisionDirective: mock.fn(),
};

describe("ApprovalService", () => {
  describe("validateApprovalDecision", () => {
    it("should accept valid option_selected decision", () => {
      assert.doesNotThrow(() => {
        validateApprovalDecision({
          approvalId: "approval-123",
          decisionType: "option_selected",
          selectedOptionId: "option-1",
          respondedBy: "user-1",
          respondedAt: "2026-01-01T00:00:00.000Z",
        });
      });
    });

    it("should accept valid confirmed decision", () => {
      assert.doesNotThrow(() => {
        validateApprovalDecision({
          approvalId: "approval-123",
          decisionType: "confirmed",
          confirmed: true,
          respondedBy: "user-1",
          respondedAt: "2026-01-01T00:00:00.000Z",
        });
      });
    });

    it("should accept valid text_input decision", () => {
      assert.doesNotThrow(() => {
        validateApprovalDecision({
          approvalId: "approval-123",
          decisionType: "text_input",
          inputText: "Looks good to me",
          respondedBy: "user-1",
          respondedAt: "2026-01-01T00:00:00.000Z",
        });
      });
    });

    it("should accept valid rejected decision", () => {
      assert.doesNotThrow(() => {
        validateApprovalDecision({
          approvalId: "approval-123",
          decisionType: "rejected",
          respondedBy: "user-1",
          respondedAt: "2026-01-01T00:00:00.000Z",
        });
      });
    });

    it("should accept valid expired decision", () => {
      assert.doesNotThrow(() => {
        validateApprovalDecision({
          approvalId: "approval-123",
          decisionType: "expired",
          respondedBy: "system",
          respondedAt: "2026-01-01T00:00:00.000Z",
        });
      });
    });

    it("should reject option_selected without selectedOptionId", () => {
      assert.throws(() => {
        validateApprovalDecision({
          approvalId: "approval-123",
          decisionType: "option_selected",
          respondedBy: "user-1",
          respondedAt: "2026-01-01T00:00:00.000Z",
        });
      }, /selectedOptionId/);
    });

    it("should reject confirmed without confirmed=true", () => {
      assert.throws(() => {
        validateApprovalDecision({
          approvalId: "approval-123",
          decisionType: "confirmed",
          respondedBy: "user-1",
          respondedAt: "2026-01-01T00:00:00.000Z",
        });
      }, /confirmed.*true/);
    });

    it("should reject text_input without inputText", () => {
      assert.throws(() => {
        validateApprovalDecision({
          approvalId: "approval-123",
          decisionType: "text_input",
          respondedBy: "user-1",
          respondedAt: "2026-01-01T00:00:00.000Z",
        });
      }, /inputText/);
    });

    it("should reject terminal decisions with extra payload", () => {
      assert.throws(() => {
        validateApprovalDecision({
          approvalId: "approval-123",
          decisionType: "rejected",
          selectedOptionId: "option-1",
          respondedBy: "user-1",
          respondedAt: "2026-01-01T00:00:00.000Z",
        });
      }, /terminal/);
    });
  });

  describe("ApprovalService.createRequest", () => {
    it("should create a new approval request with generated ID", () => {
      const service = new ApprovalService(mockDb as any, mockStore as any, mockRepository as any, mockDirectiveSink as any);

      const input = {
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need approval for deployment",
        riskLevel: "high" as const,
        options: ["approve", "reject"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
      };

      const result = service.createRequest(input);

      assert.ok(result.approvalId);
      assert.ok(result.createdAt);
      assert.strictEqual(result.taskId, "task-123");
      assert.strictEqual(result.status, "pending");
    });

    it("should set timeoutAutoAction based on timeoutPolicy", () => {
      const service = new ApprovalService(mockDb as any, mockStore as any, mockRepository as any, mockDirectiveSink as any);

      const input = {
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "medium" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "approve" as const,
      };

      const result = service.createRequest(input);
      assert.strictEqual(result.timeoutAutoAction, "continue_readonly");
    });

    it("should read approverGroups from context when not provided", () => {
      const service = new ApprovalService(mockDb as any, mockStore as any, mockRepository as any, mockDirectiveSink as any);

      const input = {
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "low" as const,
        options: ["yes", "no"] as const,
        context: { approverGroups: ["group-a", "group-b"] },
        timeoutPolicy: "remain_pending" as const,
      };

      const result = service.createRequest(input);
      assert.deepStrictEqual(result.approverGroups, ["group-a", "group-b"]);
    });

    it("should include escalation chain from context", () => {
      const service = new ApprovalService(mockDb as any, mockStore as any, mockRepository as any, mockDirectiveSink as any);

      const input = {
        taskId: "task-123",
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "critical" as const,
        options: ["yes", "no"] as const,
        context: {
          escalation_chain: [
            {
              level: 1,
              reviewerType: "role",
              reviewerRef: "manager",
              timeoutMs: 3600000,
              onTimeout: "escalate",
            },
          ],
        },
        timeoutPolicy: "reject" as const,
      };

      const result = service.createRequest(input);
      assert.strictEqual(result.escalationChain?.length, 1);
      assert.strictEqual(result.escalationChain?.[0]?.level, 1);
    });
  });

  describe("ApprovalService.applyDecision", () => {
    beforeEach(() => {
      mockRepository.getApproval.mock.reset();
      mockRepository.updateApprovalDecisionCas.mock.reset();
      mockRepository.insertEvent.mock.reset();
      mockDirectiveSink.emitDecisionDirective.mock.reset();
    });

    it("should apply approved decision and emit directive", () => {
      const service = new ApprovalService(mockDb as any, mockStore as any, mockRepository as any, mockDirectiveSink as any);

      mockRepository.getApproval.mock.mockImplementation(() => ({
        id: "approval-123",
        taskId: "task-123",
        executionId: null,
        status: "requested",
        requestJson: JSON.stringify({
          approvalId: "approval-123",
          taskId: "task-123",
          timeoutPolicy: "reject",
        }),
        responseJson: null,
      }));

      mockRepository.updateApprovalDecisionCas.mock.mockImplementation(() => 1);

      const decision = {
        approvalId: "approval-123",
        decisionType: "confirmed" as const,
        confirmed: true,
        respondedBy: "user-1",
        respondedAt: "2026-01-01T00:00:00.000Z",
      };

      const result = service.applyDecision(decision);

      assert.strictEqual(result.decisionType, "confirmed");
      assert.strictEqual(mockDirectiveSink.emitDecisionDirective.mock.callCount(), 1);
    });

    it("should apply rejected decision for cascade scenario", () => {
      const service = new ApprovalService(mockDb as any, mockStore as any, mockRepository as any, mockDirectiveSink as any);

      mockRepository.getApproval.mock.mockImplementation(() => ({
        id: "approval-123",
        taskId: "task-123",
        executionId: null,
        status: "requested",
        requestJson: JSON.stringify({
          approvalId: "approval-123",
          taskId: "task-123",
          context: { sessionId: "session-456" },
          timeoutPolicy: "reject",
        }),
        responseJson: null,
      }));

      mockRepository.listApprovalsByTask.mock.mockImplementation(() => [
        {
          id: "approval-789",
          taskId: "task-123",
          executionId: null,
          status: "requested",
          requestJson: JSON.stringify({
            approvalId: "approval-789",
            taskId: "task-123",
            context: { sessionId: "session-456" },
            timeoutPolicy: "reject",
          }),
          responseJson: null,
        },
      ]);

      mockRepository.updateApprovalDecisionCas.mock.mockImplementation(() => 1);

      const decision = {
        approvalId: "approval-123",
        decisionType: "rejected" as const,
        respondedBy: "user-1",
        respondedAt: "2026-01-01T00:00:00.000Z",
      };

      service.applyDecision(decision);

      // Should have called update for both original and cascade approvals
      assert.ok(mockRepository.updateApprovalDecisionCas.mock.callCount() >= 2);
    });

    it("should throw when approval not found", () => {
      const service = new ApprovalService(mockDb as any, mockStore as any, mockRepository as any, mockDirectiveSink as any);

      mockRepository.getApproval.mock.mockImplementation(() => null);

      const decision = {
        approvalId: "approval-nonexistent",
        decisionType: "confirmed" as const,
        confirmed: true,
        respondedBy: "user-1",
        respondedAt: "2026-01-01T00:00:00.000Z",
      };

      assert.throws(() => {
        service.applyDecision(decision);
      }, /not found/);
    });

    it("should be idempotent when approval already resolved", () => {
      const service = new ApprovalService(mockDb as any, mockStore as any, mockRepository as any, mockDirectiveSink as any);

      mockRepository.getApproval.mock.mockImplementation(() => ({
        id: "approval-123",
        taskId: "task-123",
        executionId: null,
        status: "approved",
        requestJson: JSON.stringify({
          approvalId: "approval-123",
          taskId: "task-123",
          timeoutPolicy: "reject",
        }),
        responseJson: JSON.stringify({ decisionType: "confirmed" }),
      }));

      const decision = {
        approvalId: "approval-123",
        decisionType: "confirmed" as const,
        confirmed: true,
        respondedBy: "user-1",
        respondedAt: "2026-01-01T00:00:00.000Z",
      };

      // Should not throw, should be a no-op
      const result = service.applyDecision(decision);
      assert.strictEqual(result.decisionType, "confirmed");
      // No update should happen
      assert.strictEqual(mockRepository.updateApprovalDecisionCas.mock.callCount(), 0);
    });
  });

  describe("ApprovalService.resolve", () => {
    it("should resolve with approve decision", () => {
      const service = new ApprovalService(mockDb as any, mockStore as any, mockRepository as any, mockDirectiveSink as any);

      mockRepository.getApproval.mock.mockImplementation(() => ({
        id: "approval-123",
        taskId: "task-123",
        executionId: null,
        status: "approved",
        requestJson: JSON.stringify({
          approvalId: "approval-123",
          taskId: "task-123",
          timeoutPolicy: "reject",
        }),
        responseJson: JSON.stringify({ decisionType: "confirmed" }),
      }));

      mockRepository.updateApprovalDecisionCas.mock.mockImplementation(() => 1);

      const result = service.resolve({
        approvalId: "approval-123",
        decision: "approve",
        resolvedBy: "user-1",
        resolutionReason: "Looks good",
      });

      assert.strictEqual(result.resolutionReason, "Looks good");
    });
  });
});