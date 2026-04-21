import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from "node:fs";
import { resolve } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { createTempWorkspace, cleanupPath, createFile } from "../../../../helpers/fs.js";
import {
  loadExceptionRecoveryConfig,
  clearExceptionRecoveryConfigCache,
} from "../../../../../src/platform/execution/recovery/exception-recovery-config-loader.js";
import type { ExceptionRecoveryConfig } from "../../../../../src/platform/execution/recovery/exception-recovery-types.js";

test("loadExceptionRecoveryConfig loads default config", () => {
  // Clear cache first to ensure we load fresh
  clearExceptionRecoveryConfigCache();

  const config = loadExceptionRecoveryConfig();

  assert.ok(config.recoveryStrategyTable, "Config has recoveryStrategyTable");
  assert.ok(config.recoveryStrategyTable.byExceptionType, "Config has byExceptionType");
  assert.ok(config.recoveryStrategyTable.byRiskLevel, "Config has byRiskLevel");
  assert.ok(config.recoveryStrategyTable.byAttemptThreshold, "Config has byAttemptThreshold");
});

test("loadExceptionRecoveryConfig caches result", () => {
  clearExceptionRecoveryConfigCache();

  const config1 = loadExceptionRecoveryConfig();
  const config2 = loadExceptionRecoveryConfig();

  assert.equal(config1, config2, "Same instance returned from cache");
});

test("clearExceptionRecoveryConfigCache clears cache", () => {
  clearExceptionRecoveryConfigCache();

  const config1 = loadExceptionRecoveryConfig();
  clearExceptionRecoveryConfigCache();
  const config2 = loadExceptionRecoveryConfig();

  assert.notEqual(config1, config2, "Fresh instance after cache clear");
});

test("byExceptionType has all required exception types", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  const requiredTypes = [
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

  for (const type of requiredTypes) {
    assert.ok(
      (config.recoveryStrategyTable.byExceptionType as Record<string, unknown>)[type],
      `Missing strategy for ${type}`,
    );
  }
});

test("transient_external_error is retryable with backoff", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  const strategy = config.recoveryStrategyTable.byExceptionType.transient_external_error;
  assert.equal(strategy.retryable, true);
  assert.equal(strategy.maxRetries, 3);
  assert.equal(strategy.backoffMultiplier, 1.5);
  assert.equal(strategy.initialDelayMs, 1000);
  assert.equal(strategy.action, "retry_new_ticket");
});

test("permanent_external_error is NOT retryable", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  const strategy = config.recoveryStrategyTable.byExceptionType.permanent_external_error;
  assert.equal(strategy.retryable, false);
  assert.equal(strategy.maxRetries, 0);
  assert.equal(strategy.action, "move_dead_letter");
});

test("locking_error is retryable with short backoff", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  const strategy = config.recoveryStrategyTable.byExceptionType.locking_error;
  assert.equal(strategy.retryable, true);
  assert.equal(strategy.maxRetries, 1);
  assert.equal(strategy.backoffMultiplier, 1.0);
  assert.equal(strategy.initialDelayMs, 100);
  assert.equal(strategy.action, "resume_same_worker");
});

test("storage_error is retryable with moderate backoff", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  const strategy = config.recoveryStrategyTable.byExceptionType.storage_error;
  assert.equal(strategy.retryable, true);
  assert.equal(strategy.maxRetries, 2);
  assert.equal(strategy.backoffMultiplier, 1.5);
  assert.equal(strategy.initialDelayMs, 500);
  assert.equal(strategy.action, "retry_new_ticket");
});

test("validation_error is NOT retryable", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  const strategy = config.recoveryStrategyTable.byExceptionType.validation_error;
  assert.equal(strategy.retryable, false);
  assert.equal(strategy.maxRetries, 0);
  assert.equal(strategy.action, "cancel");
});

test("tool_execution_error escalates for human review", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  const strategy = config.recoveryStrategyTable.byExceptionType.tool_execution_error;
  assert.equal(strategy.retryable, false);
  assert.equal(strategy.maxRetries, 0);
  assert.equal(strategy.action, "escalate_takeover");
});

test("byRiskLevel has all risk levels", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  assert.ok(config.recoveryStrategyTable.byRiskLevel.low, "Has low risk level");
  assert.ok(config.recoveryStrategyTable.byRiskLevel.medium, "Has medium risk level");
  assert.ok(config.recoveryStrategyTable.byRiskLevel.high, "Has high risk level");
  assert.ok(config.recoveryStrategyTable.byRiskLevel.critical, "Has critical risk level");
});

test("low risk level allows auto-recovery without notification", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  const strategy = config.recoveryStrategyTable.byRiskLevel.low;
  assert.equal(strategy.autoRecover, true);
  assert.equal(strategy.notifyOnFailure, false);
});

test("critical risk level does NOT auto-recover but notifies", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  const strategy = config.recoveryStrategyTable.byRiskLevel.critical;
  assert.equal(strategy.autoRecover, false);
  assert.equal(strategy.notifyOnFailure, true);
});

test("byAttemptThreshold has correct thresholds", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  const thresholds = config.recoveryStrategyTable.byAttemptThreshold;
  assert.equal(thresholds.resumeSameWorkerMaxAttempts, 2);
  assert.equal(thresholds.retryNewTicketMaxAttempts, 3);
  assert.equal(thresholds.escalateTakeoverMinAttempts, 1);
  assert.equal(thresholds.moveToDeadLetterMinAttempts, 2);
});

test("defaultAction is move_dead_letter", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  assert.equal(config.defaultAction, "move_dead_letter");
});

test("staleExecutionThresholdMs is 5 minutes (300000ms)", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  assert.equal(config.staleExecutionThresholdMs, 300000);
});

test("heartbeatTimeoutMs is 1 minute (60000ms)", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  assert.equal(config.heartbeatTimeoutMs, 60000);
});

test("loadExceptionRecoveryConfig loads from custom path", () => {
  // Create a temporary config file
  const tmpDir = mkdtempSync(resolve(tmpdir(), "exception-recovery-test-"));
  const customConfigPath = resolve(tmpDir, "custom-exception-recovery.json");

  const customConfig: ExceptionRecoveryConfig = {
    recoveryStrategyTable: {
      byExceptionType: {
        validation_error: {
          retryable: false,
          action: "cancel",
          maxRetries: 0,
        },
        policy_denied: {
          retryable: false,
          action: "cancel",
          maxRetries: 0,
        },
        auth_error: {
          retryable: false,
          action: "cancel",
          maxRetries: 0,
        },
        transient_external_error: {
          retryable: true,
          action: "retry_new_ticket",
          maxRetries: 5,
          backoffMultiplier: 3.0,
          initialDelayMs: 5000,
        },
        permanent_external_error: {
          retryable: false,
          action: "move_dead_letter",
          maxRetries: 0,
        },
        provider_error: {
          retryable: true,
          action: "retry_new_ticket",
          maxRetries: 3,
          backoffMultiplier: 2.0,
          initialDelayMs: 2000,
        },
        tool_execution_error: {
          retryable: false,
          action: "escalate_takeover",
          maxRetries: 0,
        },
        sandbox_error: {
          retryable: false,
          action: "cancel",
          maxRetries: 0,
        },
        storage_error: {
          retryable: true,
          action: "retry_new_ticket",
          maxRetries: 2,
          backoffMultiplier: 1.5,
          initialDelayMs: 500,
        },
        workflow_state_error: {
          retryable: false,
          action: "escalate_takeover",
          maxRetries: 0,
        },
        tenant_boundary_error: {
          retryable: false,
          action: "cancel",
          maxRetries: 0,
        },
        monetization_error: {
          retryable: false,
          action: "move_dead_letter",
          maxRetries: 0,
        },
        internal_error: {
          retryable: false,
          action: "move_dead_letter",
          maxRetries: 0,
        },
        locking_error: {
          retryable: true,
          action: "resume_same_worker",
          maxRetries: 1,
          backoffMultiplier: 1.0,
          initialDelayMs: 100,
        },
        memory_error: {
          retryable: false,
          action: "escalate_takeover",
          maxRetries: 0,
        },
        runtime_error: {
          retryable: true,
          action: "retry_new_ticket",
          maxRetries: 1,
          backoffMultiplier: 1.5,
          initialDelayMs: 1000,
        },
        unknown_error: {
          retryable: false,
          action: "move_dead_letter",
          maxRetries: 0,
        },
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

  try {
    writeFileSync(customConfigPath, JSON.stringify(customConfig, null, 2), "utf-8");

    clearExceptionRecoveryConfigCache();
    const config = loadExceptionRecoveryConfig(customConfigPath);

    // Verify custom values were loaded
    const customStrategy = config.recoveryStrategyTable.byExceptionType.transient_external_error;
    assert.equal(customStrategy.maxRetries, 5, "Custom maxRetries loaded");
    assert.equal(customStrategy.backoffMultiplier, 3.0, "Custom backoffMultiplier loaded");
    assert.equal(customStrategy.initialDelayMs, 5000, "Custom initialDelayMs loaded");
  } finally {
    // Cleanup
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("provider_error has correct defaults", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  const strategy = config.recoveryStrategyTable.byExceptionType.provider_error;
  assert.equal(strategy.retryable, true);
  assert.equal(strategy.maxRetries, 3);
  assert.equal(strategy.backoffMultiplier, 2.0);
  assert.equal(strategy.initialDelayMs, 2000);
  assert.equal(strategy.action, "retry_new_ticket");
});

test("runtime_error is retryable once with backoff", () => {
  clearExceptionRecoveryConfigCache();
  const config = loadExceptionRecoveryConfig();

  const strategy = config.recoveryStrategyTable.byExceptionType.runtime_error;
  assert.equal(strategy.retryable, true);
  assert.equal(strategy.maxRetries, 1);
  assert.equal(strategy.backoffMultiplier, 1.5);
  assert.equal(strategy.initialDelayMs, 1000);
  assert.equal(strategy.action, "retry_new_ticket");
});

test("loadExceptionRecoveryConfig throws when file is malformed JSON", () => {
  clearExceptionRecoveryConfigCache();

  const workspace = createTempWorkspace("exception-recovery-test-");
  const malformedPath = resolve(workspace, "malformed.json");

  try {
    createFile(malformedPath, "{ this is not valid json }");

    // The actual behavior is that it throws on malformed JSON
    let threw = false;
    try {
      loadExceptionRecoveryConfig(malformedPath);
    } catch (error) {
      threw = true;
      // Verify it's a JSON parse error
      assert.ok(error instanceof SyntaxError, "Should throw SyntaxError for malformed JSON");
    }
    assert.equal(threw, true, "Should throw on malformed JSON");
  } finally {
    cleanupPath(workspace);
    clearExceptionRecoveryConfigCache();
  }
});

test("loadExceptionRecoveryConfig throws when config file has missing fields", () => {
  clearExceptionRecoveryConfigCache();

  const workspace = createTempWorkspace("exception-recovery-test-");
  const missingFieldsPath = resolve(workspace, "missing-fields.json");

  try {
    // Config with only partial fields - missing most exception types
    const incompleteConfig = {
      recoveryStrategyTable: {
        byExceptionType: {
          validation_error: {
            retryable: false,
            action: "cancel",
            maxRetries: 0,
          },
        },
        byRiskLevel: {
          low: { autoRecover: true, notifyOnFailure: false },
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

    createFile(missingFieldsPath, JSON.stringify(incompleteConfig, null, 2));

    // The actual behavior is that it throws when accessing missing fields
    let threw = false;
    try {
      loadExceptionRecoveryConfig(missingFieldsPath);
    } catch (error) {
      threw = true;
      // Verify it's a TypeError for accessing undefined property
      assert.ok(error instanceof TypeError, "Should throw TypeError for missing fields");
    }
    assert.equal(threw, true, "Should throw on missing required fields");
  } finally {
    cleanupPath(workspace);
    clearExceptionRecoveryConfigCache();
  }
});
