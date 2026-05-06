/**
 * Control Directive Contract Unit Tests
 *
 * Tests the control directive creation and validation logic, including:
 * - Legacy ControlDirective types (deprecated)
 * - Canonical OperationalDirective and DecisionDirective types
 * - Contract envelope wrapping for directives
 *
 * @see src/platform/contracts/control-directive/index.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  // Legacy (deprecated)
  createControlDirective,
  type ControlDirectiveKind,
  type ControlDirective,
  // Canonical
  createOperationalDirective,
  createDecisionDirective,
  type OperationalDirectiveType,
  type OperationalDirectiveScope,
  type OperationalDirective,
  type DecisionDirectiveType,
  type DecisionDirectiveScope,
  type DecisionDirective,
} from "../../../../src/platform/contracts/control-directive/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

// =============================================================================
// Legacy ControlDirective Tests (Deprecated)
// =============================================================================

test("control-directive: createControlDirective rejects legacy pause directives", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "pause",
        targetRef: "task_123",
        reasonCode: "operator_request",
        issuedBy: "operator_1",
        tenantId: null,
        executionId: null,
        metadata: {},
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "platform_contracts.legacy_control_directive_forbidden",
  );
});

test("control-directive: createControlDirective rejects legacy resume directives", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "resume",
        targetRef: "task_456",
        reasonCode: "issue_resolved",
        issuedBy: "system",
        tenantId: "tenant_abc",
        executionId: "exec_789",
        metadata: { resumeReason: "manual" },
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "platform_contracts.legacy_control_directive_forbidden",
  );
});

test("control-directive: createControlDirective throws when targetRef is empty", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "pause",
        targetRef: "",
        reasonCode: "operator_request",
        issuedBy: "operator_1",
        tenantId: null,
        executionId: null,
        metadata: {},
      }),
    ValidationError,
  );
});

test("control-directive: createControlDirective throws when reasonCode is empty", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "cancel",
        targetRef: "task_123",
        reasonCode: "   ",
        issuedBy: "operator_1",
        tenantId: null,
        executionId: null,
        metadata: {},
      }),
    ValidationError,
  );
});

test("control-directive: createControlDirective throws when issuedBy is empty", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "rollback",
        targetRef: "task_123",
        reasonCode: "failure",
        issuedBy: "",
        tenantId: null,
        executionId: null,
        metadata: {},
      }),
    ValidationError,
  );
});

test("control-directive: createControlDirective accepts rollback kind", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "rollback",
        targetRef: "exec_abc",
        reasonCode: "critical_failure",
        issuedBy: "system",
        tenantId: null,
        executionId: "exec_abc",
        metadata: {},
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "platform_contracts.legacy_control_directive_forbidden",
  );
});

test("control-directive: createControlDirective accepts escalate kind", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "escalate",
        targetRef: "task_789",
        reasonCode: "human_review_required",
        issuedBy: "ai_agent",
        tenantId: null,
        executionId: null,
        metadata: {},
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "platform_contracts.legacy_control_directive_forbidden",
  );
});

test("control-directive: createControlDirective rejects even fully populated legacy directives", () => {
  assert.throws(
    () =>
      createControlDirective({
        kind: "pause",
        targetRef: "task_123",
        reasonCode: "operator_request",
        issuedBy: "operator_1",
        tenantId: null,
        executionId: null,
        metadata: {},
        directiveId: "custom_directive",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "platform_contracts.legacy_control_directive_forbidden",
  );
});

// =============================================================================
// ControlDirectiveKind Union Tests
// =============================================================================

test("control-directive: ControlDirectiveKind union contains expected values", () => {
  const kinds: ControlDirectiveKind[] = ["pause", "resume", "cancel", "rollback", "escalate"];

  for (const kind of kinds) {
    const directive: ControlDirective = {
      directiveId: `dir_${kind}`,
      kind,
      targetRef: "ref_test",
      reasonCode: "test_reason",
      issuedBy: "test_user",
      tenantId: null,
      executionId: null,
      metadata: {},
      createdAt: "2026-05-01T00:00:00.000Z",
    };
    assert.equal(directive.kind, kind);
  }
});

// =============================================================================
// OperationalDirective Tests (Canonical)
// =============================================================================

test("control-directive: createOperationalDirective creates valid pause directive", () => {
  const directive = createOperationalDirective({
    type: "pause",
    issuedBy: {
      principalId: "operator_1",
      tenantId: "tenant_abc",
      roles: ["operator"],
    },
    reason: "System maintenance scheduled",
  });

  assert.ok(directive.operationalDirectiveId.startsWith("opdir_"));
  assert.equal(directive.type, "pause");
  assert.equal(directive.issuedBy.principalId, "operator_1");
  assert.equal(directive.reason, "System maintenance scheduled");
  assert.deepEqual(directive.scope, {});
});

test("control-directive: createOperationalDirective creates resume directive", () => {
  const directive = createOperationalDirective({
    type: "resume",
    scope: {
      tenantId: "tenant_resume",
      harnessRunId: "hrun_123",
    },
    issuedBy: {
      principalId: "system",
      tenantId: "tenant_resume",
      roles: ["system"],
    },
    reason: "Maintenance completed",
  });

  assert.equal(directive.type, "resume");
  assert.equal(directive.scope.tenantId, "tenant_resume");
  assert.equal(directive.scope.harnessRunId, "hrun_123");
});

test("control-directive: createOperationalDirective creates kill directive", () => {
  const directive = createOperationalDirective({
    type: "kill",
    scope: {
      nodeRunId: "nrun_emergency",
      workerId: "worker_1",
    },
    issuedBy: {
      principalId: "admin",
      tenantId: "tenant_admin",
      roles: ["admin"],
    },
    reason: "Emergency stop - resource leak detected",
  });

  assert.equal(directive.type, "kill");
  assert.equal(directive.scope.nodeRunId, "nrun_emergency");
  assert.equal(directive.scope.workerId, "worker_1");
});

test("control-directive: createOperationalDirective creates mode_switch directive", () => {
  const directive = createOperationalDirective({
    type: "mode_switch",
    params: {
      fromMode: "production",
      toMode: "maintenance",
    },
    issuedBy: {
      principalId: "admin",
      tenantId: "tenant_admin",
      roles: ["admin"],
    },
    reason: "Scheduled maintenance window",
  });

  assert.equal(directive.type, "mode_switch");
  assert.deepEqual(directive.params, { fromMode: "production", toMode: "maintenance" });
});

test("control-directive: createOperationalDirective creates quota_adjust directive", () => {
  const directive = createOperationalDirective({
    type: "quota_adjust",
    params: {
      resourceKind: "token",
      newLimit: 5000,
    },
    issuedBy: {
      principalId: "billing_admin",
      tenantId: "tenant_billing",
      roles: ["admin"],
    },
    reason: "Quota increase requested",
  });

  assert.equal(directive.type, "quota_adjust");
  assert.equal(directive.params.newLimit, 5000);
});

test("control-directive: createOperationalDirective creates rollback directive", () => {
  const directive = createOperationalDirective({
    type: "rollback",
    scope: {
      harnessRunId: "hrun_rollback",
    },
    issuedBy: {
      principalId: "system",
      tenantId: "tenant_rollback",
      roles: ["system"],
    },
    reason: "Critical failure - automatic rollback",
  });

  assert.equal(directive.type, "rollback");
  assert.equal(directive.scope.harnessRunId, "hrun_rollback");
});

test("control-directive: createOperationalDirective throws when type is empty", () => {
  assert.throws(
    () =>
      createOperationalDirective({
        type: "   " as OperationalDirectiveType,
        issuedBy: {
          principalId: "user",
          tenantId: "tenant",
          roles: [],
        },
        reason: "test",
      }),
    ValidationError,
  );
});

test("control-directive: OperationalDirectiveType union contains expected values", () => {
  const types: OperationalDirectiveType[] = [
    "mode_switch",
    "pause",
    "resume",
    "quota_adjust",
    "kill",
    "rollback",
  ];

  for (const type of types) {
    const directive = createOperationalDirective({
      type,
      issuedBy: {
        principalId: "test_user",
        tenantId: "test_tenant",
        roles: [],
      },
      reason: "test reason",
    });
    assert.equal(directive.type, type);
  }
});

// =============================================================================
// DecisionDirective Tests (Canonical)
// =============================================================================

test("control-directive: createDecisionDirective creates approve directive", () => {
  const directive = createDecisionDirective({
    type: "approve",
    targetRef: "task_123",
    payload: { riskAcknowledged: true },
    issuedBy: {
      principalId: "approver_1",
      tenantId: "tenant_abc",
      roles: ["approver"],
    },
    reason: "Risk accepted after review",
    riskAcknowledged: true,
  });

  assert.ok(directive.decisionDirectiveId.startsWith("decDir_"));
  assert.equal(directive.type, "approve");
  assert.equal(directive.targetRef, "task_123");
  assert.equal(directive.riskAcknowledged, true);
});

test("control-directive: createDecisionDirective creates deny directive", () => {
  const directive = createDecisionDirective({
    type: "deny",
    targetRef: "task_456",
    payload: { denialReason: "policy_violation" },
    issuedBy: {
      principalId: "security_team",
      tenantId: "tenant_security",
      roles: ["security"],
    },
    reason: "Policy violation detected",
  });

  assert.equal(directive.type, "deny");
  assert.equal(directive.riskAcknowledged, false);
});

test("control-directive: createDecisionDirective creates override directive", () => {
  const directive = createDecisionDirective({
    type: "override",
    targetRef: "harness_run_789",
    payload: { overrideReason: "business_necessity" },
    issuedBy: {
      principalId: "director",
      tenantId: "tenant_exec",
      roles: ["director", "admin"],
      displayName: "John Director",
    },
    reason: "Business necessity override",
    riskAcknowledged: true,
  });

  assert.equal(directive.type, "override");
  assert.equal(directive.issuedBy.displayName, "John Director");
});

test("control-directive: createDecisionDirective creates patch directive", () => {
  const directive = createDecisionDirective({
    type: "patch",
    targetRef: "node_123",
    payload: {
      patchType: "skip_node",
      reason: "dependency_unavailable",
    },
    issuedBy: {
      principalId: "ai_agent",
      tenantId: "tenant_ai",
      roles: ["agent"],
    },
    reason: "Node dependencies unavailable",
  });

  assert.equal(directive.type, "patch");
  assert.deepEqual(directive.payload, {
    patchType: "skip_node",
    reason: "dependency_unavailable",
  });
});

test("control-directive: createDecisionDirective creates takeover directive", () => {
  const directive = createDecisionDirective({
    type: "takeover",
    targetRef: "harness_run_abc",
    payload: { targetAgent: "human_agent_1" },
    issuedBy: {
      principalId: "supervisor",
      tenantId: "tenant_supervisor",
      roles: ["supervisor"],
    },
    reason: "Human takeover requested",
  });

  assert.equal(directive.type, "takeover");
  assert.equal(directive.payload.targetAgent, "human_agent_1");
});

test("control-directive: createDecisionDirective creates expire_approval directive", () => {
  const directive = createDecisionDirective({
    type: "expire_approval",
    targetRef: "approval_xyz",
    payload: { expiredAt: "2026-05-01T12:00:00.000Z" },
    issuedBy: {
      principalId: "system",
      tenantId: "tenant_system",
      roles: ["system"],
    },
    reason: "Approval window expired",
    expiresAt: "2026-05-01T12:00:00.000Z",
  });

  assert.equal(directive.type, "expire_approval");
  assert.equal(directive.expiresAt, "2026-05-01T12:00:00.000Z");
});

test("control-directive: createDecisionDirective throws when type is empty", () => {
  assert.throws(
    () =>
      createDecisionDirective({
        type: "" as DecisionDirectiveType,
        targetRef: "ref_test",
        payload: {},
        issuedBy: {
          principalId: "user",
          tenantId: "tenant",
          roles: [],
        },
        reason: "test",
      }),
    ValidationError,
  );
});

test("control-directive: createDecisionDirective throws when targetRef is empty", () => {
  assert.throws(
    () =>
      createDecisionDirective({
        type: "approve",
        targetRef: "   ",
        payload: {},
        issuedBy: {
          principalId: "user",
          tenantId: "tenant",
          roles: [],
        },
        reason: "test",
      }),
    ValidationError,
  );
});

test("control-directive: createDecisionDirective defaults riskAcknowledged to false", () => {
  const directive = createDecisionDirective({
    type: "approve",
    targetRef: "task_test",
    payload: {},
    issuedBy: {
      principalId: "user",
      tenantId: "tenant",
      roles: [],
    },
    reason: "test",
  });

  assert.equal(directive.riskAcknowledged, false);
});

test("control-directive: DecisionDirectiveType union contains expected values", () => {
  const types: DecisionDirectiveType[] = [
    "approve",
    "deny",
    "override",
    "patch",
    "takeover",
    "expire_approval",
  ];

  for (const type of types) {
    const directive = createDecisionDirective({
      type,
      targetRef: `ref_${type}`,
      payload: {},
      issuedBy: {
        principalId: "test_user",
        tenantId: "test_tenant",
        roles: [],
      },
      reason: "test reason",
    });
    assert.equal(directive.type, type);
  }
});

// =============================================================================
// OperationalDirectiveScope Tests
// =============================================================================

test("control-directive: OperationalDirectiveScope allows partial scope", () => {
  // Only tenantId
  const scope1: OperationalDirectiveScope = {
    tenantId: "tenant_only",
  };
  assert.equal(scope1.tenantId, "tenant_only");

  // Only harnessRunId
  const scope2: OperationalDirectiveScope = {
    harnessRunId: "hrun_only",
  };
  assert.equal(scope2.harnessRunId, "hrun_only");

  // Only nodeRunId
  const scope3: OperationalDirectiveScope = {
    nodeRunId: "nrun_only",
  };
  assert.equal(scope3.nodeRunId, "nrun_only");

  // Only workerId
  const scope4: OperationalDirectiveScope = {
    workerId: "worker_only",
  };
  assert.equal(scope4.workerId, "worker_only");
});

// =============================================================================
// DecisionDirectiveScope Tests
// =============================================================================

test("control-directive: DecisionDirectiveScope allows partial scope", () => {
  // Only tenantId
  const scope1: DecisionDirectiveScope = {
    tenantId: "tenant_1",
  };
  assert.equal(scope1.tenantId, "tenant_1");

  // Only humanResponsibilityRecordId
  const scope2: DecisionDirectiveScope = {
    humanResponsibilityRecordId: "hrrec_123",
  };
  assert.equal(scope2.humanResponsibilityRecordId, "hrrec_123");
});

// =============================================================================
// Canonical Directive Readonly Contract Verification
// =============================================================================

test("control-directive: OperationalDirective has readonly properties", () => {
  const directive = createOperationalDirective({
    type: "pause",
    issuedBy: {
      principalId: "user",
      tenantId: "tenant",
      roles: [],
    },
    reason: "test",
  });

  // Verify structure - properties should be accessible
  assert.ok(directive.operationalDirectiveId);
  assert.ok(directive.type);
  assert.ok(directive.issuedBy);
  assert.ok(directive.reason);
  assert.ok(directive.params);
  assert.ok(directive.createdAt);
});

test("control-directive: DecisionDirective has readonly properties", () => {
  const directive = createDecisionDirective({
    type: "approve",
    targetRef: "ref_test",
    payload: {},
    issuedBy: {
      principalId: "user",
      tenantId: "tenant",
      roles: [],
    },
    reason: "test",
  });

  // Verify structure - properties should be accessible
  assert.ok(directive.decisionDirectiveId);
  assert.ok(directive.type);
  assert.ok(directive.targetRef);
  assert.ok(directive.payload);
  assert.ok(directive.issuedBy);
  assert.ok(directive.reason);
  assert.equal(directive.riskAcknowledged, false);
  assert.ok(directive.createdAt);
});

// =============================================================================
// Typed Params and Payload Tests
// =============================================================================

test("control-directive: OperationalDirective with typed params", () => {
  interface ModeSwitchParams {
    fromMode: string;
    toMode: string;
  }

  const directive = createOperationalDirective<ModeSwitchParams>({
    type: "mode_switch",
    issuedBy: {
      principalId: "admin",
      tenantId: "tenant",
      roles: ["admin"],
    },
    reason: "mode change",
    params: {
      fromMode: "prod",
      toMode: "dev",
    },
  });

  assert.equal(directive.params.fromMode, "prod");
  assert.equal(directive.params.toMode, "dev");
});

test("control-directive: DecisionDirective with typed payload", () => {
  interface ApprovalPayload {
    approvedBy: string;
    comments?: string;
  }

  const directive = createDecisionDirective<ApprovalPayload>({
    type: "approve",
    targetRef: "task_123",
    payload: {
      approvedBy: "manager_1",
      comments: "LGTM",
    },
    issuedBy: {
      principalId: "manager_1",
      tenantId: "tenant",
      roles: ["manager"],
    },
    reason: "Approved after review",
  });

  assert.equal(directive.payload.approvedBy, "manager_1");
  assert.equal(directive.payload.comments, "LGTM");
});
