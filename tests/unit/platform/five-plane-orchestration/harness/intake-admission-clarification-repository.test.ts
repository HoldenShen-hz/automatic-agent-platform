import assert from "node:assert/strict";
import test from "node:test";

import { createPrincipalRef } from "../../../../../src/platform/contracts/executable-contracts/contract-domain-factories.js";
import { InMemoryClarificationSessionRepository } from "../../../../../src/platform/five-plane-orchestration/harness/runtime/clarification-session-repository.js";
import {
  IntakeAdmissionService,
  type RawTaskInput,
} from "../../../../../src/platform/five-plane-orchestration/harness/runtime/intake-admission-service.js";

function createRawInput(): RawTaskInput {
  return {
    tenantId: "tenant-1",
    principal: createPrincipalRef({
      principalId: "user-1",
      type: "human",
      tenantId: "tenant-1",
      roles: ["operator"],
      authorizationLevel: "operator",
    }),
    source: "ui",
    domainId: "coding",
    goal: "Maybe help me prepare a plan later when possible",
    inputs: { scope: "quarterly" },
    riskPreview: {
      riskClass: "medium",
      reasons: ["requires_clarification"],
    },
    constraintPackRef: "constraint_pack:coding",
    budgetIntent: {
      amount: 42,
      currency: "USD",
      resourceKinds: ["compute"],
    },
    idempotencyKey: "idem-clarify-1",
    traceId: "trace-clarify-1",
  };
}

test("clarification sessions persist and resume across service instances", () => {
  const repository = new InMemoryClarificationSessionRepository();
  const admittingService = new IntakeAdmissionService({ clarificationRepository: repository });

  const admitted = admittingService.admit(createRawInput());
  const clarificationEvent = admitted.events.find((event) => event.eventType === "platform.intake.clarification_needed");

  assert.ok(clarificationEvent != null);
  const sessionId = String((clarificationEvent.payload as Record<string, unknown>).sessionId);
  assert.ok(repository.get(sessionId) != null);

  const resumedService = new IntakeAdmissionService({ clarificationRepository: repository });
  const resumed = resumedService.resumeClarification(sessionId, {
    receiptId: "confirm-1",
    confirmedAt: "2026-05-07T00:00:00.000Z",
    confirmedBy: createPrincipalRef({
      principalId: "user-1",
      type: "human",
      tenantId: "tenant-1",
      roles: ["operator"],
      authorizationLevel: "operator",
    }),
    riskClass: "medium",
    state: "confirmed",
    scope: "clarification",
  });

  assert.equal(resumed.clarificationSession.stage, "confirmed");
  assert.equal(resumed.requestEnvelope.budgetIntent.amount, 42);
  assert.equal(repository.get(sessionId)?.session.stage, "confirmed");
});
