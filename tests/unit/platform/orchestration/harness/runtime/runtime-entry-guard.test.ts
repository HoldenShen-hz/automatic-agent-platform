import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../../../src/platform/contracts/errors.js";
import {
  createPlanGraphBundle,
  type BudgetIntent,
  type PlanGraph,
} from "../../../../../../src/platform/contracts/executable-contracts/index.js";
import { RuntimeEntryGuard } from "../../../../../../src/platform/five-plane-orchestration/harness/runtime/runtime-entry-guard.js";

const budgetIntent: BudgetIntent = {
  amount: 10,
  currency: "USD",
  resourceKinds: ["tool"],
};

const graph: PlanGraph = {
  graphId: "graph-1",
  nodes: [
    {
      nodeId: "node-1",
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
  ],
  edges: [],
  entryNodeIds: ["node-1"],
  terminalNodeIds: ["node-1"],
  joinStrategy: "all",
  graphHash: "hash",
};

test("RuntimeEntryGuard accepts PlanGraphBundle and rejects legacy execution contracts", () => {
  const guard = new RuntimeEntryGuard();
  const bundle = createPlanGraphBundle({
    harnessRunId: "run-1",
    graph,
    schedulerPolicy: {
      policyId: "scheduler-1",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: "budget-plan-1",
    riskProfile: { riskClass: "low", reasons: [] },
  });

  assert.equal(guard.assertPlanGraphBundleOnly(bundle).accepted, true);
  assert.throws(() => guard.assertPlanGraphBundleOnly({ executionPlanId: "legacy" }), ValidationError);
  assert.throws(() => guard.assertNoLegacyTruthWrite({ contractName: "ExecutionPlan" }), ValidationError);
  assert.throws(() => guard.assertNoLegacyTruthWrite({ eventType: "workflow.started" }), ValidationError);
});
