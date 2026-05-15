import assert from "node:assert/strict";
import test from "node:test";

import { createPrincipalRef } from "../../../../../../src/platform/contracts/executable-contracts/index.js";
import {
  IntakeAdmissionService,
  type TrafficController,
} from "../../../../../../src/platform/five-plane-orchestration/harness/runtime/intake-admission-service.js";

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

test("IntakeAdmissionService refuses admission when traffic controller blocks traffic", () => {
  // Create a traffic controller that always returns false (fail_closed)
  const blockedController: TrafficController = {
    canAcceptTraffic: () => false,
  };
  const service = new IntakeAdmissionService({ trafficController: blockedController });
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  assert.throws(
    () =>
      service.admit({
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
        idempotencyKey: "idem-blocked",
        traceId: "trace-1",
      }),
    (err: Error) => err.message.includes("admission.blocked"),
  );
});

test("IntakeAdmissionService allows admission when traffic controller permits traffic", () => {
  // Create a traffic controller that returns true (traffic allowed)
  const allowedController: TrafficController = {
    canAcceptTraffic: () => true,
  };
  const service = new IntakeAdmissionService({ trafficController: allowedController });
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  const result = service.admit({
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
    idempotencyKey: "idem-allowed",
    traceId: "trace-2",
  });

  assert.equal(result.harnessRun.status, "admitted");
});

test("IntakeAdmissionService allows admission when no traffic controller is configured", () => {
  // No traffic controller - admission should work
  const service = new IntakeAdmissionService();
  const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
  });

  const result = service.admit({
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
    idempotencyKey: "idem-no-controller",
    traceId: "trace-3",
  });

  assert.equal(result.harnessRun.status, "admitted");
});
