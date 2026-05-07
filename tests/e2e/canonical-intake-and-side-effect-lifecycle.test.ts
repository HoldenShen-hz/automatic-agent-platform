import assert from "node:assert/strict";
import test from "node:test";

import { IntakeRouter } from "../../src/platform/orchestration/routing/intake-router.js";
import { RuntimeStateMachine } from "../../src/platform/five-plane-execution/runtime-state-machine.js";
import {
  createPrincipalRef,
  createSideEffectRecord,
  type ArtifactRef,
  type SideEffectRecord,
} from "../../src/platform/contracts/executable-contracts/index.js";

const policyProofRef: ArtifactRef = {
  artifactId: "artifact-proof-1",
  uri: "artifact://policy-proof/1",
};

test("E2E Canonical Intake: raw request flows through task draft, confirmed spec, and request envelope", () => {
  const router = new IntakeRouter();
  const result = router.route({
    title: "Prepare deployment checklist",
    request: "Prepare a deployment checklist for the production release and assign follow-up owners.",
    tenantId: "tenant-e2e",
    traceId: "trace-e2e-intake",
    idempotencyKey: "idem-e2e-intake",
    principal: createPrincipalRef({
      principalId: "user-e2e",
      tenantId: "tenant-e2e",
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

  assert.ok(result.taskDraft.taskDraftId.startsWith("taskdraft_"));
  assert.equal(result.clarificationSession, null);
  assert.equal(result.confirmedTaskSpec.confirmedTaskSpecId, result.confirmedTaskSpecId);
  assert.equal(result.requestEnvelope.confirmedTaskSpecId, result.confirmedTaskSpec.confirmedTaskSpecId);
  assert.equal(result.requestEnvelope.traceId, "trace-e2e-intake");
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
