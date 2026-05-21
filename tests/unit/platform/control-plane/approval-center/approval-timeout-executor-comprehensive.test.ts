/**
 * Comprehensive tests for ApprovalTimeoutExecutor
 * Source: src/platform/five-plane-control-plane/approval-center/approval-timeout-executor.ts
 */

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { nowIso } from "../../../../src/contracts/types/ids.js";

describe("ApprovalTimeoutExecutor", () => {
  let ApprovalTimeoutExecutor: any;
  let ApprovalService: any;

  const mockApprovalService = {
    applyDecision: mock.fn(() => ({ decisionType: "expired" })),
  };

  const mockStore = {
    execution: {
      getExecution: mock.fn(() => ({ status: "blocked" })),
    },
  };

  const mockApprovalRepo = {
    listApprovalsByStatus: mock.fn(() => []),
    getApproval: mock.fn(),
  };

  beforeEach(() => {
    delete require.cache[require.resolve("./approval-timeout-executor.js")];
    delete require.cache[require.resolve("./approval-timeout-executor.ts")];
    delete require.cache[require.resolve("./approval-service.js")];
    mockApprovalService.applyDecision.mock.reset();
    mockApprovalRepo.listApprovalsByStatus.mock.reset();
    mockApprovalRepo.getApproval.mock.reset();

    ApprovalService = require("./approval-service.js").ApprovalService;
    ApprovalTimeoutExecutor = require("./approval-timeout-executor.js").ApprovalTimeoutExecutor;
  });

  describe("constructor", () => {
    it("should accept ApprovalService instance", () => {
      const executor = new ApprovalTimeoutExecutor(
        mockApprovalService as any,
        mockStore as any,
        mockApprovalRepo as any,
      );

      assert.ok(executor);
    });

    it("should accept AuthoritativeSqlDatabase for legacy construction", () => {
      const mockDb = {
        connection: {},
        transaction: mock.fn((fn) => fn()),
      };

      const executor = new ApprovalTimeoutExecutor(
        mockDb as any,
        mockStore as any,
        { defaultTimeoutMs: 3600000 },
      );

      assert.ok(executor);
    });
  });

  describe("sweep", () => {
    it("should return zero counts when no pending approvals", () => {
      mockApprovalRepo.listApprovalsByStatus.mock.mockImplementation(() => []);

      const executor = new ApprovalTimeoutExecutor(
        mockApprovalService as any,
        mockStore as any,
        mockApprovalRepo as any,
      );

      const result = executor.sweep();

      assert.strictEqual(result.processed, 0);
      assert.strictEqual(result.rejected, 0);
      assert.strictEqual(result.approved, 0);
      assert.strictEqual(result.skipped, 0);
      assert.strictEqual(result.errors, 0);
    });

    it("should skip non-expired approvals", () => {
      mockApprovalRepo.listApprovalsByStatus.mock.mockImplementation(() => [
        {
          id: "approval-123",
          taskId: "task-123",
          executionId: null,
          status: "requested",
          requestJson: JSON.stringify({ approvalId: "approval-123" }),
          responseJson: null,
          timeoutPolicy: "reject",
          createdAt: nowIso(), // Just created, not expired
          respondedAt: null,
        },
      ]);

      const executor = new ApprovalTimeoutExecutor(
        mockApprovalService as any,
        mockStore as any,
        mockApprovalRepo as any,
      );

      const result = executor.sweep();

      assert.strictEqual(result.processed, 1);
      assert.strictEqual(result.skipped, 1);
      assert.strictEqual(result.rejected, 0);
    });

    it("should reject expired approval with reject policy", () => {
      const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48 hours ago

      mockApprovalRepo.listApprovalsByStatus.mock.mockImplementation(() => [
        {
          id: "approval-123",
          taskId: "task-123",
          executionId: null,
          status: "requested",
          requestJson: JSON.stringify({ approvalId: "approval-123" }),
          responseJson: null,
          timeoutPolicy: "reject",
          createdAt: oldTime,
          respondedAt: null,
        },
      ]);

      const executor = new ApprovalTimeoutExecutor(
        mockApprovalService as any,
        mockStore as any,
        mockApprovalRepo as any,
      );

      const result = executor.sweep();

      assert.strictEqual(result.processed, 1);
      assert.strictEqual(result.rejected, 1);
      assert.strictEqual(mockApprovalService.applyDecision.mock.callCount(), 1);
    });

    it("should approve expired approval with approve policy", () => {
      const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      mockApprovalRepo.listApprovalsByStatus.mock.mockImplementation(() => [
        {
          id: "approval-123",
          taskId: "task-123",
          executionId: null,
          status: "requested",
          requestJson: JSON.stringify({ approvalId: "approval-123" }),
          responseJson: null,
          timeoutPolicy: "approve",
          createdAt: oldTime,
          respondedAt: null,
        },
      ]);

      const executor = new ApprovalTimeoutExecutor(
        mockApprovalService as any,
        mockStore as any,
        mockApprovalRepo as any,
      );

      const result = executor.sweep();

      assert.strictEqual(result.processed, 1);
      assert.strictEqual(result.approved, 1);
      assert.strictEqual(mockApprovalService.applyDecision.mock.callCount(), 1);
    });

    it("should skip expired approval with remain_pending policy", () => {
      const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      mockApprovalRepo.listApprovalsByStatus.mock.mockImplementation(() => [
        {
          id: "approval-123",
          taskId: "task-123",
          executionId: null,
          status: "requested",
          requestJson: JSON.stringify({ approvalId: "approval-123" }),
          responseJson: null,
          timeoutPolicy: "remain_pending",
          createdAt: oldTime,
          respondedAt: null,
        },
      ]);

      const executor = new ApprovalTimeoutExecutor(
        mockApprovalService as any,
        mockStore as any,
        mockApprovalRepo as any,
      );

      const result = executor.sweep();

      assert.strictEqual(result.processed, 1);
      assert.strictEqual(result.skipped, 1);
      assert.strictEqual(mockApprovalService.applyDecision.mock.callCount(), 0);
    });

    it("should count errors when applyDecision throws", () => {
      const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      mockApprovalRepo.listApprovalsByStatus.mock.mockImplementation(() => [
        {
          id: "approval-123",
          taskId: "task-123",
          executionId: null,
          status: "requested",
          requestJson: JSON.stringify({ approvalId: "approval-123" }),
          responseJson: null,
          timeoutPolicy: "reject",
          createdAt: oldTime,
          respondedAt: null,
        },
      ]);

      mockApprovalService.applyDecision.mock.mockImplementation(() => {
        throw new Error("Database error");
      });

      const executor = new ApprovalTimeoutExecutor(
        mockApprovalService as any,
        mockStore as any,
        mockApprovalRepo as any,
      );

      const result = executor.sweep();

      assert.strictEqual(result.errors, 1);
    });
  });

  describe("executeTimeout", () => {
    it("should reject approval with reject policy", () => {
      mockApprovalRepo.getApproval.mock.mockImplementation(() => ({
        id: "approval-123",
        taskId: "task-123",
        executionId: null,
        status: "requested",
        requestJson: JSON.stringify({ approvalId: "approval-123" }),
        responseJson: null,
        timeoutPolicy: "reject",
        createdAt: nowIso(),
        respondedAt: null,
      }));

      const executor = new ApprovalTimeoutExecutor(
        mockApprovalService as any,
        mockStore as any,
        mockApprovalRepo as any,
      );

      const result = executor.executeTimeout({ approvalId: "approval-123" });

      assert.strictEqual(result.status, "rejected");
      assert.strictEqual(result.decisionType, "expired");
    });

    it("should approve approval with approve policy", () => {
      mockApprovalRepo.getApproval.mock.mockImplementation(() => ({
        id: "approval-123",
        taskId: "task-123",
        executionId: null,
        status: "requested",
        requestJson: JSON.stringify({ approvalId: "approval-123" }),
        responseJson: null,
        timeoutPolicy: "approve",
        createdAt: nowIso(),
        respondedAt: null,
      }));

      const executor = new ApprovalTimeoutExecutor(
        mockApprovalService as any,
        mockStore as any,
        mockApprovalRepo as any,
      );

      const result = executor.executeTimeout({ approvalId: "approval-123" });

      assert.strictEqual(result.status, "approved");
    });

    it("should remain pending with remain_pending policy", () => {
      mockApprovalRepo.getApproval.mock.mockImplementation(() => ({
        id: "approval-123",
        taskId: "task-123",
        executionId: null,
        status: "requested",
        requestJson: JSON.stringify({ approvalId: "approval-123" }),
        responseJson: null,
        timeoutPolicy: "remain_pending",
        createdAt: nowIso(),
        respondedAt: null,
      }));

      const executor = new ApprovalTimeoutExecutor(
        mockApprovalService as any,
        mockStore as any,
        mockApprovalRepo as any,
      );

      const result = executor.executeTimeout({ approvalId: "approval-123" });

      assert.strictEqual(result.status, "requested");
    });

    it("should throw when approval not found", () => {
      mockApprovalRepo.getApproval.mock.mockImplementation(() => null);

      const executor = new ApprovalTimeoutExecutor(
        mockApprovalService as any,
        mockStore as any,
        mockApprovalRepo as any,
      );

      assert.throws(() => {
        executor.executeTimeout({ approvalId: "nonexistent" });
      }, /not found/);
    });

    it("should throw for unsupported policy", () => {
      mockApprovalRepo.getApproval.mock.mockImplementation(() => ({
        id: "approval-123",
        taskId: "task-123",
        executionId: null,
        status: "requested",
        requestJson: JSON.stringify({ approvalId: "approval-123" }),
        responseJson: null,
        timeoutPolicy: "invalid_policy",
        createdAt: nowIso(),
        respondedAt: null,
      }));

      const executor = new ApprovalTimeoutExecutor(
        mockApprovalService as any,
        mockStore as any,
        mockApprovalRepo as any,
      );

      assert.throws(() => {
        executor.executeTimeout({ approvalId: "approval-123" });
      }, /unsupported policy/);
    });
  });

  describe("isExpired", () => {
    it("should return false for already responded approval", () => {
      const executor = new ApprovalTimeoutExecutor(
        mockApprovalService as any,
        mockStore as any,
        mockApprovalRepo as any,
      );

      const approval = {
        id: "approval-123",
        taskId: "task-123",
        executionId: null,
        status: "requested",
        requestJson: "{}",
        responseJson: JSON.stringify({ decisionType: "confirmed" }),
        timeoutPolicy: "reject",
        createdAt: nowIso(),
        respondedAt: nowIso(),
      };

      const result = executor.isExpired(approval, nowIso());

      assert.strictEqual(result, false);
    });

    it("should use timeoutAt when available", () => {
      const executor = new ApprovalTimeoutExecutor(
        mockApprovalService as any,
        mockStore as any,
        mockApprovalRepo as any,
      );

      const pastTime = new Date(Date.now() - 3600000).toISOString();
      const currentTime = nowIso();

      const approval = {
        id: "approval-123",
        taskId: "task-123",
        executionId: null,
        status: "requested",
        requestJson: "{}",
        responseJson: null,
        timeoutPolicy: "reject",
        createdAt: pastTime,
        respondedAt: null,
        timeoutAt: pastTime, // Already expired
      };

      const result = executor.isExpired(approval, currentTime);

      assert.strictEqual(result, true);
    });

    it("should compute expiration from createdAt when timeoutAt not available", () => {
      const executor = new ApprovalTimeoutExecutor(
        mockApprovalService as any,
        mockStore as any,
        mockApprovalRepo as any,
        { defaultTimeoutMs: 3600000 }, // 1 hour
      );

      const oldTime = new Date(Date.now() - 2 * 3600000).toISOString(); // 2 hours ago
      const currentTime = nowIso();

      const approval = {
        id: "approval-123",
        taskId: "task-123",
        executionId: null,
        status: "requested",
        requestJson: "{}",
        responseJson: null,
        timeoutPolicy: "reject",
        createdAt: oldTime,
        respondedAt: null,
      };

      const result = executor.isExpired(approval, currentTime);

      assert.strictEqual(result, true);
    });

    it("should not be expired if within timeout window", () => {
      const executor = new ApprovalTimeoutExecutor(
        mockApprovalService as any,
        mockStore as any,
        mockApprovalRepo as any,
        { defaultTimeoutMs: 3600000 }, // 1 hour
      );

      const recentTime = new Date(Date.now() - 1800000).toISOString(); // 30 minutes ago
      const currentTime = nowIso();

      const approval = {
        id: "approval-123",
        taskId: "task-123",
        executionId: null,
        status: "requested",
        requestJson: "{}",
        responseJson: null,
        timeoutPolicy: "reject",
        createdAt: recentTime,
        respondedAt: null,
      };

      const result = executor.isExpired(approval, currentTime);

      assert.strictEqual(result, false);
    });
  });

  describe("getTimeoutForPolicy", () => {
    it("should return default timeout when not overridden", () => {
      const executor = new ApprovalTimeoutExecutor(
        mockApprovalService as any,
        mockStore as any,
        mockApprovalRepo as any,
        { defaultTimeoutMs: 7200000 },
      );

      const result = executor.getTimeoutForPolicy("reject");

      assert.strictEqual(result, 7200000);
    });
  });
});