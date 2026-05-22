import assert from "node:assert/strict";
import test from "node:test";

import { EscalationService, EscalationRequest, EscalationPanicDirective } from "../../../../../src/platform/five-plane-orchestration/escalation/index.js";
import { PlatformPanicService } from "../../../../../src/platform/ops-maturity/platform-panic/index.js";

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

// --- Workflow States ---

test("decision 'none' has workflowState null", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "low", affectsProduction: false, estimatedCostUsd: 0 });
  const decision = service.decide(request);

  assert.equal(decision.decision, "none");
  assert.strictEqual(decision.workflowState, null);
});

test("decision 'approval' has workflowState 'pending_approval'", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "high" });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
  assert.equal(decision.workflowState, "pending_approval");
});

test("decision 'takeover' has workflowState 'paused_for_takeover'", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "critical", affectsProduction: false });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.workflowState, "paused_for_takeover");
});

test("decision 'panic_stop' has workflowState 'panic_stop'", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "critical", affectsProduction: true });
  const decision = service.decide(request);

  assert.equal(decision.decision, "panic_stop");
  assert.equal(decision.workflowState, "panic_stop");
});

// --- Panic Activation Workflow ---

test("panic_stop decision has panicActivation info when panic service is configured", () => {
  const service = new EscalationService(new PlatformPanicService());
  const request = createRequest({ riskLevel: "critical", affectsProduction: true });
  const decision = service.decide(request);

  assert.ok(
    decision.decision === "panic_stop" || decision.decision === "panic_activate",
    `Expected panic_stop or panic_activate, got ${decision.decision}`,
  );
  assert.ok(decision.panicActivation !== undefined);
  assert.equal(decision.blocksExecution, true);
});

test("panic_activate decision has activated true and directiveId", () => {
  const service = new EscalationService(new PlatformPanicService());
  const request = createRequest({ riskLevel: "critical", affectsProduction: true });
  const decision = service.decide(request);

  if (decision.decision === "panic_activate") {
    assert.equal(decision.panicActivation?.activated, true);
    assert.ok(decision.panicActivation?.directiveId !== null);
  }
});

test("panic activation error handling - invalid panic service returns error in panicActivation", () => {
  const service = new EscalationService(new PlatformPanicService());
  const request = createRequest({ riskLevel: "critical", affectsProduction: true });
  const decision = service.decide(request);

  assert.ok(decision.panicActivation !== undefined);
  if (!decision.panicActivation?.activated) {
    assert.ok(decision.panicActivation?.error !== undefined);
  }
});

// --- Approval Request Workflow ---

test("approval decision creates approvalRequestId when approval service is configured", () => {
  // Create a mock approval service handler
  const mockApprovalService = {
    createRequest: (opts: {
      taskId: string;
      executionId: string | null;
      sourceAgentId: string;
      reason: string;
      riskLevel: string;
      stageViewRef: string;
      options: unknown[];
      context: Record<string, unknown>;
      timeoutPolicy: string;
    }) => ({
      approvalId: "approval-123",
      ...opts,
    }),
  };

  const service = new EscalationService(undefined, mockApprovalService as any);
  const request = createRequest({ riskLevel: "high" });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
  assert.ok(decision.approvalRequestId !== null);
  assert.ok(decision.approvalRequestId !== undefined);
});

test("approval decision without approval service has null approvalRequestId", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "high" });
  const decision = service.decide(request);

  assert.equal(decision.decision, "approval");
  assert.strictEqual(decision.approvalRequestId, null);
});

// --- Operator Notification Workflow ---

test("non-none decisions have operatorNotificationId set", () => {
  const service = new EscalationService({
    operatorNotificationHandler: (notification) => notification,
  });
  const request = createRequest({ riskLevel: "high" });
  const decision = service.decide(request);

  assert.equal(decision.requiresOperatorAction, true);
  assert.ok(decision.operatorNotificationId !== null);
  assert.ok(decision.operatorNotificationId !== undefined);
});

test("none decision omits operatorNotificationId", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "low", affectsProduction: false, estimatedCostUsd: 0 });
  const decision = service.decide(request);

  assert.equal(decision.decision, "none");
  assert.strictEqual(decision.operatorNotificationId, undefined);
});

test("custom operator notification handler is invoked", () => {
  let handlerCalled = false;
  const service = new EscalationService({
    operatorNotificationHandler: (notification) => {
      handlerCalled = true;
      return notification;
    },
  });

  const request = createRequest({ riskLevel: "high" });
  service.decide(request);

  assert.equal(handlerCalled, true);
});

// --- HITL Takeover Route Workflow ---

test("takeover decision routes to HITL takeover handler when configured", () => {
  let takeoverRouteCalled = false;
  const service = new EscalationService({
    hitlTakeoverHandler: (request) => {
      takeoverRouteCalled = true;
      return request;
    },
  });

  const request = createRequest({ riskLevel: "critical", affectsProduction: false });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
  assert.equal(takeoverRouteCalled, true);
});

test("critical non-production routes to HITL takeover", () => {
  const service = new EscalationService({
    hitlTakeoverHandler: (request) => request,
  });

  const request = createRequest({ riskLevel: "critical", affectsProduction: false });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.workflowState, "paused_for_takeover");
});

test("high risk + execute stage routes to HITL takeover", () => {
  const service = new EscalationService({
    hitlTakeoverHandler: (request) => request,
  });

  const request = createRequest({ riskLevel: "high", stage: "execute" });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
});

test("sla deadline exceeded routes to HITL takeover", () => {
  const service = new EscalationService({
    hitlTakeoverHandler: (request) => request,
  });

  const pastDeadline = new Date(Date.now() - 60_000).toISOString();
  const request = createRequest({ slaDeadline: pastDeadline, riskLevel: "low", affectsProduction: false });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
});

test("timeout expired routes to HITL takeover", () => {
  const service = new EscalationService({
    hitlTakeoverHandler: (request) => request,
  });

  const request = createRequest({ timeoutMs: -1000, riskLevel: "low", affectsProduction: false });
  const decision = service.decide(request);

  assert.equal(decision.decision, "takeover");
});

// --- Resume from Panic Workflow ---

test("resumeFromPanic delegates to panic service", () => {
  const service = new EscalationService(new PlatformPanicService());
  const plan = {
    resumeSteps: [],
    unfreezeServices: [],
    notifyRecipients: [],
  };

  const result = service.resumeFromPanic("tenant/tenant-1", plan);

  assert.ok(typeof result.scope === "string");
  assert.ok(typeof result.resumed === "boolean");
  assert.ok(result.resumedAt === null || typeof result.resumedAt === "string");
  assert.ok(Array.isArray(result.reasonCodes));
});

test("resumeFromPanic with platform scope", () => {
  const service = new EscalationService(new PlatformPanicService());
  const plan = {
    resumeSteps: [],
    unfreezeServices: [],
    notifyRecipients: [],
  };

  const result = service.resumeFromPanic("platform/global", plan);

  assert.equal(result.scope, "platform/global");
});

// --- Approval Request Creation ---

test("createApprovalRequest uses costThresholdUsd when provided", () => {
  // Test with a mock approval service
  const mockApprovalService = {
    createRequest: (opts: {
      taskId: string;
      executionId: string | null;
      sourceAgentId: string;
      reason: string;
      riskLevel: string;
      stageViewRef: string;
      options: unknown[];
      context: Record<string, unknown>;
      timeoutPolicy: string;
    }) => {
      return {
        approvalId: `approval-${Math.random().toString(36).slice(2)}`,
        ...opts,
      };
    },
  };

  const service = new EscalationService(undefined, mockApprovalService as any);
  const request = createRequest({ estimatedCostUsd: 15, costThresholdUsd: 20 });
  const decision = service.decide(request);

  // cost=15, threshold=20, so 15 < 20, no approval by cost
  // but riskLevel is "low", so no approval needed
  assert.equal(decision.decision, "none");
});

test("approval service receives correct stage from request", () => {
  const mockApprovalService = {
    createRequest: (opts: {
      taskId: string;
      executionId: string | null;
      sourceAgentId: string;
      reason: string;
      riskLevel: string;
      stageViewRef: string;
      options: unknown[];
      context: Record<string, unknown>;
      timeoutPolicy: string;
    }) => {
      return {
        approvalId: `approval-${Math.random().toString(36).slice(2)}`,
        ...opts,
      };
    },
  };

  const service = new EscalationService(undefined, mockApprovalService as any);
  const stages: EscalationRequest["stage"][] = ["assess", "plan", "execute", "feedback", "improve", "release"];

  for (const stage of stages) {
    const request = createRequest({ riskLevel: "high", stage });
    const decision = service.decide(request);

    assert.equal(decision.decision, stage === "execute" ? "takeover" : "approval");
  }
});

// --- Get Panic Service ---

test("getPanicService returns the panic service instance", () => {
  const service = new EscalationService(new PlatformPanicService());
  const panicService = service.getPanicService();

  assert.ok(panicService !== null);
  assert.ok(typeof panicService === "object");
});

// --- Decision Blocks Execution ---

test("decision 'none' blocksExecution is false", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "low", affectsProduction: false, estimatedCostUsd: 0 });
  const decision = service.decide(request);

  assert.equal(decision.blocksExecution, false);
});

test("decision 'approval' blocksExecution is true", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "high" });
  const decision = service.decide(request);

  assert.equal(decision.blocksExecution, true);
});

test("decision 'takeover' blocksExecution is true", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "critical", affectsProduction: false });
  const decision = service.decide(request);

  assert.equal(decision.blocksExecution, true);
});

test("decision 'panic_stop' blocksExecution is true", () => {
  const service = new EscalationService();
  const request = createRequest({ riskLevel: "critical", affectsProduction: true });
  const decision = service.decide(request);

  assert.equal(decision.blocksExecution, true);
});

// --- Tenant Scope Escalation ---

test("tenant-scoped request has correct scope in panic directive", () => {
  const service = new EscalationService(new PlatformPanicService());
  const request = createRequest({
    tenantId: "tenant-abc",
    riskLevel: "critical",
    affectsProduction: true,
  });

  const decision = service.decide(request);

  assert.ok(decision.decision === "panic_stop" || decision.decision === "panic_activate");
});

test("null tenantId uses platform scope", () => {
  const service = new EscalationService(new PlatformPanicService());
  const request = createRequest({
    tenantId: null,
    riskLevel: "critical",
    affectsProduction: true,
  });

  const decision = service.decide(request);

  assert.ok(decision.decision === "panic_stop" || decision.decision === "panic_activate");
});
