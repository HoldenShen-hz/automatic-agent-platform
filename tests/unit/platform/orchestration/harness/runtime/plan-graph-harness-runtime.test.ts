import assert from "node:assert/strict";
import test from "node:test";

import {
  createHarnessRun,
  createPlanGraphBundle,
  type BudgetIntent,
  type PlanGraph,
} from "../../../../../../src/platform/contracts/executable-contracts/index.js";
import {
  PlanGraphAnalyzer,
  PlanGraphScheduler,
  PlanGraphHarnessRuntime,
} from "../../../../../../src/platform/five-plane-orchestration/harness/runtime/plan-graph-harness-runtime.js";

const budgetIntent: BudgetIntent = {
  amount: 10,
  currency: "USD",
  resourceKinds: ["tool"],
};

const graph: PlanGraph = {
  graphId: "graph-1",
  nodes: [
    {
      nodeId: "node-a",
      nodeType: "tool",
      inputRefs: [],
      outputSchemaRef: "schema://out",
      riskClass: "low",
      budgetIntent,
      sideEffectProfile: {
        mayCommitExternalEffect: false,
        reversible: true,
      },
      retryPolicyRef: "retry://default",
      timeoutMs: 1000,
    },
    {
      nodeId: "node-b",
      nodeType: "llm",
      inputRefs: ["node-a"],
      outputSchemaRef: "schema://out",
      riskClass: "low",
      budgetIntent,
      sideEffectProfile: {
        mayCommitExternalEffect: false,
        reversible: true,
      },
      retryPolicyRef: "retry://default",
      timeoutMs: 1000,
    },
  ],
  edges: [
    {
      edgeId: "edge-a-b",
      fromNodeId: "node-a",
      toNodeId: "node-b",
      condition: {},
      dependencyType: "hard",
    },
  ],
  entryNodeIds: ["node-a"],
  terminalNodeIds: ["node-b"],
  joinStrategy: "all",
  graphHash: "hash",
};

const bundle = createPlanGraphBundle({
  planGraphBundleId: "pgb-1",
  harnessRunId: "run-1",
  graph,
  schedulerPolicy: {
    policyId: "scheduler-1",
    strategy: "deterministic_fifo",
  },
  budgetPlanRef: "budget-plan-1",
  riskProfile: { riskClass: "low", reasons: [] },
});

test("PlanGraphScheduler returns entry nodes before dependencies are complete", () => {
  const scheduler = new PlanGraphScheduler();

  const ready = scheduler.readyNodes({ planGraphBundle: bundle });

  assert.deepEqual(ready.map((node) => node.nodeId), ["node-a"]);
});

test("PlanGraphScheduler releases downstream nodes after hard dependency completes", () => {
  const scheduler = new PlanGraphScheduler();

  const ready = scheduler.readyNodes({
    planGraphBundle: bundle,
    completedNodeIds: ["node-a"],
  });

  assert.deepEqual(ready.map((node) => node.nodeId), ["node-b"]);
});

test("PlanGraphAnalyzer normalizes, validates, propagates risk, and records worst path", () => {
  const analyzer = new PlanGraphAnalyzer();

  const normalized = analyzer.normalize(bundle);

  assert.equal(normalized.validationReport.valid, true);
  assert.deepEqual(normalized.validationReport.normalizedNodeIds, ["node-a", "node-b"]);
  assert.equal(normalized.validationReport.worstPath?.estimatedBudgetAmount, 20);
  assert.equal(normalized.validationReport.worstPath?.timeoutMs, 2000);
});

test("PlanGraphHarnessRuntime executes ready node into NodeRun, NodeAttemptReceipt, and platform events", () => {
  const runtime = new PlanGraphHarnessRuntime();
  const run = createHarnessRun({
    harnessRunId: "run-1",
    tenantId: "tenant-1",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "ledger-1",
  });

  const result = runtime.executeNext({
    harnessRun: run,
    planGraphBundle: bundle,
    context: {
      tenantId: "tenant-1",
      traceId: "trace-1",
      emittedBy: "plan-graph-runtime",
      executorRef: "worker-1",
    },
  });

  assert.equal(result.nodeRun.nodeId, "node-a");
  assert.equal(result.nodeRun.status, "succeeded");
  assert.equal(result.nodeAttempt.attemptNo, 1);
  assert.equal(result.receipt.status, "succeeded");
  assert.equal(result.receipt.evidenceRefs.length, 1);
  assert.deepEqual(
    result.events.map((event) => event.eventType),
    [
      "platform.graph_scheduler.decision_recorded",
      "platform.node_run.status_changed",
      "platform.node_run.status_changed",
      "platform.node_run.status_changed",
      "platform.node_run.status_changed",
    ],
  );
});
