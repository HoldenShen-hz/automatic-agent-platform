/**
 * Comprehensive tests for MultiPartyApprovalService
 * Source: src/platform/five-plane-control-plane/approval-center/multi-party-approval-service.ts
 */

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import assert from "node:assert";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

import { MultiPartyApprovalService } from "../../../../../src/platform/five-plane-control-plane/approval-center/multi-party-approval-service.js";

describe("MultiPartyApprovalService", () => {

  const mockRepository = {
    insertApproval: mock.fn((() => undefined) as any),
    insertEvent: mock.fn((() => undefined) as any),
    getApproval: mock.fn((() => undefined) as any),
    updateApprovalDecisionCas: mock.fn((() => 0) as any),
    updateApprovalRequest: mock.fn((() => undefined) as any),
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

  beforeEach(() => {
    mockRepository.insertApproval.mock.resetCalls();
    mockRepository.insertEvent.mock.resetCalls();
    mockRepository.getApproval.mock.resetCalls();
    mockRepository.updateApprovalDecisionCas.mock.resetCalls();
    mockRepository.updateApprovalRequest.mock.resetCalls();
  });

  describe("createMultiPartyRequest", () => {
    it("should create multi-party request with default required approvals", () => {
      const service = new MultiPartyApprovalService(mockDb as any, mockStore as any, mockRepository as any);

      const request = {
        taskId: "task-123",
        executionId: null,
        sourceAgentId: "agent-1",
        reason: "Need multi-party approval",
        riskLevel: "high" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
      };

      const result = service.createMultiPartyRequest(request);

      assert.ok(result.approvalId);
      assert.strictEqual(result.requiredApprovals, 1);
      assert.deepStrictEqual(result.approverGroups, []);
      assert.strictEqual(result.approvalsReceived, 0);
    });

    it("should create request with custom required approvals", () => {
      const service = new MultiPartyApprovalService(mockDb as any, mockStore as any, mockRepository as any);

      const request = {
        taskId: "task-123",
        executionId: null,
        sourceAgentId: "agent-1",
        reason: "Need multi-party approval",
        riskLevel: "critical" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
      };

      const result = service.createMultiPartyRequest(request, {
        requiredApprovals: 3,
        approverGroups: ["group-a", "group-b"],
      });

      assert.strictEqual(result.requiredApprovals, 3);
      assert.deepStrictEqual(result.approverGroups, ["group-a", "group-b"]);
    });

    it("should track pending approval in memory", () => {
      const service = new MultiPartyApprovalService(mockDb as any, mockStore as any, mockRepository as any);

      const request = {
        taskId: "task-123",
        executionId: null,
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "medium" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "approve" as const,
      };

      const result = service.createMultiPartyRequest(request, {
        requiredApprovals: 2,
      });

      const pending = service.getPendingApproval(result.approvalId);
      assert.ok(pending);
      assert.strictEqual(pending.requiredApprovals, 2);
      assert.strictEqual(pending.approvalsReceived, 0);
    });
  });

  describe("applyDecision", () => {
    it("should apply confirmed decision and increment approval count", () => {
      const service = new MultiPartyApprovalService(mockDb as any, mockStore as any, mockRepository as any);

      // Create a multi-party request first
      const request = {
        taskId: "task-123",
        executionId: null,
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "high" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
      };

      const created = service.createMultiPartyRequest(request, { requiredApprovals: 2 });

      mockRepository.getApproval.mock.mockImplementation(() => ({
        id: created.approvalId,
        taskId: "task-123",
        executionId: null,
        status: "requested",
        requestJson: JSON.stringify({
          ...request,
          approvalId: created.approvalId,
          requiredApprovals: 2,
        }),
        responseJson: null,
      }));

      mockRepository.updateApprovalDecisionCas.mock.mockImplementation(() => 1);

      service.applyDecision({
        approvalId: created.approvalId,
        decisionType: "confirmed",
        confirmed: true,
        respondedBy: "user-1",
        respondedAt: nowIso(),
      });

      const pending = service.getPendingApproval(created.approvalId);
      assert.strictEqual(pending?.approvalsReceived, 1);
      assert.strictEqual(pending?.status, "pending");
    });

    it("should finalize when required approvals reached", () => {
      const service = new MultiPartyApprovalService(mockDb as any, mockStore as any, mockRepository as any);

      const request = {
        taskId: "task-123",
        executionId: null,
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "high" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
      };

      const created = service.createMultiPartyRequest(request, { requiredApprovals: 1 });

      mockRepository.getApproval.mock.mockImplementation(() => ({
        id: created.approvalId,
        taskId: "task-123",
        executionId: null,
        status: "requested",
        requestJson: JSON.stringify({
          ...request,
          approvalId: created.approvalId,
          requiredApprovals: 1,
        }),
        responseJson: null,
      }));

      mockRepository.updateApprovalDecisionCas.mock.mockImplementation(() => 1);

      service.applyDecision({
        approvalId: created.approvalId,
        decisionType: "confirmed",
        confirmed: true,
        respondedBy: "user-1",
        respondedAt: nowIso(),
      });

      const pending = service.getPendingApproval(created.approvalId);
      assert.strictEqual(pending?.status, "approved");
    });

    it("should reject immediately on rejected decision", () => {
      const service = new MultiPartyApprovalService(mockDb as any, mockStore as any, mockRepository as any);

      const request = {
        taskId: "task-123",
        executionId: null,
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "high" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
      };

      const created = service.createMultiPartyRequest(request);

      mockRepository.getApproval.mock.mockImplementation(() => ({
        id: created.approvalId,
        taskId: "task-123",
        executionId: null,
        status: "requested",
        requestJson: JSON.stringify({
          ...request,
          approvalId: created.approvalId,
          requiredApprovals: 2,
        }),
        responseJson: null,
      }));

      mockRepository.updateApprovalDecisionCas.mock.mockImplementation(() => 1);

      service.applyDecision({
        approvalId: created.approvalId,
        decisionType: "rejected",
        respondedBy: "user-1",
        respondedAt: nowIso(),
      });

      const pending = service.getPendingApproval(created.approvalId);
      assert.strictEqual(pending?.status, "rejected");
    });

    it("should throw when approval not found", () => {
      const service = new MultiPartyApprovalService(mockDb as any, mockStore as any, mockRepository as any);

      mockRepository.getApproval.mock.mockImplementation(() => null);

      assert.throws(() => {
        service.applyDecision({
          approvalId: "nonexistent",
          decisionType: "confirmed",
          confirmed: true,
          respondedBy: "user-1",
          respondedAt: nowIso(),
        });
      }, /not found/);
    });

    it("should be idempotent for already finalized approval", () => {
      assert.doesNotThrow(() => {
        const service = new MultiPartyApprovalService(mockDb as any, mockStore as any, mockRepository as any);

        const request = {
          taskId: "task-123",
          executionId: null,
          sourceAgentId: "agent-1",
          reason: "Need approval",
          riskLevel: "high" as const,
          options: ["yes", "no"] as const,
          context: {},
          timeoutPolicy: "reject" as const,
        };

        const created = service.createMultiPartyRequest(request);

        mockRepository.getApproval.mock.mockImplementation(() => ({
          id: created.approvalId,
          taskId: "task-123",
          executionId: null,
          status: "approved",
          requestJson: JSON.stringify({
            ...request,
            approvalId: created.approvalId,
            requiredApprovals: 2,
          }),
          responseJson: JSON.stringify({ decisionType: "confirmed" }),
        }));

        // Should not throw
        service.applyDecision({
          approvalId: created.approvalId,
          decisionType: "confirmed",
          confirmed: true,
          respondedBy: "user-1",
          respondedAt: nowIso(),
        });
      });
    });
  });

  describe("getPendingApproval", () => {
    it("should return null for non-existent approval", () => {
      const service = new MultiPartyApprovalService(mockDb as any, mockStore as any, mockRepository as any);

      const result = service.getPendingApproval("nonexistent");

      assert.strictEqual(result, null);
    });
  });

  describe("getApprovalProgress", () => {
    it("should return progress for pending approval", () => {
      const service = new MultiPartyApprovalService(mockDb as any, mockStore as any, mockRepository as any);

      const request = {
        taskId: "task-123",
        executionId: null,
        sourceAgentId: "agent-1",
        reason: "Need approval",
        riskLevel: "high" as const,
        options: ["yes", "no"] as const,
        context: {},
        timeoutPolicy: "reject" as const,
      };

      const created = service.createMultiPartyRequest(request, { requiredApprovals: 3 });

      const progress = service.getApprovalProgress(created.approvalId);

      assert.deepStrictEqual(progress, {
        received: 0,
        required: 3,
        remaining: 3,
      });
    });

    it("should return null for non-existent approval when not in memory", () => {
      const service = new MultiPartyApprovalService(mockDb as any, mockStore as any, mockRepository as any);

      mockRepository.getApproval.mock.mockImplementation(() => null);

      const result = service.getApprovalProgress("nonexistent");

      assert.strictEqual(result, null);
    });
  });

  describe("isApproverInGroups", () => {
    it("should return true when groups is empty", () => {
      const service = new MultiPartyApprovalService(mockDb as any, mockStore as any, mockRepository as any);

      const result = service.isApproverInGroups("user-1", []);

      assert.strictEqual(result, true);
    });

    it("should return true when approver is in group", () => {
      const service = new MultiPartyApprovalService(mockDb as any, mockStore as any, mockRepository as any);

      const result = service.isApproverInGroups("group-a", ["group-a", "group-b"]);

      assert.strictEqual(result, true);
    });

    it("should return false when approver is not in group", () => {
      const service = new MultiPartyApprovalService(mockDb as any, mockStore as any, mockRepository as any);

      const result = service.isApproverInGroups("user-3", ["group-a", "group-b"]);

      assert.strictEqual(result, false);
    });
  });
});
