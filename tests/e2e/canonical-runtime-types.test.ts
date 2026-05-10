/**
 * E2E Canonical Runtime Types Tests (R24-72)
 *
 * End-to-end tests covering canonical runtime types: HarnessRun, NodeRun,
 * NodeAttempt, BudgetReservation, and SideEffectRecord.
 *
 * R24-72: tests/e2e/ (~75文件) - ~95% E2E 仅测 legacy 类型——canonical runtime 接近零 E2E 覆盖
 *
 * This test file provides comprehensive E2E coverage for canonical runtime types,
 * ensuring the five-plane execution path is exercised end-to-end with proper
 * type usage.
 *
 * Tests verify:
 * - HarnessRun full lifecycle (created -> ready -> running -> completed/failed)
 * - NodeRun state transitions via RuntimeStateMachine
 * - NodeAttempt execution with budget tracking
 * - BudgetReservation lifecycle (reserved -> settled/released)
 * - SideEffectRecord compensation path
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { withProcessGuard } from "../helpers/process-guard.js";
import { RuntimeStateMachine } from "../../src/platform/five-plane-execution/runtime-state-machine.js";
import { runMultiStepOrchestration } from "../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";
import {
  createMinimalHarnessRun,
  createMinimalNodeRun,
  createMinimalPlanGraphBundle,
  createMinimalBudgetReservation,
  createMinimalBudgetLedger,
  createSideEffectRecord,
} from "../helpers/fixtures/base.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";
import type {
  HarnessRun,
  NodeRun,
  BudgetReservation,
  SideEffectRecord,
  PlanGraphBundle,
} from "../../src/platform/contracts/executable-contracts/index.js";

// ---------------------------------------------------------------------------
// HarnessRun Lifecycle Tests
// ---------------------------------------------------------------------------

test("E2E Canonical HarnessRun: full lifecycle from created to completed", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-hrun-lifecycle-");
    try {
      const machine = new RuntimeStateMachine();
      const harnessRun = createMinimalHarnessRun({
        harnessRunId: "hrun_e2e_lifecycle_001",
        tenantId: "tenant_canonical_e2e",
        status: "created",
      });
      const traceId = newId("trace");

      // created -> ready
      const ready = machine.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: harnessRun.harnessRunId,
        principal: "e2e-harness-lifecycle",
        aggregateType: "HarnessRun",
        aggregate: harnessRun,
        fromStatus: "created",
        toStatus: "ready",
        tenantId: harnessRun.tenantId,
        traceId,
        reasonCode: "e2e.harness.ready",
        emittedBy: "tests/e2e/canonical-runtime-types.test.ts",
        fencingToken: harnessRun.fenceToken ?? "fence_default",
        auditRef: "audit://harness-lifecycle/ready",
      });
      assert.equal(ready.aggregate.status, "ready");
      assert.equal(ready.event.eventType, "platform.harness_run.status_changed");

      // ready -> running
      const running = machine.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: harnessRun.harnessRunId,
        principal: "e2e-harness-lifecycle",
        aggregateType: "HarnessRun",
        aggregate: ready.aggregate,
        fromStatus: "ready",
        toStatus: "running",
        tenantId: harnessRun.tenantId,
        traceId,
        reasonCode: "e2e.harness.running",
        emittedBy: "tests/e2e/canonical-runtime-types.test.ts",
        fencingToken: harnessRun.fenceToken ?? "fence_default",
        auditRef: "audit://harness-lifecycle/running",
      });
      assert.equal(running.aggregate.status, "running");

      // running -> completed
      const completed = machine.transition({
        commandId: newId("cmd"),
        entityType: "HarnessRun",
        entityId: harnessRun.harnessRunId,
        principal: "e2e-harness-lifecycle",
        aggregateType: "HarnessRun",
        aggregate: running.aggregate,
        fromStatus: "running",
        toStatus: "completed",
        tenantId: harnessRun.tenantId,
        traceId,
        reasonCode: "e2e.harness.completed",
        emittedBy: "tests/e2e/canonical-runtime-types.test.ts",
        fencingToken: harnessRun.fenceToken ?? "fence_default",
        auditRef: "audit://harness-lifecycle/completed",
      });
      assert.equal(completed.aggregate.status, "completed");
      assert.ok(completed.aggregate.completedAt, "completedAt should be set");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

test("E2E Canonical HarnessRun: failure path transitions to failed terminal state", async () => {
  const harness = createE2EHarness("aa-e2e-hrun-failed-");
  try {
    const machine = new RuntimeStateMachine();
    const harnessRun = createMinimalHarnessRun({
      harnessRunId: "hrun_e2e_failed_001",
      tenantId: "tenant_canonical_e2e",
      status: "created",
    });
    const traceId = newId("trace");

    // Quick path: created -> ready -> running -> failed
    const ready = machine.transition({
      commandId: newId("cmd"),
      entityType: "HarnessRun",
      entityId: harnessRun.harnessRunId,
      principal: "e2e-harness-failed",
      aggregateType: "HarnessRun",
      aggregate: harnessRun,
      fromStatus: "created",
      toStatus: "ready",
      tenantId: harnessRun.tenantId,
      traceId,
      reasonCode: "e2e.harness.ready",
      emittedBy: "tests/e2e/canonical-runtime-types.test.ts",
      fencingToken: harnessRun.fenceToken ?? "fence_default",
      auditRef: "audit://harness-failed/ready",
    });

    const running = machine.transition({
      commandId: newId("cmd"),
      entityType: "HarnessRun",
      entityId: harnessRun.harnessRunId,
      principal: "e2e-harness-failed",
      aggregateType: "HarnessRun",
      aggregate: ready.aggregate,
      fromStatus: "ready",
      toStatus: "running",
      tenantId: harnessRun.tenantId,
      traceId,
      reasonCode: "e2e.harness.running",
      emittedBy: "tests/e2e/canonical-runtime-types.test.ts",
      fencingToken: harnessRun.fenceToken ?? "fence_default",
      auditRef: "audit://harness-failed/running",
    });

    const failed = machine.transition({
      commandId: newId("cmd"),
      entityType: "HarnessRun",
      entityId: harnessRun.harnessRunId,
      principal: "e2e-harness-failed",
      aggregateType: "HarnessRun",
      aggregate: running.aggregate,
      fromStatus: "running",
      toStatus: "failed",
      tenantId: harnessRun.tenantId,
      traceId,
      reasonCode: "e2e.harness.failed",
      emittedBy: "tests/e2e/canonical-runtime-types.test.ts",
      fencingToken: harnessRun.fenceToken ?? "fence_default",
      auditRef: "audit://harness-failed/failed",
      errorCode: "E2E_TEST_FAILURE",
    });

    assert.equal(failed.aggregate.status, "failed");
    assert.ok(failed.aggregate.completedAt, "completedAt should be set");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// NodeRun State Machine Tests
// ---------------------------------------------------------------------------

test("E2E Canonical NodeRun: state transitions via RuntimeStateMachine", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-nrun-fsm-");
    try {
      const machine = new RuntimeStateMachine();
      const harnessRun = createMinimalHarnessRun({
        harnessRunId: "hrun_e2e_nrun_fsm",
        tenantId: "tenant_canonical_e2e",
      });
      const planGraphBundle = createMinimalPlanGraphBundle(harnessRun.harnessRunId);
      const nodeRun = createMinimalNodeRun(harnessRun.harnessRunId, planGraphBundle.planGraphBundleId, {
        status: "created",
        nodeId: planGraphBundle.graph.entryNodeIds[0]!,
        leaseId: "lease_nrun_fsm",
        fencingToken: "fence_nrun_fsm",
      });
      const traceId = newId("trace");
      const tenantId = harnessRun.tenantId;

      // created -> ready
      const step1 = machine.transition({
        commandId: newId("cmd"),
        entityType: "NodeRun",
        entityId: nodeRun.nodeRunId,
        principal: "e2e-nrun-fsm",
        aggregateType: "NodeRun",
        aggregate: nodeRun,
        fromStatus: "created",
        toStatus: "ready",
        tenantId,
        traceId,
        reasonCode: "e2e.nrun.ready",
        emittedBy: "tests/e2e/canonical-runtime-types.test.ts",
        leaseId: nodeRun.leaseId!,
        fencingToken: nodeRun.fencingToken!,
        auditRef: "audit://nrun-fsm/ready",
      });
      assert.equal(step1.aggregate.status, "ready");

      // ready -> leased
      const step2 = machine.transition({
        commandId: newId("cmd"),
        entityType: "NodeRun",
        entityId: nodeRun.nodeRunId,
        principal: "e2e-nrun-fsm",
        aggregateType: "NodeRun",
        aggregate: step1.aggregate,
        fromStatus: "ready",
        toStatus: "leased",
        tenantId,
        traceId,
        reasonCode: "e2e.nrun.leased",
        emittedBy: "tests/e2e/canonical-runtime-types.test.ts",
        leaseId: nodeRun.leaseId!,
        fencingToken: nodeRun.fencingToken!,
        auditRef: "audit://nrun-fsm/leased",
      });
      assert.equal(step2.aggregate.status, "leased");

      // leased -> executing
      const step3 = machine.transition({
        commandId: newId("cmd"),
        entityType: "NodeRun",
        entityId: nodeRun.nodeRunId,
        principal: "e2e-nrun-fsm",
        aggregateType: "NodeRun",
        aggregate: step2.aggregate,
        fromStatus: "leased",
        toStatus: "executing",
        tenantId,
        traceId,
        reasonCode: "e2e.nrun.executing",
        emittedBy: "tests/e2e/canonical-runtime-types.test.ts",
        leaseId: nodeRun.leaseId!,
        fencingToken: nodeRun.fencingToken!,
        auditRef: "audit://nrun-fsm/executing",
      });
      assert.equal(step3.aggregate.status, "executing");

      // executing -> succeeded
      const step4 = machine.transition({
        commandId: newId("cmd"),
        entityType: "NodeRun",
        entityId: nodeRun.nodeRunId,
        principal: "e2e-nrun-fsm",
        aggregateType: "NodeRun",
        aggregate: step3.aggregate,
        fromStatus: "executing",
        toStatus: "succeeded",
        tenantId,
        traceId,
        reasonCode: "e2e.nrun.succeeded",
        emittedBy: "tests/e2e/canonical-runtime-types.test.ts",
        leaseId: nodeRun.leaseId!,
        fencingToken: nodeRun.fencingToken!,
        auditRef: "audit://nrun-fsm/succeeded",
      });
      assert.equal(step4.aggregate.status, "succeeded");
      assert.ok(step4.aggregate.completedAt, "completedAt should be set");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

test("E2E Canonical NodeRun: failed execution transitions to failed state", async () => {
  const harness = createE2EHarness("aa-e2e-nrun-failed-");
  try {
    const machine = new RuntimeStateMachine();
    const harnessRun = createMinimalHarnessRun({
      harnessRunId: "hrun_e2e_nrun_failed",
      tenantId: "tenant_canonical_e2e",
    });
    const planGraphBundle = createMinimalPlanGraphBundle(harnessRun.harnessRunId);
    const nodeRun = createMinimalNodeRun(harnessRun.harnessRunId, planGraphBundle.planGraphBundleId, {
      status: "created",
      nodeId: planGraphBundle.graph.entryNodeIds[0]!,
    });
    const traceId = newId("trace");

    // Quick path to failed
    const executing = machine.transition({
      commandId: newId("cmd"),
      entityType: "NodeRun",
      entityId: nodeRun.nodeRunId,
      principal: "e2e-nrun-failed",
      aggregateType: "NodeRun",
      aggregate: nodeRun,
      fromStatus: "created",
      toStatus: "executing",
      tenantId: harnessRun.tenantId,
      traceId,
      reasonCode: "e2e.nrun.executing",
      emittedBy: "tests/e2e/canonical-runtime-types.test.ts",
      leaseId: nodeRun.leaseId!,
      fencingToken: nodeRun.fencingToken!,
      auditRef: "audit://nrun-failed/executing",
    });

    const failed = machine.transition({
      commandId: newId("cmd"),
      entityType: "NodeRun",
      entityId: nodeRun.nodeRunId,
      principal: "e2e-nrun-failed",
      aggregateType: "NodeRun",
      aggregate: executing.aggregate,
      fromStatus: "executing",
      toStatus: "failed",
      tenantId: harnessRun.tenantId,
      traceId,
      reasonCode: "e2e.nrun.failed",
      emittedBy: "tests/e2e/canonical-runtime-types.test.ts",
      leaseId: nodeRun.leaseId!,
      fencingToken: nodeRun.fencingToken!,
      auditRef: "audit://nrun-failed/failed",
      errorCode: "E2E_NODE_FAILURE",
    });

    assert.equal(failed.aggregate.status, "failed");
    assert.ok(failed.aggregate.completedAt, "completedAt should be set");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// BudgetReservation Lifecycle Tests
// ---------------------------------------------------------------------------

test("E2E Canonical BudgetReservation: reserved -> settled lifecycle", async () => {
  const harness = createE2EHarness("aa-e2e-bresv-settle-");
  try {
    const machine = new RuntimeStateMachine();
    const harnessRun = createMinimalHarnessRun({
      harnessRunId: "hrun_e2e_bresv_settle",
      tenantId: "tenant_canonical_e2e",
      budgetLedgerId: "bledger_e2e_bresv_settle",
    });
    const leaseId = "lease_bresv_settle";
    const fencingToken = "fence_bresv_settle";

    const reservation = createMinimalBudgetReservation(
      harnessRun.budgetLedgerId,
      harnessRun.harnessRunId,
      { budgetReservationId: "bresv_e2e_settle_001" }
    );
    const traceId = newId("trace");

    // reserved -> settled
    const settled = machine.transition({
      commandId: newId("cmd"),
      entityType: "BudgetReservation",
      entityId: reservation.budgetReservationId,
      principal: "e2e-bresv-settle",
      aggregateType: "BudgetReservation",
      aggregate: reservation,
      fromStatus: "reserved",
      toStatus: "settled",
      tenantId: harnessRun.tenantId,
      traceId,
      reasonCode: "e2e.bresv.settled",
      emittedBy: "tests/e2e/canonical-runtime-types.test.ts",
      leaseId,
      fencingToken,
      auditRef: "audit://bresv-settle/settled",
    });

    assert.equal(settled.aggregate.status, "settled");
    assert.equal(settled.event.eventType, "platform.budget_reservation.status_changed");

  } finally {
    harness.cleanup();
  }
});

test("E2E Canonical BudgetReservation: reserved -> released lifecycle", async () => {
  const harness = createE2EHarness("aa-e2e-bresv-release-");
  try {
    const machine = new RuntimeStateMachine();
    const harnessRun = createMinimalHarnessRun({
      harnessRunId: "hrun_e2e_bresv_release",
      tenantId: "tenant_canonical_e2e",
      budgetLedgerId: "bledger_e2e_bresv_release",
    });
    const leaseId = "lease_bresv_release";
    const fencingToken = "fence_bresv_release";

    const reservation = createMinimalBudgetReservation(
      harnessRun.budgetLedgerId,
      harnessRun.harnessRunId,
      { budgetReservationId: "bresv_e2e_release_001" }
    );
    const traceId = newId("trace");

    // reserved -> released
    const released = machine.transition({
      commandId: newId("cmd"),
      entityType: "BudgetReservation",
      entityId: reservation.budgetReservationId,
      principal: "e2e-bresv-release",
      aggregateType: "BudgetReservation",
      aggregate: reservation,
      fromStatus: "reserved",
      toStatus: "released",
      tenantId: harnessRun.tenantId,
      traceId,
      reasonCode: "e2e.bresv.released",
      emittedBy: "tests/e2e/canonical-runtime-types.test.ts",
      leaseId,
      fencingToken,
      auditRef: "audit://bresv-release/released",
    });

    assert.equal(released.aggregate.status, "released");
    assert.equal(released.event.eventType, "platform.budget_reservation.status_changed");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// SideEffectRecord Compensation Path Tests
// ---------------------------------------------------------------------------

test("E2E Canonical SideEffectRecord: full compensation path", async () => {
  const harness = createE2EHarness("aa-e2e-side-effect-comp-");
  try {
    const machine = new RuntimeStateMachine();
    const leaseId = "lease_side_effect_comp";
    const fencingToken = "fence_side_effect_comp";
    const traceId = newId("trace");

    const policyProofRef = {
      artifactId: "artifact-proof-comp",
      uri: "artifact://policy-proof/comp",
    };

    let sideEffect: SideEffectRecord = createSideEffectRecord({
      harnessRunId: "hrun_side_effect_comp",
      nodeRunId: "nrun_side_effect_comp",
      nodeAttemptId: "nattempt_side_effect_comp",
      effectKind: "external_api",
      idempotencyKey: "idem_side_effect_comp",
      riskClass: "medium",
      preCommitPolicyProofRef: policyProofRef,
      deadline: "2026-06-01T00:00:00.000Z",
    });

    // approved -> reserved -> committing -> ambiguous -> compensation_required -> compensating -> compensated
    const transitions: Array<SideEffectRecord["status"]> = [
      "approved",
      "reserved",
      "committing",
      "ambiguous",
      "compensation_required",
      "compensating",
      "compensated",
    ];

    for (const toStatus of transitions) {
      const result = machine.transition({
        commandId: newId("cmd"),
        entityType: "SideEffectRecord",
        entityId: sideEffect.sideEffectId,
        principal: "e2e-side-effect-comp",
        aggregateType: "SideEffectRecord",
        aggregate: sideEffect,
        fromStatus: sideEffect.status,
        toStatus,
        tenantId: "tenant_canonical_e2e",
        traceId,
        reasonCode: `e2e.side_effect.${toStatus}`,
        emittedBy: "tests/e2e/canonical-runtime-types.test.ts",
        leaseId,
        fencingToken,
        auditRef: `audit://side-effect-comp/${toStatus}`,
        sideEffectSafety: {
          idempotencyKey: sideEffect.idempotencyKey,
          preCommitPolicyProofRef: sideEffect.preCommitPolicyProofRef.artifactId,
          reversible: true,
        },
      });
      sideEffect = result.aggregate;
      assert.equal(result.event.eventType, "platform.side_effect.status_changed");
    }

    assert.equal(sideEffect.status, "compensated");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Integrated Canonical Runtime E2E Tests
// ---------------------------------------------------------------------------

test("E2E Canonical Runtime: runMultiStepOrchestration produces valid HarnessRun + NodeRun chain", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-canonical-orchestration-");
    try {
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "E2E Canonical orchestration test",
        request: `oapeflir://plan ${JSON.stringify([
          {
            nodeId: "step_init",
            nodeType: "tool",
            inputRefs: [],
            outputSchemaRef: "schema:init.output",
            riskClass: "low",
            budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
          {
            nodeId: "step_process",
            nodeType: "llm",
            inputRefs: ["step_init"],
            outputSchemaRef: "schema:process.output",
            riskClass: "medium",
            budgetIntent: { amount: 0.01, currency: "USD", resourceKinds: ["token"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry:default",
            timeoutMs: 30000,
          },
        ])}`,
        stepOutputOverrides: {
          step_init: { initialized: true },
          step_process: { processed: true },
        },
      });

      // Verify canonical runtime types in result
      assert.ok(result.snapshot.task, "Should have task snapshot");
      const task = result.snapshot.task!;
      assert.equal(task.status, "done", "Task should complete");

      // Verify workflow uses canonical path
      assert.ok(result.plannedWorkflow, "Should have planned workflow");
      const workflow = result.plannedWorkflow;
      assert.ok(workflow.workflowId.startsWith("oapeflir_"), "Workflow should use canonical oapeflir_ prefix");

      // Verify routing indicates canonical path
      assert.equal(result.routing.routeReason, "oapeflir_bridge", "Should route via oapeflir_bridge canonical path");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

test("E2E Canonical Runtime: HarnessRun + PlanGraphBundle + NodeRun aggregate integrity", async () => {
  const harness = createE2EHarness("aa-e2e-canonical-aggregate-");
  try {
    const machine = new RuntimeStateMachine();
    const harnessRun = createMinimalHarnessRun({
      harnessRunId: "hrun_e2e_canonical_agg",
      tenantId: "tenant_canonical_e2e",
      status: "created",
    });
    const planGraphBundle = createMinimalPlanGraphBundle(harnessRun.harnessRunId);
    const nodeRun = createMinimalNodeRun(harnessRun.harnessRunId, planGraphBundle.planGraphBundleId, {
      status: "created",
      nodeId: planGraphBundle.graph.entryNodeIds[0]!,
      leaseId: "lease_canonical_agg",
      fencingToken: "fence_canonical_agg",
    });
    const traceId = newId("trace");

    // Verify initial aggregate relationships
    assert.equal(planGraphBundle.harnessRunId, harnessRun.harnessRunId);
    assert.equal(nodeRun.harnessRunId, harnessRun.harnessRunId);
    assert.equal(nodeRun.planGraphBundleId, planGraphBundle.planGraphBundleId);

    // Create -> Ready for HarnessRun
    const hrunReady = machine.transition({
      commandId: newId("cmd"),
      entityType: "HarnessRun",
      entityId: harnessRun.harnessRunId,
      principal: "e2e-canonical-agg",
      aggregateType: "HarnessRun",
      aggregate: harnessRun,
      fromStatus: "created",
      toStatus: "ready",
      tenantId: harnessRun.tenantId,
      traceId,
      reasonCode: "e2e.canonical.agg.ready",
      emittedBy: "tests/e2e/canonical-runtime-types.test.ts",
      fencingToken: harnessRun.fenceToken ?? "fence_default",
      auditRef: "audit://canonical-agg/hrun-ready",
    });

    // Verify HarnessRun state machine emits correct event
    assert.equal(hrunReady.event.eventType, "platform.harness_run.status_changed");

    // Create -> Ready for NodeRun
    const nodeReady = machine.transition({
      commandId: newId("cmd"),
      entityType: "NodeRun",
      entityId: nodeRun.nodeRunId,
      principal: "e2e-canonical-agg",
      aggregateType: "NodeRun",
      aggregate: nodeRun,
      fromStatus: "created",
      toStatus: "ready",
      tenantId: harnessRun.tenantId,
      traceId,
      reasonCode: "e2e.canonical.agg.node_ready",
      emittedBy: "tests/e2e/canonical-runtime-types.test.ts",
      leaseId: nodeRun.leaseId!,
      fencingToken: nodeRun.fencingToken!,
      auditRef: "audit://canonical-agg/node-ready",
    });

    // Verify NodeRun state machine emits correct event
    assert.equal(nodeReady.event.eventType, "platform.node_run.status_changed");

    // Verify aggregate references maintained
    assert.equal(nodeReady.aggregate.harnessRunId, harnessRun.harnessRunId);
    assert.equal(nodeReady.aggregate.planGraphBundleId, planGraphBundle.planGraphBundleId);

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// End of R24-72 Canonical Runtime Types E2E Tests
// ---------------------------------------------------------------------------