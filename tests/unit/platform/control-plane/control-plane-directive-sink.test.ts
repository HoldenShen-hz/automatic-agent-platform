import assert from "node:assert/strict";
import test from "node:test";

import {
  NoOpControlPlaneDirectiveSink,
  createNoOpDirectiveSink,
  type ControlPlaneDirectiveSink,
} from "../../../../src/platform/five-plane-control-plane/control-plane-directive-sink.js";
import {
  createDecisionDirective,
  createOperationalDirective,
  type DecisionDirective,
  type OperationalDirective,
} from "../../../../src/platform/contracts/control-directive/index.js";

// Test-specific concrete implementation for interface testing
class TestControlPlaneDirectiveSink implements ControlPlaneDirectiveSink {
  public operationalDirectives: OperationalDirective[] = [];
  public decisionDirectives: DecisionDirective[] = [];

  emitOperationalDirective(directive: OperationalDirective): void {
    this.operationalDirectives.push(directive);
  }

  emitDecisionDirective(directive: DecisionDirective): void {
    this.decisionDirectives.push(directive);
  }
}

test("control-plane-directive-sink: NoOpControlPlaneDirectiveSink implements ControlPlaneDirectiveSink", () => {
  const sink = new NoOpControlPlaneDirectiveSink();
  assert.ok(typeof sink.emitOperationalDirective === "function");
  assert.ok(typeof sink.emitDecisionDirective === "function");
});

test("control-plane-directive-sink: NoOpControlPlaneDirectiveSink.emitOperationalDirective does nothing", () => {
  const sink = new NoOpControlPlaneDirectiveSink();
  assert.doesNotThrow(() => sink.emitOperationalDirective(createOperationalDirective({
    type: "pause",
    scope: { tenantId: "tenant-1" },
    issuedBy: { principalId: "ops-1", tenantId: "tenant-1", roles: ["operator"] },
    reason: "freeze rollout",
    params: { action: "freeze" },
  })));
});

test("control-plane-directive-sink: NoOpControlPlaneDirectiveSink.emitDecisionDirective does nothing", () => {
  const sink = new NoOpControlPlaneDirectiveSink();
  assert.doesNotThrow(() => sink.emitDecisionDirective(createDecisionDirective({
    type: "approve",
    scope: { tenantId: "tenant-1" },
    issuedBy: { principalId: "ops-1", tenantId: "tenant-1", roles: ["approver"] },
    targetRef: "task://task-1",
    payload: { taskId: "task-1" },
    reason: "approved by test",
  })));
});

test("control-plane-directive-sink: createNoOpDirectiveSink returns NoOpControlPlaneDirectiveSink instance", () => {
  const sink = createNoOpDirectiveSink();
  assert.ok(sink instanceof NoOpControlPlaneDirectiveSink);
});

test("control-plane-directive-sink: TestControlPlaneDirectiveSink records operational directives", () => {
  const sink = new TestControlPlaneDirectiveSink();
  const directive: OperationalDirective = createOperationalDirective({
    type: "kill",
    scope: { tenantId: "tenant-1" },
    issuedBy: { principalId: "ops-2", tenantId: "tenant-1", roles: ["operator"] },
    reason: "escalate",
    params: { severity: "high" },
  });

  sink.emitOperationalDirective(directive);
  const [recordedDirective] = sink.operationalDirectives;
  assert.equal(sink.operationalDirectives.length, 1);
  assert.ok(recordedDirective);
  assert.equal(recordedDirective.operationalDirectiveId, directive.operationalDirectiveId);
});

test("control-plane-directive-sink: TestControlPlaneDirectiveSink records decision directives", () => {
  const sink = new TestControlPlaneDirectiveSink();
  const directive: DecisionDirective = createDecisionDirective({
    type: "deny",
    scope: { tenantId: "tenant-1" },
    issuedBy: { principalId: "ops-2", tenantId: "tenant-1", roles: ["approver"] },
    targetRef: "task://task-2",
    payload: { taskId: "task-2", reason: "budget_exceeded" },
    reason: "budget exceeded",
  });

  sink.emitDecisionDirective(directive);
  const [recordedDirective] = sink.decisionDirectives;
  assert.equal(sink.decisionDirectives.length, 1);
  assert.ok(recordedDirective);
  assert.equal(recordedDirective.decisionDirectiveId, directive.decisionDirectiveId);
});

test("control-plane-directive-sink: NoOpControlPlaneDirectiveSink can be used in a loop safely", () => {
  const sinks: ControlPlaneDirectiveSink[] = [];
  for (let i = 0; i < 10; i++) {
    sinks.push(createNoOpDirectiveSink());
  }

  for (const sink of sinks) {
    assert.doesNotThrow(() => sink.emitOperationalDirective(createOperationalDirective({
      type: "resume",
      scope: { tenantId: "tenant-1" },
      issuedBy: { principalId: "ops-loop", tenantId: "tenant-1", roles: ["operator"] },
      reason: "loop safety",
    })));
    assert.doesNotThrow(() => sink.emitDecisionDirective(createDecisionDirective({
      type: "approve",
      scope: { tenantId: "tenant-1" },
      issuedBy: { principalId: "ops-loop", tenantId: "tenant-1", roles: ["approver"] },
      targetRef: "task://loop",
      payload: {},
      reason: "loop safety",
    })));
  }
  assert.equal(sinks.length, 10);
});

test("control-plane-directive-sink: NoOpControlPlaneDirectiveSink multiple calls don't cause issues", () => {
  const sink = createNoOpDirectiveSink();

  for (let i = 0; i < 100; i++) {
    assert.doesNotThrow(() => sink.emitOperationalDirective(createOperationalDirective({
      type: "quota_adjust",
      scope: { tenantId: "tenant-1" },
      issuedBy: { principalId: "ops-stress", tenantId: "tenant-1", roles: ["operator"] },
      reason: "stress test",
      params: { iteration: i },
    })));
  }
});
