import assert from "node:assert/strict";
import test from "node:test";

import {
  ERROR_CLASS_TO_EXCEPTION_TYPE,
  CATEGORY_TO_EXCEPTION_TYPE,
  type ExceptionType,
  type ExceptionStrategy,
  type RiskLevel,
  type RiskLevelStrategy,
  type AttemptThresholds,
  type ExceptionRecoveryConfig,
} from "../../../../../src/platform/five-plane-execution/recovery/exception-recovery-types.js";

test("ERROR_CLASS_TO_EXCEPTION_TYPE maps ValidationError [exception-recovery-types]", () => {
  const result = ERROR_CLASS_TO_EXCEPTION_TYPE["ValidationError"];
  assert.equal(result, "validation_error");
});

test("ERROR_CLASS_TO_EXCEPTION_TYPE maps PolicyDeniedError [exception-recovery-types]", () => {
  const result = ERROR_CLASS_TO_EXCEPTION_TYPE["PolicyDeniedError"];
  assert.equal(result, "policy_denied");
});

test("ERROR_CLASS_TO_EXCEPTION_TYPE maps AuthError [exception-recovery-types]", () => {
  const result = ERROR_CLASS_TO_EXCEPTION_TYPE["AuthError"];
  assert.equal(result, "auth_error");
});

test("ERROR_CLASS_TO_EXCEPTION_TYPE maps TransientExternalError [exception-recovery-types]", () => {
  const result = ERROR_CLASS_TO_EXCEPTION_TYPE["TransientExternalError"];
  assert.equal(result, "transient_external_error");
});

test("ERROR_CLASS_TO_EXCEPTION_TYPE maps PermanentExternalError [exception-recovery-types]", () => {
  const result = ERROR_CLASS_TO_EXCEPTION_TYPE["PermanentExternalError"];
  assert.equal(result, "permanent_external_error");
});

test("ERROR_CLASS_TO_EXCEPTION_TYPE maps ProviderError [exception-recovery-types]", () => {
  const result = ERROR_CLASS_TO_EXCEPTION_TYPE["ProviderError"];
  assert.equal(result, "provider_error");
});

test("ERROR_CLASS_TO_EXCEPTION_TYPE maps ToolExecutionError [exception-recovery-types]", () => {
  const result = ERROR_CLASS_TO_EXCEPTION_TYPE["ToolExecutionError"];
  assert.equal(result, "tool_execution_error");
});

test("ERROR_CLASS_TO_EXCEPTION_TYPE maps SandboxError [exception-recovery-types]", () => {
  const result = ERROR_CLASS_TO_EXCEPTION_TYPE["SandboxError"];
  assert.equal(result, "sandbox_error");
});

test("ERROR_CLASS_TO_EXCEPTION_TYPE maps StorageError [exception-recovery-types]", () => {
  const result = ERROR_CLASS_TO_EXCEPTION_TYPE["StorageError"];
  assert.equal(result, "storage_error");
});

test("ERROR_CLASS_TO_EXCEPTION_TYPE maps WorkflowStateError [exception-recovery-types]", () => {
  const result = ERROR_CLASS_TO_EXCEPTION_TYPE["WorkflowStateError"];
  assert.equal(result, "workflow_state_error");
});

test("ERROR_CLASS_TO_EXCEPTION_TYPE maps TenantBoundaryError [exception-recovery-types]", () => {
  const result = ERROR_CLASS_TO_EXCEPTION_TYPE["TenantBoundaryError"];
  assert.equal(result, "tenant_boundary_error");
});

test("ERROR_CLASS_TO_EXCEPTION_TYPE maps MonetizationError [exception-recovery-types]", () => {
  const result = ERROR_CLASS_TO_EXCEPTION_TYPE["MonetizationError"];
  assert.equal(result, "monetization_error");
});

test("ERROR_CLASS_TO_EXCEPTION_TYPE maps InternalAppError [exception-recovery-types]", () => {
  const result = ERROR_CLASS_TO_EXCEPTION_TYPE["InternalAppError"];
  assert.equal(result, "internal_error");
});

test("ERROR_CLASS_TO_EXCEPTION_TYPE maps LockingError [exception-recovery-types]", () => {
  const result = ERROR_CLASS_TO_EXCEPTION_TYPE["LockingError"];
  assert.equal(result, "locking_error");
});

test("ERROR_CLASS_TO_EXCEPTION_TYPE maps MemoryError [exception-recovery-types]", () => {
  const result = ERROR_CLASS_TO_EXCEPTION_TYPE["MemoryError"];
  assert.equal(result, "memory_error");
});

test("ERROR_CLASS_TO_EXCEPTION_TYPE maps RuntimeError [exception-recovery-types]", () => {
  const result = ERROR_CLASS_TO_EXCEPTION_TYPE["RuntimeError"];
  assert.equal(result, "runtime_error");
});

test("CATEGORY_TO_EXCEPTION_TYPE maps validation [exception-recovery-types]", () => {
  const result = CATEGORY_TO_EXCEPTION_TYPE["validation"];
  assert.equal(result, "validation_error");
});

test("CATEGORY_TO_EXCEPTION_TYPE maps policy [exception-recovery-types]", () => {
  const result = CATEGORY_TO_EXCEPTION_TYPE["policy"];
  assert.equal(result, "policy_denied");
});

test("CATEGORY_TO_EXCEPTION_TYPE maps auth [exception-recovery-types]", () => {
  const result = CATEGORY_TO_EXCEPTION_TYPE["auth"];
  assert.equal(result, "auth_error");
});

test("CATEGORY_TO_EXCEPTION_TYPE maps provider [exception-recovery-types]", () => {
  const result = CATEGORY_TO_EXCEPTION_TYPE["provider"];
  assert.equal(result, "provider_error");
});

test("CATEGORY_TO_EXCEPTION_TYPE maps tool [exception-recovery-types]", () => {
  const result = CATEGORY_TO_EXCEPTION_TYPE["tool"];
  assert.equal(result, "tool_execution_error");
});

test("CATEGORY_TO_EXCEPTION_TYPE maps sandbox [exception-recovery-types]", () => {
  const result = CATEGORY_TO_EXCEPTION_TYPE["sandbox"];
  assert.equal(result, "sandbox_error");
});

test("CATEGORY_TO_EXCEPTION_TYPE maps storage [exception-recovery-types]", () => {
  const result = CATEGORY_TO_EXCEPTION_TYPE["storage"];
  assert.equal(result, "storage_error");
});

test("CATEGORY_TO_EXCEPTION_TYPE maps workflow [exception-recovery-types]", () => {
  const result = CATEGORY_TO_EXCEPTION_TYPE["workflow"];
  assert.equal(result, "workflow_state_error");
});

test("CATEGORY_TO_EXCEPTION_TYPE maps tenant [exception-recovery-types]", () => {
  const result = CATEGORY_TO_EXCEPTION_TYPE["tenant"];
  assert.equal(result, "tenant_boundary_error");
});

test("CATEGORY_TO_EXCEPTION_TYPE maps monetization [exception-recovery-types]", () => {
  const result = CATEGORY_TO_EXCEPTION_TYPE["monetization"];
  assert.equal(result, "monetization_error");
});

test("CATEGORY_TO_EXCEPTION_TYPE maps external [exception-recovery-types]", () => {
  const result = CATEGORY_TO_EXCEPTION_TYPE["external"];
  assert.equal(result, "unknown_error");
});

test("CATEGORY_TO_EXCEPTION_TYPE maps internal [exception-recovery-types]", () => {
  const result = CATEGORY_TO_EXCEPTION_TYPE["internal"];
  assert.equal(result, "internal_error");
});

test("ExceptionType type accepts all valid values [exception-recovery-types]", () => {
  const types: ExceptionType[] = [
    "validation_error",
    "policy_denied",
    "auth_error",
    "transient_external_error",
    "permanent_external_error",
    "provider_error",
    "tool_execution_error",
    "sandbox_error",
    "storage_error",
    "workflow_state_error",
    "tenant_boundary_error",
    "monetization_error",
    "internal_error",
    "locking_error",
    "memory_error",
    "runtime_error",
    "unknown_error",
  ];

  assert.equal(types.length, 17);
});

test("RiskLevel type accepts all valid values [exception-recovery-types]", () => {
  const levels: RiskLevel[] = ["low", "medium", "high", "critical"];
  assert.equal(levels.length, 4);
});

test("ExceptionStrategy interface structure [exception-recovery-types]", () => {
  const strategy: ExceptionStrategy = {
    retryable: true,
    action: "retry_new_ticket",
    maxRetries: 3,
    backoffMultiplier: 1.5,
    initialDelayMs: 1000,
  };

  assert.equal(strategy.retryable, true);
  assert.equal(strategy.action, "retry_new_ticket");
  assert.equal(strategy.maxRetries, 3);
  assert.equal(strategy.backoffMultiplier, 1.5);
  assert.equal(strategy.initialDelayMs, 1000);
});

test("ExceptionStrategy without optional fields [exception-recovery-types]", () => {
  const strategy: ExceptionStrategy = {
    retryable: false,
    action: "cancel",
    maxRetries: 0,
  };

  assert.equal(strategy.retryable, false);
  assert.equal(strategy.action, "cancel");
  assert.equal(strategy.maxRetries, 0);
  assert.equal(strategy.backoffMultiplier, undefined);
  assert.equal(strategy.initialDelayMs, undefined);
});

test("RiskLevelStrategy interface structure [exception-recovery-types]", () => {
  const strategy: RiskLevelStrategy = {
    autoRecover: true,
    notifyOnFailure: false,
  };

  assert.equal(strategy.autoRecover, true);
  assert.equal(strategy.notifyOnFailure, false);
});

test("AttemptThresholds interface structure [exception-recovery-types]", () => {
  const thresholds: AttemptThresholds = {
    resumeSameWorkerMaxAttempts: 2,
    retryNewTicketMaxAttempts: 3,
    escalateTakeoverMinAttempts: 1,
    moveToDeadLetterMinAttempts: 2,
  };

  assert.equal(thresholds.resumeSameWorkerMaxAttempts, 2);
  assert.equal(thresholds.retryNewTicketMaxAttempts, 3);
  assert.equal(thresholds.escalateTakeoverMinAttempts, 1);
  assert.equal(thresholds.moveToDeadLetterMinAttempts, 2);
});

test("ExceptionRecoveryConfig interface structure [exception-recovery-types]", () => {
  const config: ExceptionRecoveryConfig = {
    recoveryStrategyTable: {
      byExceptionType: {
        validation_error: { retryable: false, action: "cancel", maxRetries: 0 },
        policy_denied: { retryable: false, action: "cancel", maxRetries: 0 },
        auth_error: { retryable: false, action: "cancel", maxRetries: 0 },
        transient_external_error: { retryable: true, action: "retry_new_ticket", maxRetries: 3 },
        permanent_external_error: { retryable: false, action: "move_dead_letter", maxRetries: 0 },
        provider_error: { retryable: true, action: "retry_new_ticket", maxRetries: 3 },
        tool_execution_error: { retryable: false, action: "escalate_takeover", maxRetries: 0 },
        sandbox_error: { retryable: false, action: "cancel", maxRetries: 0 },
        storage_error: { retryable: true, action: "retry_new_ticket", maxRetries: 2 },
        workflow_state_error: { retryable: false, action: "escalate_takeover", maxRetries: 0 },
        tenant_boundary_error: { retryable: false, action: "cancel", maxRetries: 0 },
        monetization_error: { retryable: false, action: "move_dead_letter", maxRetries: 0 },
        internal_error: { retryable: false, action: "move_dead_letter", maxRetries: 0 },
        locking_error: { retryable: true, action: "resume_same_worker", maxRetries: 1 },
        memory_error: { retryable: false, action: "escalate_takeover", maxRetries: 0 },
        runtime_error: { retryable: true, action: "retry_new_ticket", maxRetries: 1 },
        unknown_error: { retryable: false, action: "move_dead_letter", maxRetries: 0 },
      },
      byRiskLevel: {
        low: { autoRecover: true, notifyOnFailure: false },
        medium: { autoRecover: true, notifyOnFailure: true },
        high: { autoRecover: false, notifyOnFailure: true },
        critical: { autoRecover: false, notifyOnFailure: true },
      },
      byAttemptThreshold: {
        resumeSameWorkerMaxAttempts: 2,
        retryNewTicketMaxAttempts: 3,
        escalateTakeoverMinAttempts: 1,
        moveToDeadLetterMinAttempts: 2,
      },
    },
    defaultAction: "move_dead_letter",
    staleExecutionThresholdMs: 300000,
    heartbeatTimeoutMs: 60000,
  };

  assert.equal(config.defaultAction, "move_dead_letter");
  assert.equal(config.staleExecutionThresholdMs, 300000);
  assert.equal(config.heartbeatTimeoutMs, 60000);
  assert.ok(config.recoveryStrategyTable.byExceptionType);
  assert.ok(config.recoveryStrategyTable.byRiskLevel);
  assert.ok(config.recoveryStrategyTable.byAttemptThreshold);
});

test("ERROR_CLASS_TO_EXCEPTION_TYPE has expected number of entries [exception-recovery-types]", () => {
  const expectedKeys = [
    "ValidationError",
    "PolicyDeniedError",
    "AuthError",
    "TransientExternalError",
    "PermanentExternalError",
    "ProviderError",
    "ToolExecutionError",
    "SandboxError",
    "StorageError",
    "WorkflowStateError",
    "TenantBoundaryError",
    "MonetizationError",
    "InternalAppError",
    "LockingError",
    "MemoryError",
    "RuntimeError",
  ];

  assert.equal(Object.keys(ERROR_CLASS_TO_EXCEPTION_TYPE).length, expectedKeys.length);
});

test("CATEGORY_TO_EXCEPTION_TYPE has expected number of entries [exception-recovery-types]", () => {
  const expectedKeys = [
    "validation",
    "policy",
    "auth",
    "provider",
    "tool",
    "sandbox",
    "storage",
    "workflow",
    "tenant",
    "monetization",
    "external",
    "internal",
  ];

  assert.equal(Object.keys(CATEGORY_TO_EXCEPTION_TYPE).length, expectedKeys.length);
});