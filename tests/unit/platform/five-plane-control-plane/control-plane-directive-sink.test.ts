import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  NoOpControlPlaneDirectiveSink,
  createNoOpDirectiveSink,
  type ControlPlaneDirectiveSink,
} from "../../../../src/platform/five-plane-control-plane/control-plane-directive-sink.js";
import type {
  DecisionDirective,
  OperationalDirective,
} from "../../../../src/platform/contracts/control-directive/index.js";

test("NoOpControlPlaneDirectiveSink implements ControlPlaneDirectiveSink interface", () => {
  const sink = new NoOpControlPlaneDirectiveSink();
  assert.ok(sink instanceof NoOpControlPlaneDirectiveSink);
  assert.ok(typeof sink.emitOperationalDirective === "function");
  assert.ok(typeof sink.emitDecisionDirective === "function");
});

test("NoOpControlPlaneDirectiveSink.emitOperationalDirective does not throw", () => {
  const sink = new NoOpControlPlaneDirectiveSink();
  const directive: OperationalDirective = {
    operationalDirectiveId: "opdir-123",
    type: "pause",
    scope: { tenantId: "tenant-1" },
    issuedBy: {
      principalId: "principal-1",
      tenantId: "tenant-1",
      roles: ["admin"],
    },
    reason: "test pause",
    params: {},
    createdAt: "2024-01-01T00:00:00.000Z",
  };
  assert.doesNotThrow(() => sink.emitOperationalDirective(directive));
});

test("NoOpControlPlaneDirectiveSink.emitDecisionDirective does not throw", () => {
  const sink = new NoOpControlPlaneDirectiveSink();
  const directive: DecisionDirective = {
    decisionDirectiveId: "decDir-123",
    type: "approve",
    scope: { tenantId: "tenant-1" },
    issuedBy: {
      principalId: "principal-1",
      tenantId: "tenant-1",
      roles: ["admin"],
    },
    targetRef: "task-123",
    payload: { approved: true },
    reason: "test approval",
    riskAcknowledged: true,
    createdAt: "2024-01-01T00:00:00.000Z",
  };
  assert.doesNotThrow(() => sink.emitDecisionDirective(directive));
});

test("NoOpControlPlaneDirectiveSink.emitOperationalDirective returns undefined", () => {
  const sink = new NoOpControlPlaneDirectiveSink();
  const directive: OperationalDirective = {
    operationalDirectiveId: "opdir-456",
    type: "kill",
    scope: {},
    issuedBy: {
      principalId: "principal-1",
      tenantId: "tenant-1",
      roles: ["operator"],
    },
    reason: "emergency kill",
    params: { force: true },
    createdAt: "2024-01-01T00:00:00.000Z",
  };
  const result = sink.emitOperationalDirective(directive);
  assert.equal(result, undefined);
});

test("NoOpControlPlaneDirectiveSink.emitDecisionDirective returns undefined", () => {
  const sink = new NoOpControlPlaneDirectiveSink();
  const directive: DecisionDirective = {
    decisionDirectiveId: "decDir-456",
    type: "deny",
    scope: {},
    issuedBy: {
      principalId: "principal-1",
      tenantId: "tenant-1",
      roles: ["approver"],
    },
    targetRef: "task-456",
    payload: { denied: true, reason: "policy violation" },
    reason: "policy violation",
    riskAcknowledged: false,
    createdAt: "2024-01-01T00:00:00.000Z",
  };
  const result = sink.emitDecisionDirective(directive);
  assert.equal(result, undefined);
});

test("createNoOpDirectiveSink returns NoOpControlPlaneDirectiveSink instance", () => {
  const sink = createNoOpDirectiveSink();
  assert.ok(sink instanceof NoOpControlPlaneDirectiveSink);
});

test("createNoOpDirectiveSink returns working directive sink", () => {
  const sink = createNoOpDirectiveSink();
  const directive: OperationalDirective = {
    operationalDirectiveId: "opdir-789",
    type: "resume",
    scope: { tenantId: "tenant-2" },
    issuedBy: {
      principalId: "principal-2",
      tenantId: "tenant-2",
      roles: ["operator"],
    },
    reason: "resume operation",
    params: {},
    createdAt: "2024-01-01T00:00:00.000Z",
  };
  assert.doesNotThrow(() => sink.emitOperationalDirective(directive));
});

test("multiple calls to createNoOpDirectiveSink return independent instances", () => {
  const sink1 = createNoOpDirectiveSink();
  const sink2 = createNoOpDirectiveSink();
  assert.ok(sink1 !== sink2, "each call should return a new instance");
});

test("NoOpControlPlaneDirectiveSink handles directive with all directive types", () => {
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
    const directive: OperationalDirective = {
      operationalDirectiveId: `opdir-${type}`,
      type,
      scope: {},
      issuedBy: {
        principalId: "principal-1",
        tenantId: "tenant-1",
        roles: ["admin"],
      },
      reason: `test ${type}`,
      params: {},
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    assert.doesNotThrow(
      () => sink.emitOperationalDirective(directive),
      `emitOperationalDirective should not throw for type ${type}`,
    );
  }
});

test("NoOpControlPlaneDirectiveSink handles decision directive types", () => {
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
    const directive: DecisionDirective = {
      decisionDirectiveId: `decDir-${type}`,
      type,
      scope: {},
      issuedBy: {
        principalId: "principal-1",
        tenantId: "tenant-1",
        roles: ["admin"],
      },
      targetRef: "task-123",
      payload: {},
      reason: `test ${type}`,
      riskAcknowledged: false,
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    assert.doesNotThrow(
      () => sink.emitDecisionDirective(directive),
      `emitDecisionDirective should not throw for type ${type}`,
    );
  }
});

test("NoOpControlPlaneDirectiveSink handles directives with complex scope", () => {
  const sink = new NoOpControlPlaneDirectiveSink();

  const directive: OperationalDirective = {
    operationalDirectiveId: "opdir-complex",
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
    reason: "adjust quota for production",
    params: { quotaIncrease: 100 },
    createdAt: "2024-01-01T00:00:00.000Z",
    expiresAt: "2024-12-31T23:59:59.000Z",
  };

  assert.doesNotThrow(() => sink.emitOperationalDirective(directive));
});

test("NoOpControlPlaneDirectiveSink handles decision directive with full scope", () => {
  const sink = new NoOpControlPlaneDirectiveSink();

  const directive: DecisionDirective = {
    decisionDirectiveId: "decDir-complex",
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
    riskAcknowledged: true,
    createdAt: "2024-01-01T00:00:00.000Z",
  };

  assert.doesNotThrow(() => sink.emitDecisionDirective(directive));
});

test("createNoOpDirectiveSink can be used where ControlPlaneDirectiveSink is expected", () => {
  function consumeSink(sink: ControlPlaneDirectiveSink): void {
    const directive: OperationalDirective = {
      operationalDirectiveId: "opdir-test",
      type: "pause",
      scope: {},
      issuedBy: {
        principalId: "principal-1",
        tenantId: "tenant-1",
        roles: [],
      },
      reason: "test",
      params: {},
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    sink.emitOperationalDirective(directive);
  }

  const sink = createNoOpDirectiveSink();
  assert.doesNotThrow(() => consumeSink(sink));
});
