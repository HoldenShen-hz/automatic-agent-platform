/**
 * Unit tests for base fixtures
 */

import assert from "node:assert/strict";
import test from "node:test";

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

test("createMinimalTask creates valid task with defaults", () => {
  const task = createMinimalTask();

  assert.equal(task.id, "task-test-001");
  assert.equal(task.status, "queued");
  assert.equal(task.title, "Test task");
  assert.strictEqual(task.parentId, null);
  assert.strictEqual(task.completedAt, null);
});

test("createMinimalTask applies overrides", () => {
  const task = createMinimalTask({
    id: "custom-id",
    status: "done",
    title: "Custom title",
  });

  assert.equal(task.id, "custom-id");
  assert.equal(task.status, "done");
  assert.equal(task.title, "Custom title");
});

test("createMinimalExecution creates valid execution", () => {
  const exec = createMinimalExecution("task-123");

  assert.equal(exec.id, "exec-test-001");
  assert.equal(exec.taskId, "task-123");
  assert.equal(exec.status, "running");
  assert.strictEqual(exec.finishedAt, null);
});

test("createMinimalExecution applies overrides", () => {
  const exec = createMinimalExecution("task-123", {
    id: "custom-exec",
    status: "succeeded",
  });

  assert.equal(exec.id, "custom-exec");
  assert.equal(exec.status, "succeeded");
});

test("createMinimalApproval creates valid approval", () => {
  const approval = createMinimalApproval();

  assert.equal(approval.id, "approval-test-001");
  assert.equal(approval.status, "requested");
  assert.strictEqual(approval.responseJson, null);
});

test("createMinimalApproval applies overrides", () => {
  const approval = createMinimalApproval({
    id: "custom-approval",
    status: "approved",
  });

  assert.equal(approval.id, "custom-approval");
  assert.equal(approval.status, "approved");
});

test("createMinimalHarnessRun creates valid harness run", () => {
  const hrun = createMinimalHarnessRun();

  assert.ok(hrun.harnessRunId.startsWith("hrun-"));
  assert.equal(hrun.status, "created");
  assert.ok(hrun.budgetLedgerId.startsWith("bledger-"));
});

test("createMinimalHarnessRun applies overrides", () => {
  const hrun = createMinimalHarnessRun({
    tenantId: "tenant-custom",
    status: "planning",
  });

  assert.equal(hrun.tenantId, "tenant-custom");
  assert.equal(hrun.status, "planning");
});

test("createMinimalPlanNode creates valid plan node", () => {
  const node = createMinimalPlanNode("node-1");

  assert.equal(node.nodeId, "node-1");
  assert.equal(node.nodeType, "tool");
  assert.equal(node.riskClass, "low");
  assert.ok(node.timeoutMs > 0);
});

test("createMinimalPlanNode applies overrides", () => {
  const node = createMinimalPlanNode("node-1", {
    nodeType: "llm",
    riskClass: "high",
  });

  assert.equal(node.nodeType, "llm");
  assert.equal(node.riskClass, "high");
});

test("createMinimalPlanEdge creates valid plan edge", () => {
  const edge = createMinimalPlanEdge("edge-1", "from-node", "to-node");

  assert.equal(edge.edgeId, "edge-1");
  assert.equal(edge.fromNodeId, "from-node");
  assert.equal(edge.toNodeId, "to-node");
  assert.equal(edge.dependencyType, "hard");
});

test("createMinimalPlanEdge applies overrides", () => {
  const edge = createMinimalPlanEdge("edge-1", "from", "to", {
    dependencyType: "soft",
    condition: false,
  });

  assert.equal(edge.dependencyType, "soft");
  assert.strictEqual(edge.condition, false);
});

test("createMinimalPlanGraphBundle creates valid bundle", () => {
  const bundle = createMinimalPlanGraphBundle("hrun-1");

  assert.ok(bundle.planGraphBundleId.startsWith("pgb-"));
  assert.equal(bundle.harnessRunId, "hrun-1");
  assert.ok(Array.isArray(bundle.graph.nodes));
  assert.ok(Array.isArray(bundle.graph.edges));
  assert.ok(bundle.graph.entryNodeIds.length > 0);
});

test("createMinimalPlanGraphBundle applies overrides", () => {
  const bundle = createMinimalPlanGraphBundle("hrun-1", {
    planGraphBundleId: "custom-bundle",
  });

  assert.equal(bundle.planGraphBundleId, "custom-bundle");
});

test("createMinimalNodeRun creates valid node run", () => {
  const nrun = createMinimalNodeRun("hrun-1", "pgb-1");

  assert.ok(nrun.nodeRunId.startsWith("nrun-"));
  assert.equal(nrun.harnessRunId, "hrun-1");
  assert.equal(nrun.planGraphBundleId, "pgb-1");
  assert.equal(nrun.status, "created");
});

test("createMinimalNodeRun applies overrides", () => {
  const nrun = createMinimalNodeRun("hrun-1", "pgb-1", {
    status: "running",
    nodeId: "custom-node",
  });

  assert.equal(nrun.status, "running");
  assert.equal(nrun.nodeId, "custom-node");
});

test("createMinimalBudgetLedger creates valid ledger", () => {
  const ledger = createMinimalBudgetLedger("hrun-1");

  assert.ok(ledger.budgetLedgerId.startsWith("bledger-"));
  assert.equal(ledger.harnessRunId, "hrun-1");
  assert.equal(ledger.status, "open");
  assert.ok(ledger.hardCap > 0);
});

test("createMinimalBudgetLedger applies overrides", () => {
  const ledger = createMinimalBudgetLedger("hrun-1", {
    hardCap: 5000,
    currency: "EUR",
  });

  assert.equal(ledger.hardCap, 5000);
  assert.equal(ledger.currency, "EUR");
});

test("createMinimalBudgetReservation creates valid reservation", () => {
  const res = createMinimalBudgetReservation("bledger-1", "hrun-1");

  assert.ok(res.budgetReservationId.startsWith("bresv-"));
  assert.equal(res.budgetLedgerId, "bledger-1");
  assert.equal(res.harnessRunId, "hrun-1");
  assert.equal(res.status, "reserved");
});

test("createMinimalBudgetReservation applies overrides", () => {
  const res = createMinimalBudgetReservation("bledger-1", "hrun-1", {
    amount: 500,
    status: "settled",
  });

  assert.equal(res.amount, 500);
  assert.equal(res.status, "settled");
});