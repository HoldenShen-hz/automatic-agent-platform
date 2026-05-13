/**
 * Unit tests for canonical fixtures
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createMinimalHarnessRun,
  createMinimalPlanNode,
  createMinimalPlanEdge,
  createMinimalPlanGraph,
  createMinimalPlanGraphBundle,
  createMinimalNodeRun,
  createMinimalNodeAttempt,
  createMinimalNodeAttemptReceipt,
  createMinimalBudgetLedger,
  createMinimalBudgetReservation,
  createMinimalSideEffectRecord,
  createCanonicalHarnessScenario,
  createTestPrincipal,
  createTestRiskPreview,
  createTestArtifactRef,
} from "../../helpers/fixtures/canonical.js";

test("createMinimalHarnessRun generates unique IDs by default", () => {
  const hrun1 = createMinimalHarnessRun();
  const hrun2 = createMinimalHarnessRun();

  assert.notEqual(hrun1.harnessRunId, hrun2.harnessRunId);
});

test("createMinimalHarnessRun accepts all optional fields", () => {
  const hrun = createMinimalHarnessRun({
    tenantId: "my-tenant",
    confirmedTaskSpecId: "my-ctspec",
    requestEnvelopeId: "my-env",
    requestHash: "my-hash",
    constraintPackRef: "my-constraints",
    versionLockId: "my-vlock",
    budgetLedgerId: "my-bledger",
    status: "running",
    planGraphBundleId: "my-pgb",
    currentSeq: 5,
  });

  assert.equal(hrun.tenantId, "my-tenant");
  assert.equal(hrun.confirmedTaskSpecId, "my-ctspec");
  assert.equal(hrun.status, "running");
  assert.equal(hrun.currentSeq, 5);
});

test("createMinimalPlanNode creates tool node by default", () => {
  const node = createMinimalPlanNode({ nodeId: "test-node" });

  assert.equal(node.nodeId, "test-node");
  assert.equal(node.nodeType, "tool");
  assert.equal(node.riskClass, "low");
  assert.deepEqual(node.budgetIntent.resourceKinds, ["token"]);
});

test("createMinimalPlanNode supports different node types", () => {
  const llmNode = createMinimalPlanNode({ nodeType: "llm" });
  const hitlNode = createMinimalPlanNode({ nodeType: "hitl_wait" });
  const routerNode = createMinimalPlanNode({ nodeType: "router" });

  assert.equal(llmNode.nodeType, "llm");
  assert.equal(hitlNode.nodeType, "hitl_wait");
  assert.equal(routerNode.nodeType, "router");
});

test("createMinimalPlanEdge creates hard dependency by default", () => {
  const edge = createMinimalPlanEdge({
    fromNodeId: "a",
    toNodeId: "b",
  });

  assert.equal(edge.fromNodeId, "a");
  assert.equal(edge.toNodeId, "b");
  assert.equal(edge.dependencyType, "hard");
  assert.strictEqual(edge.condition, true);
});

test("createMinimalPlanEdge supports soft dependencies", () => {
  const edge = createMinimalPlanEdge({
    fromNodeId: "a",
    toNodeId: "b",
    dependencyType: "soft",
    condition: false,
  });

  assert.equal(edge.dependencyType, "soft");
  assert.strictEqual(edge.condition, false);
});

test("createMinimalPlanGraph creates graph with entry node", () => {
  const graph = createMinimalPlanGraph();

  assert.ok(graph.graphId);
  assert.ok(graph.nodes.length > 0);
  assert.ok(graph.entryNodeIds.length > 0);
  assert.ok(graph.terminalNodeIds.length > 0);
  assert.equal(graph.joinStrategy, "all");
});

test("createMinimalPlanGraph uses provided nodes and edges", () => {
  const nodes = [
    createMinimalPlanNode({ nodeId: "node-a" }),
    createMinimalPlanNode({ nodeId: "node-b" }),
  ];
  const edges = [
    createMinimalPlanEdge({ fromNodeId: "node-a", toNodeId: "node-b" }),
  ];

  const graph = createMinimalPlanGraph({
    nodes,
    edges,
    entryNodeIds: ["node-a"],
    terminalNodeIds: ["node-b"],
  });

  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.entryNodeIds[0], "node-a");
  assert.equal(graph.terminalNodeIds[0], "node-b");
});

test("createMinimalPlanGraphBundle creates valid bundle", () => {
  const bundle = createMinimalPlanGraphBundle();

  assert.ok(bundle.planGraphBundleId);
  assert.ok(bundle.graph);
  assert.ok(bundle.schedulerPolicy);
  assert.ok(bundle.riskProfile);
  assert.ok(bundle.validationReport);
});

test("createMinimalPlanGraphBundle throws when graph has no entry node", () => {
  assert.throws(
    () => createMinimalPlanGraphBundle({
      graph: createMinimalPlanGraph({ entryNodeIds: [] }),
    }),
    /entry node/,
  );
});

test("createMinimalNodeRun creates node run with defaults", () => {
  const nrun = createMinimalNodeRun({
    harnessRunId: "hrun-1",
    planGraphBundleId: "pgb-1",
    nodeId: "node-1",
  });

  assert.ok(nrun.nodeRunId);
  assert.equal(nrun.harnessRunId, "hrun-1");
  assert.equal(nrun.planGraphBundleId, "pgb-1");
  assert.equal(nrun.status, "created");
  assert.equal(nrun.attemptCount, 0);
});

test("createMinimalNodeRun supports optional lease and fencing token", () => {
  const nrun = createMinimalNodeRun({
    harnessRunId: "hrun-1",
    planGraphBundleId: "pgb-1",
    nodeId: "node-1",
    leaseId: "lease-1",
    fencingToken: "fence-1",
  });

  assert.equal(nrun.leaseId, "lease-1");
  assert.equal(nrun.fencingToken, "fence-1");
});

test("createMinimalNodeAttempt creates attempt with defaults", () => {
  const attempt = createMinimalNodeAttempt({ nodeRunId: "nrun-1" });

  assert.ok(attempt.nodeAttemptId);
  assert.equal(attempt.nodeRunId, "nrun-1");
  assert.equal(attempt.attemptNo, 1);
  assert.equal(attempt.attemptKind, "initial");
});

test("createMinimalNodeAttempt supports different attempt kinds", () => {
  const retry = createMinimalNodeAttempt({ attemptKind: "retry" });
  const redrive = createMinimalNodeAttempt({ attemptKind: "redrive" });
  const recovery = createMinimalNodeAttempt({ attemptKind: "recovery" });

  assert.equal(retry.attemptKind, "retry");
  assert.equal(redrive.attemptKind, "redrive");
  assert.equal(recovery.attemptKind, "recovery");
});

test("createMinimalNodeAttemptReceipt creates receipt with defaults", () => {
  const receipt = createMinimalNodeAttemptReceipt({
    harnessRunId: "hrun-1",
    planGraphId: "pgb-1",
    nodeAttemptId: "nattempt-1",
    nodeRunId: "nrun-1",
  });

  assert.ok(receipt.nodeAttemptReceiptId);
  assert.equal(receipt.status, "succeeded");
  assert.equal(receipt.duration, 100);
});

test("createMinimalNodeAttemptReceipt supports different receipt kinds", () => {
  const tool = createMinimalNodeAttemptReceipt({ receiptKind: "tool" });
  const llm = createMinimalNodeAttemptReceipt({ receiptKind: "llm" });
  const hitl = createMinimalNodeAttemptReceipt({ receiptKind: "hitl" });

  assert.equal(tool.receiptKind, "tool");
  assert.equal(llm.receiptKind, "llm");
  assert.equal(hitl.receiptKind, "hitl");
});

test("createMinimalNodeAttemptReceipt supports error states", () => {
  const receipt = createMinimalNodeAttemptReceipt({
    status: "failed",
    error: { code: "ERR_TEST", message: "Test error", retryable: true },
    errorDetail: "Stack trace here",
  });

  assert.equal(receipt.status, "failed");
  assert.equal(receipt.error?.code, "ERR_TEST");
  assert.equal(receipt.errorDetail, "Stack trace here");
});

test("createMinimalBudgetLedger creates ledger with defaults", () => {
  const ledger = createMinimalBudgetLedger({ harnessRunId: "hrun-1" });

  assert.ok(ledger.budgetLedgerId);
  assert.equal(ledger.harnessRunId, "hrun-1");
  assert.equal(ledger.currency, "USD");
  assert.equal(ledger.status, "open");
  assert.equal(ledger.version, 0);
});

test("createMinimalBudgetLedger supports different currencies", () => {
  const eur = createMinimalBudgetLedger({ currency: "EUR" });
  const gbp = createMinimalBudgetLedger({ currency: "GBP" });

  assert.equal(eur.currency, "EUR");
  assert.equal(gbp.currency, "GBP");
});

test("createMinimalBudgetLedger supports caps and tracking", () => {
  const ledger = createMinimalBudgetLedger({
    hardCap: 5000,
    softCap: 4000,
    reservedAmount: 1000,
    settledAmount: 500,
  });

  assert.equal(ledger.hardCap, 5000);
  assert.equal(ledger.softCap, 4000);
  assert.equal(ledger.reservedAmount, 1000);
  assert.equal(ledger.settledAmount, 500);
});

test("createMinimalBudgetReservation creates reservation with defaults", () => {
  const res = createMinimalBudgetReservation({
    budgetLedgerId: "bledger-1",
    harnessRunId: "hrun-1",
  });

  assert.ok(res.budgetReservationId);
  assert.equal(res.budgetLedgerId, "bledger-1");
  assert.equal(res.harnessRunId, "hrun-1");
  assert.equal(res.amount, 1000);
  assert.equal(res.resourceKind, "token");
  assert.equal(res.status, "reserved");
});

test("createMinimalBudgetReservation supports different resource kinds", () => {
  const memory = createMinimalBudgetReservation({
    budgetLedgerId: "bledger-1",
    harnessRunId: "hrun-1",
    resourceKind: "tool",
    amount: 256,
  });
  const compute = createMinimalBudgetReservation({
    budgetLedgerId: "bledger-1",
    harnessRunId: "hrun-1",
    resourceKind: "compute",
    amount: 100,
  });

  assert.equal(memory.resourceKind, "tool");
  assert.equal(compute.resourceKind, "compute");
});

test("createMinimalBudgetReservation supports different statuses", () => {
  const reserved = createMinimalBudgetReservation({
    budgetLedgerId: "bledger-1",
    harnessRunId: "hrun-1",
    status: "reserved",
  });
  const settled = createMinimalBudgetReservation({
    budgetLedgerId: "bledger-1",
    harnessRunId: "hrun-1",
    status: "settled",
  });
  const released = createMinimalBudgetReservation({
    budgetLedgerId: "bledger-1",
    harnessRunId: "hrun-1",
    status: "released",
  });
  const expired = createMinimalBudgetReservation({
    budgetLedgerId: "bledger-1",
    harnessRunId: "hrun-1",
    status: "expired",
  });

  assert.equal(reserved.status, "reserved");
  assert.equal(settled.status, "settled");
  assert.equal(released.status, "released");
  assert.equal(expired.status, "expired");
});

test("createMinimalSideEffectRecord creates side effect with defaults", () => {
  const se = createMinimalSideEffectRecord({
    harnessRunId: "hrun-1",
    nodeRunId: "nrun-1",
    nodeAttemptId: "nattempt-1",
  });

  assert.ok(se.sideEffectId);
  assert.equal(se.harnessRunId, "hrun-1");
  assert.equal(se.nodeRunId, "nrun-1");
  assert.equal(se.effectKind, "file_write");
  assert.equal(se.status, "proposed");
});

test("createCanonicalHarnessScenario creates fully wired scenario", () => {
  const scenario = createCanonicalHarnessScenario({ tenantId: "tenant-1" });

  assert.ok(scenario.harnessRun);
  assert.ok(scenario.planGraphBundle);
  assert.ok(scenario.nodeRun);
  assert.ok(scenario.nodeAttempt);
  assert.ok(scenario.nodeAttemptReceipt);
  assert.ok(scenario.budgetLedger);
  assert.ok(scenario.budgetReservation);

  // Verify IDs are consistent
  assert.equal(scenario.harnessRun.harnessRunId, scenario.planGraphBundle.harnessRunId);
  assert.equal(scenario.harnessRun.budgetLedgerId, scenario.budgetLedger.budgetLedgerId);
});

test("createCanonicalHarnessScenario uses provided tenant and risk", () => {
  const scenario = createCanonicalHarnessScenario({
    tenantId: "custom-tenant",
    riskClass: "high",
  });

  assert.equal(scenario.harnessRun.tenantId, "custom-tenant");
  assert.equal(scenario.planGraphBundle.riskProfile.riskClass, "high");
});

test("createTestPrincipal creates principal with defaults", () => {
  const principal = createTestPrincipal();

  assert.equal(principal.principalId, "principal-test-001");
  assert.equal(principal.tenantId, "tenant-test-001");
  assert.deepEqual(principal.roles, ["test_role"]);
});

test("createTestPrincipal applies overrides", () => {
  const principal = createTestPrincipal({
    principalId: "custom-principal",
    roles: ["admin", "operator"],
  });

  assert.equal(principal.principalId, "custom-principal");
  assert.deepEqual(principal.roles, ["admin", "operator"]);
});

test("createTestRiskPreview creates preview with specified risk class", () => {
  const low = createTestRiskPreview("low");
  const high = createTestRiskPreview("high");

  assert.equal(low.riskClass, "low");
  assert.equal(high.riskClass, "high");
});

test("createTestArtifactRef creates artifact ref with defaults", () => {
  const ref = createTestArtifactRef();

  assert.equal(ref.artifactId, "artifact-test-001");
  assert.ok(ref.uri.startsWith("memory://"));
  assert.ok(ref.hash?.startsWith("sha256:"));
  assert.equal(ref.version, "1.0.0");
});

test("createTestArtifactRef applies overrides", () => {
  const ref = createTestArtifactRef({
    artifactId: "custom-artifact",
    uri: "file:///custom/path",
    hash: "sha256:custom",
    version: "2.0.0",
  });

  assert.equal(ref.artifactId, "custom-artifact");
  assert.equal(ref.uri, "file:///custom/path");
  assert.equal(ref.hash, "sha256:custom");
  assert.equal(ref.version, "2.0.0");
});
