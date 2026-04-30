/**
 * Contracts Integration Tests
 *
 * Tests the contracts module as a whole, including:
 * - Contract envelope wrapping (issue #2006)
 * - Type consistency between contract definitions
 * - Contract validation and serialization
 * - Cross-contract references and compatibility
 *
 * @see src/platform/contracts/index.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import * as contracts from "../../../../src/platform/contracts/index.js";
import {
  createContractEnvelope,
  CONTRACT_SCHEMA_VERSION,
  createNodeAttemptReceipt,
  createPlanGraphBundle,
  createGraphPatch,
  createHarnessRun,
  createNodeRun,
  type ArtifactRef,
  type BudgetIntent,
  type RiskPreview,
  type PlanGraph,
} from "../../../../src/platform/contracts/executable-contracts/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

// =============================================================================
// Contract Export Verification Tests
// =============================================================================

test("contracts-integration: exports CANONICAL_CONTRACT_NAMES", () => {
  assert.ok(contracts.CANONICAL_CONTRACT_NAMES);
  assert.ok(Array.isArray(contracts.CANONICAL_CONTRACT_NAMES));
  assert.ok(contracts.CANONICAL_CONTRACT_NAMES.length > 0);
});

test("contracts-integration: exports LEGACY_CONTRACT_NAMES", () => {
  assert.ok(contracts.LEGACY_CONTRACT_NAMES);
  assert.ok(Array.isArray(contracts.LEGACY_CONTRACT_NAMES));
});

test("contracts-integration: exports emitDeprecationWarning function", () => {
  assert.equal(typeof contracts.emitDeprecationWarning, "function");
});

test("contracts-integration: exports assertNotDeprecated function", () => {
  assert.equal(typeof contracts.assertNotDeprecated, "function");
});

test("contracts-integration: executable-contracts re-exported", () => {
  assert.ok(contracts.executableContracts);
  assert.equal(typeof contracts.executableContracts, "object");
});

// =============================================================================
// Contract Envelope Wrapping Tests (Issue #2006)
// =============================================================================

test("contracts-integration: ContractEnvelope wraps NodeAttemptReceipt", () => {
  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt_123",
    nodeRunId: "nrun_456",
    harnessRunId: "hrun_789",
    planGraphId: "pg_abc",
    graphVersion: 1,
    receiptKind: "tool",
    status: "succeeded",
    duration: 1500,
    errorDetail: "",
  });

  const envelope = createContractEnvelope({
    payload: receipt,
  });

  assert.equal(envelope.version, CONTRACT_SCHEMA_VERSION);
  assert.equal(envelope.schema, "canonical");
  assert.deepEqual(envelope.payload, receipt);
  assert.equal(envelope.signature, null);
  assert.equal(envelope.ttl, null);
});

test("contracts-integration: ContractEnvelope wraps PlanGraphBundle", () => {
  const bundle = createPlanGraphBundle({
    harnessRunId: "hrun_bundle",
    graph: createMinimalGraph(),
    schedulerPolicy: {
      policyId: "policy_test",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: "budget_ref",
    riskProfile: {
      riskClass: "low",
      reasons: [],
    },
  });

  const envelope = createContractEnvelope({
    payload: bundle,
  });

  assert.equal(envelope.schema, "canonical");
  assert.deepEqual(envelope.payload, bundle);
});

test("contracts-integration: ContractEnvelope with custom signature", () => {
  const envelope = createContractEnvelope({
    payload: { taskId: "task_123" },
    signature: "sig_verified",
  });

  assert.equal(envelope.signature, "sig_verified");
  assert.deepEqual(envelope.payload, { taskId: "task_123" });
});

test("contracts-integration: ContractEnvelope with ttl", () => {
  const envelope = createContractEnvelope({
    payload: { data: "time-sensitive" },
    ttl: 300,
  });

  assert.equal(envelope.ttl, 300);
});

test("contracts-integration: ContractEnvelope preserves nested payload structure", () => {
  const complexPayload = {
    harnessRunId: "hrun_complex",
    status: "running",
    nodes: [
      { nodeId: "node_1", status: "succeeded" },
      { nodeId: "node_2", status: "running" },
    ],
    metadata: {
      startedAt: "2026-05-01T00:00:00.000Z",
      tags: ["integration", "test"],
    },
  };

  const envelope = createContractEnvelope({
    payload: complexPayload,
  });

  assert.deepEqual(envelope.payload, complexPayload);
  assert.equal(envelope.payload.status, "running");
  assert.equal(envelope.payload.metadata.tags.length, 2);
});

// =============================================================================
// Type Consistency Tests
// =============================================================================

test("contracts-integration: PlanGraphBundle node count is consistent", () => {
  const bundle = createPlanGraphBundle({
    harnessRunId: "hrun_nodes",
    graph: {
      graphId: "graph_nodes",
      nodes: [
        createMinimalNode("node_1"),
        createMinimalNode("node_2"),
        createMinimalNode("node_3"),
      ],
      edges: [],
      entryNodeIds: ["node_1"],
      terminalNodeIds: ["node_3"],
      joinStrategy: "all",
      graphHash: "hash_123",
    },
    schedulerPolicy: {
      policyId: "policy_nodes",
      strategy: "priority_then_fifo",
    },
    budgetPlanRef: "budget_ref_nodes",
    riskProfile: {
      riskClass: "medium",
      reasons: ["multiple steps"],
    },
  });

  assert.equal(bundle.graph.nodes.length, 3);
  assert.deepEqual(bundle.graph.entryNodeIds, ["node_1"]);
  assert.deepEqual(bundle.graph.terminalNodeIds, ["node_3"]);
});

test("contracts-integration: GraphPatch operations maintain order", () => {
  const operations = [
    {
      operationId: "op_1",
      operationType: "add_node" as const,
      targetRef: "new_node",
      payload: { type: "tool" },
    },
    {
      operationId: "op_2",
      operationType: "add_edge" as const,
      targetRef: "new_edge",
      payload: { from: "node_a", to: "new_node" },
    },
    {
      operationId: "op_3",
      operationType: "disable_edge" as const,
      targetRef: "old_edge",
      payload: { reason: "replaced" },
    },
  ];

  const patch = createGraphPatch({
    harnessRunId: "hrun_ops",
    baseGraphVersion: 1,
    newGraphVersion: 2,
    operations,
    policyProofRef: { artifactId: "proof", uri: "artifact://proof" },
    auditRef: { artifactId: "audit", uri: "artifact://audit" },
  });

  assert.equal(patch.operations.length, 3);
  assert.equal(patch.operations[0].operationId, "op_1");
  assert.equal(patch.operations[1].operationId, "op_2");
  assert.equal(patch.operations[2].operationId, "op_3");
});

test("contracts-integration: BudgetIntent resource kinds are preserved", () => {
  const budgetIntent: BudgetIntent = {
    amount: 500,
    currency: "USD",
    resourceKinds: ["token", "tool", "api"],
  };

  const bundle = createPlanGraphBundle({
    harnessRunId: "hrun_budget",
    graph: {
      graphId: "graph_budget",
      nodes: [
        {
          nodeId: "node_budget",
          nodeType: "tool",
          inputRefs: [],
          outputSchemaRef: "schema_budget",
          riskClass: "medium",
          budgetIntent,
          sideEffectProfile: {
            mayCommitExternalEffect: false,
            reversible: false,
          },
          retryPolicyRef: "retry_budget",
          timeoutMs: 60000,
        },
      ],
      edges: [],
      entryNodeIds: ["node_budget"],
      terminalNodeIds: ["node_budget"],
      joinStrategy: "all",
      graphHash: "hash_budget",
    },
    schedulerPolicy: {
      policyId: "policy_budget",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: "budget_ref_amount",
    riskProfile: {
      riskClass: "medium",
      reasons: ["has budget"],
    },
  });

  assert.equal(bundle.graph.nodes[0].budgetIntent.amount, 500);
  assert.deepEqual(bundle.graph.nodes[0].budgetIntent.resourceKinds, ["token", "tool", "api"]);
});

// =============================================================================
// Contract Validation Tests
// =============================================================================

test("contracts-integration: createGraphPatch rejects invalid version progression", () => {
  assert.throws(
    () =>
      createGraphPatch({
        harnessRunId: "hrun_invalid",
        baseGraphVersion: 3,
        newGraphVersion: 2, // Should be > baseGraphVersion
        operations: [
          {
            operationId: "op_invalid",
            operationType: "add_node",
            targetRef: "node_x",
            payload: {},
          },
        ],
        policyProofRef: { artifactId: "proof", uri: "artifact://proof" },
        auditRef: { artifactId: "audit", uri: "artifact://audit" },
      }),
    ValidationError,
  );
});

test("contracts-integration: createGraphPatch requires at least one operation", () => {
  assert.throws(
    () =>
      createGraphPatch({
        harnessRunId: "hrun_empty",
        baseGraphVersion: 1,
        newGraphVersion: 2,
        operations: [],
        policyProofRef: { artifactId: "proof", uri: "artifact://proof" },
        auditRef: { artifactId: "audit", uri: "artifact://audit" },
      }),
    ValidationError,
  );
});

// =============================================================================
// Cross-Contract Reference Tests
// =============================================================================

test("contracts-integration: HarnessRun references RequestEnvelope", () => {
  const harnessRun = createHarnessRun({
    tenantId: "tenant_ref",
    confirmedTaskSpecId: "ctspec_ref",
    requestEnvelopeId: "request_ref",
    requestHash: "hash_ref",
    constraintPackRef: "cp_ref",
    versionLockId: "vlock_ref",
    budgetLedgerId: "bledger_ref",
  });

  assert.ok(harnessRun.harnessRunId.startsWith("hrun_"));
  assert.equal(harnessRun.requestEnvelopeId, "request_ref");
});

test("contracts-integration: NodeRun references PlanGraphBundle", () => {
  const nodeRun = createNodeRun({
    harnessRunId: "hrun_node",
    planGraphBundleId: "pgb_node",
    graphVersion: 1,
    nodeId: "node_test",
  });

  assert.ok(nodeRun.nodeRunId.startsWith("nrun_"));
  assert.equal(nodeRun.planGraphBundleId, "pgb_node");
  assert.equal(nodeRun.graphVersion, 1);
});

test("contracts-integration: NodeAttemptReceipt references NodeRun and HarnessRun", () => {
  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt_link",
    nodeRunId: "nrun_link",
    harnessRunId: "hrun_link",
    planGraphId: "pg_link",
    graphVersion: 2,
    receiptKind: "llm",
    status: "succeeded",
    duration: 2000,
    errorDetail: "no errors",
  });

  assert.equal(receipt.nodeRunId, "nrun_link");
  assert.equal(receipt.harnessRunId, "hrun_link");
  assert.equal(receipt.graphVersion, 2);
});

// =============================================================================
// Re-export Consistency Tests
// =============================================================================

test("contracts-integration: PlanGraphBundle re-exported from execution-plan", () => {
  // The execution-plan module re-exports PlanGraphBundle from executable-contracts
  const { createPlanGraphBundle: epCreatePlanGraphBundle, type PlanGraphBundle } = contracts;

  const bundle = epCreatePlanGraphBundle({
    harnessRunId: "hrun_reexport",
    graph: createMinimalGraph(),
    schedulerPolicy: {
      policyId: "policy_reexport",
      strategy: "risk_isolated",
    },
    budgetPlanRef: "budget_reexport",
    riskProfile: {
      riskClass: "low",
      reasons: ["reexport test"],
    },
  });

  assert.ok(bundle.planGraphBundleId.startsWith("pgb_"));
  const _unused: PlanGraphBundle | undefined = bundle; // Type check
});

test("contracts-integration: NodeAttemptReceipt re-exported from execution-receipt", () => {
  // The execution-receipt module re-exports NodeAttemptReceipt from executable-contracts
  const { createNodeAttemptReceipt: erCreateNodeAttemptReceipt, type NodeAttemptReceipt } =
    contracts;

  const receipt = erCreateNodeAttemptReceipt({
    nodeAttemptId: "nattempt_reexport",
    nodeRunId: "nrun_reexport",
    harnessRunId: "hrun_reexport",
    planGraphId: "pg_reexport",
    graphVersion: 1,
    receiptKind: "tool",
    status: "failed",
    duration: 500,
    errorDetail: "test error",
    error: {
      code: "ERR_TEST",
      message: "Test error occurred",
      retryable: true,
    },
  });

  assert.ok(receipt.nodeAttemptReceiptId.startsWith("nreceipt_"));
  const _unused: NodeAttemptReceipt | undefined = receipt; // Type check
});

// =============================================================================
// Helper Functions
// =============================================================================

function createMinimalGraph(): PlanGraph {
  return {
    graphId: "graph_minimal",
    nodes: [createMinimalNode("node_minimal")],
    edges: [],
    entryNodeIds: ["node_minimal"],
    terminalNodeIds: ["node_minimal"],
    joinStrategy: "all",
    graphHash: "hash_minimal",
  };
}

function createMinimalNode(nodeId: string) {
  return {
    nodeId,
    nodeType: "tool" as const,
    inputRefs: [],
    outputSchemaRef: "schema_minimal",
    riskClass: "low" as const,
    budgetIntent: {
      amount: 100,
      currency: "USD",
      resourceKinds: ["token"] as const,
    },
    sideEffectProfile: {
      mayCommitExternalEffect: false,
      reversible: false,
    },
    retryPolicyRef: "retry_minimal",
    timeoutMs: 30000,
  };
}