import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryClarificationSessionRepository,
} from "../../../../../src/platform/five-plane-orchestration/harness/runtime/clarification-session-repository.js";
import {
  IntakeAdmissionService,
  type RawTaskInput,
} from "../../../../../src/platform/five-plane-orchestration/harness/runtime/intake-admission-service.js";

function createRawInput(): RawTaskInput {
  return {
    tenantId: "tenant-1",
    principal: {
      principalId: "user-1",
      actorType: "human",
      authorizationLevel: "operator",
    } as RawTaskInput["principal"],
    source: {
      channel: "web",
      type: "interactive",
    } as RawTaskInput["source"],
    domainId: "default",
    goal: "Maybe help me prepare a plan later when possible",
    inputs: { scope: "quarterly" },
    riskPreview: {
      riskClass: "medium",
      reasons: ["requires_clarification"],
    },
    constraintPackRef: "constraint_pack:default",
    budgetIntent: {
      amount: 42,
      currency: "USD",
      resourceKinds: ["compute"],
    },
    idempotencyKey: "idem-clarify-1",
    traceId: "trace-clarify-1",
  };
}

test("clarification sessions persist in repository and can resume across service instances", () => {
  const repository = new InMemoryClarificationSessionRepository();
  const admittingService = new IntakeAdmissionService({ clarificationRepository: repository });

  const admitted = admittingService.admit(createRawInput());
  const clarificationEvent = admitted.events.find((event) => event.eventType === "platform.intake.clarification_needed");

  assert.ok(clarificationEvent);
  const sessionId = String((clarificationEvent.payload as Record<string, unknown>).sessionId);
  assert.ok(repository.get(sessionId));

  const resumedService = new IntakeAdmissionService({ clarificationRepository: repository });
  const resumed = resumedService.resumeClarification(sessionId, {
    confirmationReceiptId: "confirm-1",
    confirmedAt: "2026-05-07T00:00:00.000Z",
    confirmationMethod: "explicit_confirm",
    confirmedBy: {
      principalId: "user-1",
      actorType: "human",
    },
  });

  assert.equal(resumed.clarificationSession.stage, "confirmed");
  assert.equal(resumed.requestEnvelope.budgetIntent.amount, 42);
  assert.equal(repository.get(sessionId)?.session.stage, "confirmed");
});
