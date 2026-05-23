import { strict as assert } from "node:assert";
import { test } from "node:test";

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

function makeOperationalDirective(
  overrides: Partial<OperationalDirective> = {},
): OperationalDirective {
  return createOperationalDirective({
    type: "pause",
    scope: { tenantId: "tenant-1" },
    issuedBy: {
      principalId: "principal-1",
      tenantId: "tenant-1",
      roles: ["operator"],
    },
    reason: "test directive",
    params: {},
    ...overrides,
  });
}

function makeDecisionDirective(
  overrides: Partial<DecisionDirective> = {},
): DecisionDirective {
  return createDecisionDirective({
    type: "approve",
    scope: { tenantId: "tenant-1" },
    issuedBy: {
      principalId: "principal-1",
      tenantId: "tenant-1",
      roles: ["approver"],
    },
    targetRef: "task-123",
    payload: { approved: true },
    reason: "test decision",
    riskAcknowledged: true,
    ...overrides,
  });
}

test("NoOpControlPlaneDirectiveSink implements ControlPlaneDirectiveSink interface", () => {
  const sink = new NoOpControlPlaneDirectiveSink();
  assert.ok(sink instanceof NoOpControlPlaneDirectiveSink);
  assert.ok(typeof sink.emitOperationalDirective === "function");
  assert.ok(typeof sink.emitDecisionDirective === "function");
});

test("NoOpControlPlaneDirectiveSink accepts canonical directives", () => {
  const sink = new NoOpControlPlaneDirectiveSink();
  assert.doesNotThrow(() => sink.emitOperationalDirective(makeOperationalDirective()));
  assert.doesNotThrow(() => sink.emitDecisionDirective(makeDecisionDirective()));
});

test("NoOpControlPlaneDirectiveSink returns undefined for both emit methods", () => {
  const sink = new NoOpControlPlaneDirectiveSink();
  assert.equal(sink.emitOperationalDirective(makeOperationalDirective({ type: "kill", reason: "emergency" })), undefined);
  assert.equal(
    sink.emitDecisionDirective(
      makeDecisionDirective({
        type: "deny",
        payload: { denied: true, reason: "policy violation" },
        reason: "policy violation",
        riskAcknowledged: false,
      }),
    ),
    undefined,
  );
});

test("createNoOpDirectiveSink returns independent sink instances", () => {
  const sink1 = createNoOpDirectiveSink();
  const sink2 = createNoOpDirectiveSink();
  assert.ok(sink1 instanceof NoOpControlPlaneDirectiveSink);
  assert.ok(sink2 instanceof NoOpControlPlaneDirectiveSink);
  assert.notEqual(sink1, sink2);
});

test("NoOpControlPlaneDirectiveSink handles all canonical operational directive types", () => {
  const sink = new NoOpControlPlaneDirectiveSink();
  const directiveTypes: OperationalDirective["type"][] = [
    "mode_switch",
    "pause",
    "resume",
    "quota_adjust",
    "kill",
    "rollback",
  ];

  for (const type of directiveTypes) {
    assert.doesNotThrow(() => sink.emitOperationalDirective(makeOperationalDirective({ type, reason: `test ${type}` })));
  }
});

test("NoOpControlPlaneDirectiveSink handles all canonical decision directive types", () => {
  const sink = new NoOpControlPlaneDirectiveSink();
  const directiveTypes: DecisionDirective["type"][] = [
    "approve",
    "deny",
    "override",
    "patch",
    "takeover",
    "expire_approval",
  ];

  for (const type of directiveTypes) {
    assert.doesNotThrow(() => sink.emitDecisionDirective(makeDecisionDirective({ type, reason: `test ${type}` })));
  }
});

test("NoOpControlPlaneDirectiveSink handles directives with full scope", () => {
  const sink = new NoOpControlPlaneDirectiveSink();
  assert.doesNotThrow(() => sink.emitOperationalDirective(makeOperationalDirective({
    type: "quota_adjust",
    scope: {
      tenantId: "tenant-1",
      harnessRunId: "harness-123",
      nodeRunId: "node-456",
      workerId: "worker-789",
    },
    issuedBy: {
      principalId: "principal-1",
      tenantId: "tenant-1",
      roles: ["admin", "operator"],
    },
    reason: "adjust quota",
    params: { quotaIncrease: 100 },
    expiresAt: "2024-12-31T23:59:59.000Z",
  })));
  assert.doesNotThrow(() => sink.emitDecisionDirective(makeDecisionDirective({
    type: "takeover",
    scope: {
      tenantId: "tenant-1",
      harnessRunId: "harness-123",
      nodeRunId: "node-456",
      humanResponsibilityRecordId: "hrr-789",
    },
    issuedBy: {
      principalId: "principal-1",
      tenantId: "tenant-1",
      roles: ["admin", "supervisor"],
      displayName: "Admin User",
    },
    targetRef: "execution-123",
    payload: { reason: "human takeover required" },
    reason: "safety review required",
  })));
});

test("createNoOpDirectiveSink can be consumed as ControlPlaneDirectiveSink", () => {
  function consumeSink(sink: ControlPlaneDirectiveSink): void {
    sink.emitOperationalDirective(makeOperationalDirective());
    sink.emitDecisionDirective(makeDecisionDirective());
  }

  assert.doesNotThrow(() => consumeSink(createNoOpDirectiveSink()));
});
