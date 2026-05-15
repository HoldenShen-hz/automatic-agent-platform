import assert from "node:assert/strict";
import test from "node:test";

import { IntakeRouter } from "../../src/platform/five-plane-orchestration/routing/intake-router.js";
import { RuntimeStateMachine } from "../../src/platform/five-plane-execution/runtime-state-machine.js";
import {
  createPrincipalRef,
  createSideEffectRecord,
  type BudgetReservation,
  type ArtifactRef,
  type SideEffectRecord,
} from "../../src/platform/contracts/executable-contracts/index.js";
import {
  createMinimalBudgetReservation,
  createMinimalHarnessRun,
} from "../helpers/fixtures/base.js";

const policyProofRef: ArtifactRef = {
  artifactId: "artifact-proof-1",
  uri: "artifact://policy-proof/1",
};

test("E2E Canonical Intake: raw request flows through task draft, confirmed spec, and request envelope", () => {
  const router = new IntakeRouter();
  const harnessRun = createMinimalHarnessRun({
    harnessRunId: "hrun-e2e-intake",
    tenantId: "tenant-e2e",
  });
  const result = router.route({
    title: "Prepare deployment checklist",
    request: "Prepare a deployment checklist for the production release and assign follow-up owners.",
// @ts-ignore
    tenantId: harnessRun.tenantId,
    traceId: "trace-e2e-intake",
    idempotencyKey: "idem-e2e-intake",
    principal: createPrincipalRef({
      principalId: "user-e2e",
      tenantId: harnessRun.tenantId,
      roles: ["operator"],
    }),
    preferredIntent: {
      intent: "create",
      confidence: 0.95,
      source: "e2e-test",
    },
    riskPreview: {
      riskClass: "medium",
      reasons: ["planning workflow"],
    },
  });

// @ts-ignore
  assert.ok(result.taskDraft.taskDraftId.startsWith("taskdraft_"));
// @ts-ignore
  assert.equal(result.clarificationSession, null);
// @ts-ignore
  assert.equal(result.confirmedTaskSpec.confirmedTaskSpecId, result.confirmedTaskSpecId);
// @ts-ignore
  assert.equal(result.requestEnvelope.confirmedTaskSpecId, result.confirmedTaskSpec.confirmedTaskSpecId);
// @ts-ignore
  assert.equal(result.requestEnvelope.traceId, "trace-e2e-intake");
// @ts-ignore
  assert.equal(result.requestEnvelope.tenantId, harnessRun.tenantId);
  assert.ok(result.routeTrace.some((entry) => entry.startsWith("stage1:taskDraft:")));
  assert.ok(result.routeTrace.some((entry) => entry.startsWith("stage3:confirmed_task_spec:")));
  assert.ok(result.routeTrace.some((entry) => entry.startsWith("stage4:request_envelope:")));
});

test("E2E SideEffect Lifecycle: canonical runtime state machine records commit, ambiguity, and compensation path", () => {
  const machine = new RuntimeStateMachine();
  const leaseId = "lease-side-effect-e2e";
  const fencingToken = "fence-side-effect-e2e-0";

  let sideEffect: SideEffectRecord = createSideEffectRecord({
    harnessRunId: "hrun-side-effect",
    nodeRunId: "nrun-side-effect",
    nodeAttemptId: "nattempt-side-effect",
    effectKind: "external_api",
    idempotencyKey: "idem-side-effect",
    riskClass: "medium",
    preCommitPolicyProofRef: policyProofRef,
    deadline: "2026-05-08T00:00:00.000Z",
  });

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
// @ts-ignore
      commandId: `cmd:${toStatus}`,
      entityType: "SideEffectRecord",
      entityId: sideEffect.sideEffectId,
      principal: "operator-e2e",
      aggregateType: "SideEffectRecord",
      aggregate: sideEffect,
      fromStatus: sideEffect.status,
      toStatus,
      tenantId: "tenant-e2e",
      traceId: "trace-side-effect-e2e",
      reasonCode: `side_effect.${toStatus}`,
      emittedBy: "canonical-intake-and-side-effect-lifecycle.e2e",
      leaseId,
      fencingToken,
      auditRef: "audit://side-effect-e2e",
      sideEffectSafety: {
        idempotencyKey: sideEffect.idempotencyKey,
        preCommitPolicyProofRef: sideEffect.preCommitPolicyProofRef.artifactId,
        reversible: true,
      },
    });
    sideEffect = result.aggregate;
    assert.equal(result.event.eventType, "platform.side_effect.status_changed");
    assert.equal(result.event.correlationId, "trace-side-effect-e2e");
  }

  assert.equal(sideEffect.status, "compensated");
});

test("E2E BudgetReservation Lifecycle: canonical runtime state machine records settle and release transitions from fixture-built reservations", () => {
  const machine = new RuntimeStateMachine();
  const harnessRun = createMinimalHarnessRun({
    harnessRunId: "hrun-budget-e2e",
    tenantId: "tenant-e2e",
    budgetLedgerId: "bledger-budget-e2e",
  });
  const leaseId = "lease-budget-e2e";
  const fencingToken = "fence-budget-e2e-0";

  const transitions: Array<{
    reservation: BudgetReservation;
    toStatus: BudgetReservation["status"];
    reasonCode: string;
  }> = [
    {
      reservation: createMinimalBudgetReservation(harnessRun.budgetLedgerId, harnessRun.harnessRunId, {
        budgetReservationId: "bresv-settle-e2e",
      }),
      toStatus: "settled",
      reasonCode: "budget.settled",
    },
    {
      reservation: createMinimalBudgetReservation(harnessRun.budgetLedgerId, harnessRun.harnessRunId, {
        budgetReservationId: "bresv-release-e2e",
      }),
      toStatus: "released",
      reasonCode: "budget.released",
    },
  ];

  for (const item of transitions) {
    const result = machine.transition({
// @ts-ignore
      commandId: `cmd:${item.toStatus}:${item.reservation.budgetReservationId}`,
      entityType: "BudgetReservation",
      entityId: item.reservation.budgetReservationId,
      principal: "budget-operator-e2e",
      aggregateType: "BudgetReservation",
      aggregate: item.reservation,
      fromStatus: item.reservation.status,
      toStatus: item.toStatus,
      tenantId: harnessRun.tenantId,
      traceId: `trace-${item.toStatus}-budget-e2e`,
      reasonCode: item.reasonCode,
      emittedBy: "canonical-intake-and-side-effect-lifecycle.e2e",
      leaseId,
      fencingToken,
      auditRef: `audit://budget/${item.toStatus}`,
    });

    assert.equal(result.aggregate.status, item.toStatus);
    assert.equal(result.event.eventType, "platform.budget_reservation.status_changed");
// @ts-ignore
    assert.equal(result.event.payload.toStatus, item.toStatus);
  }
});
