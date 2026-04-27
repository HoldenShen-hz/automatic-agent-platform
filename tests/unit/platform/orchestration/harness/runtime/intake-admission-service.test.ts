import assert from "node:assert/strict";
import test from "node:test";

import { createPrincipalRef } from "../../../../../../src/platform/contracts/executable-contracts/index.js";
import { IntakeAdmissionService } from "../../../../../../src/platform/orchestration/harness/runtime/intake-admission-service.js";

test("IntakeAdmissionService builds the canonical intake and admission chain idempotently", () => {
  const service = new IntakeAdmissionService();
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  const first = service.admit({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    goal: "ship runtime contract",
    inputs: { repo: "automatic_agent_platform" },
    riskPreview: { riskClass: "medium", reasons: [] },
    constraintPackRef: "policy://default",
    budgetIntent: {
      amount: 100,
      currency: "USD",
      resourceKinds: ["token", "tool"],
    },
    idempotencyKey: "idem-1",
    traceId: "trace-1",
  });
  const second = service.admit({
    tenantId: "tenant-1",
    principal,
    source: "nl",
    goal: "ship runtime contract",
    riskPreview: { riskClass: "medium", reasons: [] },
    constraintPackRef: "policy://default",
    budgetIntent: {
      amount: 100,
      currency: "USD",
      resourceKinds: ["token"],
    },
    idempotencyKey: "idem-1",
    traceId: "trace-1",
  });

  assert.equal(first, second);
  assert.equal(first.requestEnvelope.confirmedTaskSpecId, first.confirmedTaskSpec.confirmedTaskSpecId);
  assert.equal(first.harnessRun.status, "admitted");
  assert.equal(first.harnessRun.versionLockId, first.runVersionLock.runVersionLockId);
  assert.deepEqual(first.events.map((event) => event.eventType), [
    "platform.request_envelope.admitted",
    "platform.harness_run.status_changed",
  ]);
});
