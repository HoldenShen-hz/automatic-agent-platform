import assert from "node:assert/strict";
import test from "node:test";

import {
  NoOpControlPlaneDirectiveSink,
  createNoOpDirectiveSink,
  type ControlPlaneDirectiveSink,
} from "../../../../../src/platform/control-plane/control-plane-directive-sink.js";
import type { DecisionDirective, OperationalDirective } from "../../../../../src/platform/contracts/control-directive/index.js";

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
  sink.emitOperationalDirective({
    directiveId: "op-1",
    directiveType: "rollout_control",
    payload: { action: "freeze" },
    emittedAt: Date.now(),
    sourcePlane: "control-plane",
    targetPlane: "execution",
  });
  // No error thrown, nothing happens
});

test("control-plane-directive-sink: NoOpControlPlaneDirectiveSink.emitDecisionDirective does nothing", () => {
  const sink = new NoOpControlPlaneDirectiveSink();
  sink.emitDecisionDirective({
    decisionId: "dec-1",
    decisionType: "approval",
    outcome: "approved",
    payload: { taskId: "task-1" },
    decidedAt: Date.now(),
    decidingPlane: "control-plane",
  });
  // No error thrown, nothing happens
});

test("control-plane-directive-sink: createNoOpDirectiveSink returns NoOpControlPlaneDirectiveSink instance", () => {
  const sink = createNoOpDirectiveSink();
  assert.ok(sink instanceof NoOpControlPlaneDirectiveSink);
});

test("control-plane-directive-sink: TestControlPlaneDirectiveSink records operational directives", () => {
  const sink = new TestControlPlaneDirectiveSink();
  const directive: OperationalDirective = {
    directiveId: "op-2",
    directiveType: "incident_control",
    payload: { action: "escalate", severity: "high" },
    emittedAt: Date.now(),
    sourcePlane: "control-plane",
    targetPlane: "execution",
  };

  sink.emitOperationalDirective(directive);
  assert.equal(sink.operationalDirectives.length, 1);
  assert.equal(sink.operationalDirectives[0].directiveId, "op-2");
});

test("control-plane-directive-sink: TestControlPlaneDirectiveSink records decision directives", () => {
  const sink = new TestControlPlaneDirectiveSink();
  const directive: DecisionDirective = {
    decisionId: "dec-2",
    decisionType: "risk_evaluation",
    outcome: "deny",
    payload: { taskId: "task-2", reason: "budget_exceeded" },
    decidedAt: Date.now(),
    decidingPlane: "control-plane",
  };

  sink.emitDecisionDirective(directive);
  assert.equal(sink.decisionDirectives.length, 1);
  assert.equal(sink.decisionDirectives[0].decisionId, "dec-2");
});

test("control-plane-directive-sink: NoOpControlPlaneDirectiveSink can be used in a loop safely", () => {
  const sinks: ControlPlaneDirectiveSink[] = [];
  for (let i = 0; i < 10; i++) {
    sinks.push(createNoOpDirectiveSink());
  }

  for (const sink of sinks) {
    sink.emitOperationalDirective({
      directiveId: `op-${Math.random()}`,
      directiveType: "test",
      payload: {},
      emittedAt: Date.now(),
      sourcePlane: "control-plane",
      targetPlane: "execution",
    });
    sink.emitDecisionDirective({
      decisionId: `dec-${Math.random()}`,
      decisionType: "test",
      outcome: "approved",
      payload: {},
      decidedAt: Date.now(),
      decidingPlane: "control-plane",
    });
  }
  // No errors thrown
});

test("control-plane-directive-sink: NoOpControlPlaneDirectiveSink multiple calls don't cause issues", () => {
  const sink = createNoOpDirectiveSink();

  for (let i = 0; i < 100; i++) {
    sink.emitOperationalDirective({
      directiveId: `op-${i}`,
      directiveType: "stress_test",
      payload: { iteration: i },
      emittedAt: Date.now(),
      sourcePlane: "control-plane",
      targetPlane: "execution",
    });
  }

  // No errors, all calls are no-ops
});