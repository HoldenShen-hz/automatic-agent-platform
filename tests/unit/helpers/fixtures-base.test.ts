/**
 * Unit tests for tests/helpers/fixtures/base.ts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createMinimalTask,
  createMinimalExecution,
  createMinimalApproval,
  createMinimalHarnessRun,
  createMinimalPlanNode,
  createMinimalPlanEdge,
  createMinimalPlanGraphBundle,
  createMinimalNodeRun,
  createMinimalBudgetLedger,
  createMinimalBudgetReservation,
} from "../../helpers/fixtures/base.js";

describe("fixtures/base", () => {
  describe("createMinimalTask", () => {
    it("should create a task with required fields", () => {
      const task = createMinimalTask();
      assert.strictEqual(task.id, "task-test-001");
      assert.strictEqual(task.parentId, null);
      assert.strictEqual(task.rootId, "task-test-001");
      assert.strictEqual(task.divisionId, "general_ops");
      assert.strictEqual(task.tenantId, null);
      assert.strictEqual(task.title, "Test task");
      assert.strictEqual(task.status, "queued");
      assert.strictEqual(task.source, "user");
      assert.strictEqual(task.priority, "normal");
      assert.strictEqual(task.inputJson, "{}");
    });

    it("should use provided overrides", () => {
      const task = createMinimalTask({
        id: "custom-id",
        title: "Custom title",
        status: "in_progress",
      });
      assert.strictEqual(task.id, "custom-id");
      assert.strictEqual(task.title, "Custom title");
      assert.strictEqual(task.status, "in_progress");
      // Other defaults should still be set
      assert.strictEqual(task.divisionId, "general_ops");
    });

    it("should preserve non-overridden defaults", () => {
      const task = createMinimalTask({ status: "done" });
      assert.strictEqual(task.status, "done");
      assert.strictEqual(task.source, "user");
      assert.strictEqual(task.priority, "normal");
    });
  });

  describe("createMinimalExecution", () => {
    it("should create an execution with required fields", () => {
      const exec = createMinimalExecution("task-123");
      assert.strictEqual(exec.id, "exec-test-001");
      assert.strictEqual(exec.taskId, "task-123");
      assert.strictEqual(exec.workflowId, "single_agent_minimal");
      assert.strictEqual(exec.status, "executing");
      assert.strictEqual(exec.agentId, "agent-test-001");
      assert.strictEqual(exec.roleId, "general_executor");
      assert.strictEqual(exec.attempt, 1);
      assert.strictEqual(exec.timeoutMs, 60000);
    });

    it("should use provided taskId in overrides", () => {
      const exec = createMinimalExecution("task-456", {
        taskId: "task-789",
      });
      assert.strictEqual(exec.taskId, "task-789");
    });

    it("should apply status override", () => {
      const exec = createMinimalExecution("task-123", { status: "succeeded" });
      assert.strictEqual(exec.status, "succeeded");
    });
  });

  describe("createMinimalApproval", () => {
    it("should create an approval with required fields", () => {
      const approval = createMinimalApproval();
      assert.strictEqual(approval.id, "approval-test-001");
      assert.strictEqual(approval.taskId, "task-test-001");
      assert.strictEqual(approval.status, "requested");
      assert.strictEqual(approval.timeoutPolicy, "remain_pending");
    });

    it("should use provided overrides", () => {
      const approval = createMinimalApproval({
        id: "custom-approval",
        status: "approved",
      });
      assert.strictEqual(approval.id, "custom-approval");
      assert.strictEqual(approval.status, "approved");
    });
  });

  describe("createMinimalHarnessRun", () => {
    it("should create a harness run with required fields", () => {
      const hrun = createMinimalHarnessRun();
      assert.strictEqual(hrun.harnessRunId, "hrun-test-001");
      assert.strictEqual(hrun.tenantId, "tenant-test-001");
      assert.strictEqual(hrun.status, "created");
      assert.strictEqual(hrun.currentSeq, 0);
    });

    it("should use provided overrides", () => {
      const hrun = createMinimalHarnessRun({
        harnessRunId: "custom-hrun",
        status: "running",
      });
      assert.strictEqual(hrun.harnessRunId, "custom-hrun");
      assert.strictEqual(hrun.status, "running");
    });
  });

  describe("createMinimalPlanNode", () => {
    it("should create a plan node with required fields", () => {
      const node = createMinimalPlanNode("node-1");
      assert.strictEqual(node.nodeId, "node-1");
      assert.strictEqual(node.nodeType, "tool");
      assert.deepStrictEqual(node.inputRefs, []);
      assert.strictEqual(node.timeoutMs, 30000);
      assert.strictEqual(node.riskClass, "low");
    });

    it("should use provided overrides", () => {
      const node = createMinimalPlanNode("node-2", {
        nodeType: "llm",
        timeoutMs: 60000,
      });
      assert.strictEqual(node.nodeId, "node-2");
      assert.strictEqual(node.nodeType, "llm");
      assert.strictEqual(node.timeoutMs, 60000);
    });
  });

  describe("createMinimalPlanEdge", () => {
    it("should create a plan edge with required fields", () => {
      const edge = createMinimalPlanEdge("edge-1", "node-a", "node-b");
      assert.strictEqual(edge.edgeId, "edge-1");
      assert.strictEqual(edge.fromNodeId, "node-a");
      assert.strictEqual(edge.toNodeId, "node-b");
      assert.strictEqual(edge.condition, true);
      assert.strictEqual(edge.dependencyType, "hard");
    });

    it("should use provided overrides", () => {
      const edge = createMinimalPlanEdge("edge-2", "node-x", "node-y", {
        condition: false,
        dependencyType: "soft",
      });
      assert.strictEqual(edge.condition, false);
      assert.strictEqual(edge.dependencyType, "soft");
    });
  });

  describe("createMinimalPlanGraphBundle", () => {
    it("should create a plan graph bundle with required fields", () => {
      const bundle = createMinimalPlanGraphBundle("hrun-1");
      assert.strictEqual(bundle.harnessRunId, "hrun-1");
      assert.strictEqual(bundle.graphVersion, 1);
      assert.strictEqual(bundle.graph.entryNodeIds.length, 1);
      assert.strictEqual(bundle.graph.terminalNodeIds.length, 1);
    });

    it("should include init and process nodes by default", () => {
      const bundle = createMinimalPlanGraphBundle("hrun-1");
      assert.strictEqual(bundle.graph.nodes.length, 2);
      assert.strictEqual(bundle.graph.edges.length, 1);
    });

    it("should use provided overrides", () => {
      const bundle = createMinimalPlanGraphBundle("hrun-2", {
        planGraphBundleId: "custom-bundle",
      });
      assert.strictEqual(bundle.planGraphBundleId, "custom-bundle");
    });
  });

  describe("createMinimalNodeRun", () => {
    it("should create a node run with required fields", () => {
      const nrun = createMinimalNodeRun("hrun-1", "bundle-1");
      assert.strictEqual(nrun.harnessRunId, "hrun-1");
      assert.strictEqual(nrun.planGraphBundleId, "bundle-1");
      assert.strictEqual(nrun.status, "created");
      assert.strictEqual(nrun.attemptCount, 0);
      assert.strictEqual(nrun.currentSeq, 0);
    });

    it("should use provided overrides", () => {
      const nrun = createMinimalNodeRun("hrun-2", "bundle-2", {
        nodeId: "custom-node",
        status: "running",
      });
      assert.strictEqual(nrun.nodeId, "custom-node");
      assert.strictEqual(nrun.status, "running");
    });
  });

  describe("createMinimalBudgetLedger", () => {
    it("should create a budget ledger with required fields", () => {
      const ledger = createMinimalBudgetLedger("hrun-1");
      assert.strictEqual(ledger.harnessRunId, "hrun-1");
      assert.strictEqual(ledger.currency, "USD");
      assert.strictEqual(ledger.hardCap, 1000);
      assert.strictEqual(ledger.reservedAmount, 0);
      assert.strictEqual(ledger.status, "open");
    });

    it("should use provided overrides", () => {
      const ledger = createMinimalBudgetLedger("hrun-2", {
        hardCap: 5000,
        reservedAmount: 100,
      });
      assert.strictEqual(ledger.hardCap, 5000);
      assert.strictEqual(ledger.reservedAmount, 100);
    });
  });

  describe("createMinimalBudgetReservation", () => {
    it("should create a budget reservation with required fields", () => {
      const res = createMinimalBudgetReservation("ledger-1", "hrun-1");
      assert.strictEqual(res.budgetLedgerId, "ledger-1");
      assert.strictEqual(res.harnessRunId, "hrun-1");
      assert.strictEqual(res.amount, 100);
      assert.strictEqual(res.resourceKind, "token");
      assert.strictEqual(res.status, "reserved");
    });

    it("should use provided overrides", () => {
      const res = createMinimalBudgetReservation("ledger-2", "hrun-2", {
        amount: 500,
        resourceKind: "compute",
      });
      assert.strictEqual(res.amount, 500);
      assert.strictEqual(res.resourceKind, "compute");
    });

    it("should set expiresAt in the future", () => {
      const before = Date.now();
      const res = createMinimalBudgetReservation("ledger-1", "hrun-1");
      const after = Date.now();
      const expiresAt = new Date(res.expiresAt).getTime();
      assert.ok(expiresAt > before);
      assert.ok(expiresAt > after - 3600000); // within 1 hour
    });
  });
});
