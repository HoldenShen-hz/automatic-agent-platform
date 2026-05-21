import assert from "node:assert/strict";
import test from "node:test";

import { EscalationService, EscalationRequest } from "../../../../../src/platform/five-plane-orchestration/escalation/index.js";

function createRequest(overrides: Partial<EscalationRequest> = {}): EscalationRequest {
  return {
    taskId: "task-1",
    executionId: "execution-1",
    tenantId: "tenant-1",
    stage: "assess",
    riskLevel: "low",
    reasonCode: "test.reason",
    estimatedCostUsd: null,
    affectsProduction: false,
    slaDeadline: null,
    timeoutMs: null,
    ...overrides,
  };
}

// --- SLA Deadline Triggers ---

test("exceeded slaDeadline triggers takeover", () => {
  const service = new EscalationService();
  // SLA deadline in the past
  const pastDeadline = new Date(Date.now() - 60_000).toISOString();
  const request = createRequest({
    slaDeadline: pastDeadline,
    riskLevel: "low",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.reasonCode, "escalation.sla_deadline_exceeded_takeover_required");
});

test("imminent slaDeadline (within 60s) triggers approval", () => {
  const service = new EscalationService();
  // SLA deadline in 30 seconds
  const imminentDeadline = new Date(Date.now() + 30_000).toISOString();
  const request = createRequest({
    slaDeadline: imminentDeadline,
    riskLevel: "low",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
  assert.equal(decision.reasonCode, "escalation.sla_deadline_imminent_approval_required");
});

test("future slaDeadline (more than 60s) does not trigger escalation", () => {
  const service = new EscalationService();
  // SLA deadline in 2 minutes
  const futureDeadline = new Date(Date.now() + 120_000).toISOString();
  const request = createRequest({
    slaDeadline: futureDeadline,
    riskLevel: "low",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  assert.equal(decision.decision, "none");
});

test("null slaDeadline does not trigger deadline-based escalation", () => {
  const service = new EscalationService();
  const request = createRequest({
    slaDeadline: null,
    riskLevel: "low",
    affectsProduction: false,
    estimatedCostUsd: 0,
  });
  const decision = service.decide(request);

  // null deadline means no SLA constraint
  assert.equal(decision.decision, "none");
});

test("invalid slaDeadline string does not trigger escalation", () => {
  const service = new EscalationService();
  const request = createRequest({
    slaDeadline: "invalid-date-string",
    riskLevel: "low",
    affectsProduction: false,
    estimatedCostUsd: 0,
  });
  const decision = service.decide(request);

  // Invalid date parsing should not trigger deadline escalation
  assert.equal(decision.decision, "none");
});

test("exceeded slaDeadline takes priority over high risk approval", () => {
  const service = new EscalationService();
  const pastDeadline = new Date(Date.now() - 60_000).toISOString();
  const request = createRequest({
    slaDeadline: pastDeadline,
    riskLevel: "high",
    stage: "assess",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  // exceeded deadline triggers takeover
  assert.equal(decision.decision, "takeover");
});

test("imminent slaDeadline takes priority over none decision", () => {
  const service = new EscalationService();
  const imminentDeadline = new Date(Date.now() + 30_000).toISOString();
  const request = createRequest({
    slaDeadline: imminentDeadline,
    riskLevel: "low",
    affectsProduction: false,
    estimatedCostUsd: 0,
  });
  const decision = service.decide(request);

  // imminent deadline triggers approval
  assert.equal(decision.decision, "approval");
});

// --- Timeout Triggers ---

test("expired timeout (timeoutMs <= 0) triggers takeover", () => {
  const service = new EscalationService();
  const request = createRequest({
    timeoutMs: 0,
    riskLevel: "low",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.reasonCode, "escalation.timeout_elapsed_takeover_required");
});

test("expired timeout (negative) triggers takeover", () => {
  const service = new EscalationService();
  const request = createRequest({
    timeoutMs: -1000,
    riskLevel: "low",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
});

test("imminent timeout (within 60s) triggers approval", () => {
  const service = new EscalationService();
  const request = createRequest({
    timeoutMs: 30_000,
    riskLevel: "low",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
  assert.equal(decision.reasonCode, "escalation.timeout_imminent_approval_required");
});

test("timeout with more than 60s remaining does not trigger escalation", () => {
  const service = new EscalationService();
  const request = createRequest({
    timeoutMs: 120_000,
    riskLevel: "low",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  assert.equal(decision.decision, "none");
});

test("null timeoutMs does not trigger timeout-based escalation", () => {
  const service = new EscalationService();
  const request = createRequest({
    timeoutMs: null,
    riskLevel: "low",
    affectsProduction: false,
    estimatedCostUsd: 0,
  });
  const decision = service.decide(request);

  // null timeout means no timeout constraint
  assert.equal(decision.decision, "none");
});

// --- Combined SLA and Timeout Triggers ---

test("both slaDeadline exceeded and timeout expired triggers takeover (deadline takes precedence)", () => {
  const service = new EscalationService();
  const pastDeadline = new Date(Date.now() - 60_000).toISOString();
  const request = createRequest({
    slaDeadline: pastDeadline,
    timeoutMs: -1000,
    riskLevel: "low",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
});

test("imminent slaDeadline and imminent timeout triggers approval", () => {
  const service = new EscalationService();
  const imminentDeadline = new Date(Date.now() + 30_000).toISOString();
  const request = createRequest({
    slaDeadline: imminentDeadline,
    timeoutMs: 30_000,
    riskLevel: "low",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
});

// --- Trigger Interaction with Risk Levels ---

test("exceeded slaDeadline with critical risk triggers panic_stop", () => {
  const service = new EscalationService();
  const pastDeadline = new Date(Date.now() - 60_000).toISOString();
  const request = createRequest({
    slaDeadline: pastDeadline,
    riskLevel: "critical",
    affectsProduction: true,
  });
  const decision = service.decide(request);

  // Critical + production = panic_stop (highest priority)
  assert.equal(decision.decision, "panic_stop");
});

test("imminent timeout with high risk triggers approval (timeout imminent path)", () => {
  const service = new EscalationService();
  const request = createRequest({
    timeoutMs: 30_000,
    riskLevel: "high",
    stage: "assess",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  // imminent timeout triggers approval
  assert.equal(decision.decision, "approval");
});

test("expired timeout with high risk in execute triggers takeover (not approval)", () => {
  const service = new EscalationService();
  const request = createRequest({
    timeoutMs: -1000,
    riskLevel: "high",
    stage: "execute",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  // timeout elapsed triggers takeover
  assert.equal(decision.decision, "takeover");
});

// --- Edge Cases ---

test("exact boundary: timeoutMs = 60000 triggers neither approval nor takeover", () => {
  const service = new EscalationService();
  const request = createRequest({
    timeoutMs: 60_000,
    riskLevel: "low",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  // 60_000ms is not <= 60_000 (imminent) and not <= 0 (expired)
  // It should not trigger imminent timeout approval
  assert.notEqual(decision.decision, "approval");
});

test("exact boundary: timeoutMs = 60001 triggers no escalation", () => {
  const service = new EscalationService();
  const request = createRequest({
    timeoutMs: 60_001,
    riskLevel: "low",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  // 60_001ms > 60_000, not imminent
  assert.equal(decision.decision, "none");
});

test("slaDeadline exactly now triggers approval", () => {
  const service = new EscalationService();
  // Use a deadline that is effectively now
  const nearNow = new Date(Date.now() - 1).toISOString();
  const request = createRequest({
    slaDeadline: nearNow,
    riskLevel: "low",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  // deadline exceeded triggers takeover
  assert.equal(decision.decision, "takeover");
});

// --- Workflow State for Triggers ---

test("takeover from exceeded slaDeadline has paused_for_takeover workflow state", () => {
  const service = new EscalationService();
  const pastDeadline = new Date(Date.now() - 60_000).toISOString();
  const request = createRequest({
    slaDeadline: pastDeadline,
    riskLevel: "low",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.workflowState, "paused_for_takeover");
});

test("takeover from expired timeout has paused_for_takeover workflow state", () => {
  const service = new EscalationService();
  const request = createRequest({
    timeoutMs: -1000,
    riskLevel: "low",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.workflowState, "paused_for_takeover");
});

test("approval from imminent slaDeadline has pending_approval workflow state", () => {
  const service = new EscalationService();
  const imminentDeadline = new Date(Date.now() + 30_000).toISOString();
  const request = createRequest({
    slaDeadline: imminentDeadline,
    riskLevel: "low",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
  assert.equal(decision.workflowState, "pending_approval");
});

test("approval from imminent timeout has pending_approval workflow state", () => {
  const service = new EscalationService();
  const request = createRequest({
    timeoutMs: 30_000,
    riskLevel: "low",
    affectsProduction: false,
  });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
  assert.equal(decision.workflowState, "pending_approval");
});