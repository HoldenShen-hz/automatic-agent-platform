/**
 * Exception Recovery Configuration Loader
 * Loads exception recovery strategy from config/exception-recovery/default.json
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PolicyDeniedError } from "../../contracts/errors.js";
import { checkSandboxPath, createConfigReadPolicy, type SandboxPolicy } from "../../five-plane-control-plane/iam/sandbox-policy.js";
import type { ExceptionRecoveryConfig } from "./exception-recovery-types.js";
export type { ExceptionRecoveryConfig } from "./exception-recovery-types.js";

const DEFAULT_CONFIG_PATH = resolve(process.cwd(), "config/exception-recovery/default.json");
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;

const cachedConfigs = new Map<string, { value: ExceptionRecoveryConfig; cachedAt: number }>();

function cloneExceptionRecoveryConfig(parsed: ExceptionRecoveryConfig): ExceptionRecoveryConfig {
  return {
    recoveryStrategyTable: {
      byExceptionType: {
        validation_error: {
          retryable: parsed.recoveryStrategyTable.byExceptionType.validation_error.retryable,
          action: parsed.recoveryStrategyTable.byExceptionType.validation_error.action,
          maxRetries: parsed.recoveryStrategyTable.byExceptionType.validation_error.maxRetries,
          backoffMultiplier: parsed.recoveryStrategyTable.byExceptionType.validation_error.backoffMultiplier,
          initialDelayMs: parsed.recoveryStrategyTable.byExceptionType.validation_error.initialDelayMs,
        },
        policy_denied: {
          retryable: parsed.recoveryStrategyTable.byExceptionType.policy_denied.retryable,
          action: parsed.recoveryStrategyTable.byExceptionType.policy_denied.action,
          maxRetries: parsed.recoveryStrategyTable.byExceptionType.policy_denied.maxRetries,
        },
        auth_error: {
          retryable: parsed.recoveryStrategyTable.byExceptionType.auth_error.retryable,
          action: parsed.recoveryStrategyTable.byExceptionType.auth_error.action,
          maxRetries: parsed.recoveryStrategyTable.byExceptionType.auth_error.maxRetries,
        },
        transient_external_error: {
          retryable: parsed.recoveryStrategyTable.byExceptionType.transient_external_error.retryable,
          action: parsed.recoveryStrategyTable.byExceptionType.transient_external_error.action,
          maxRetries: parsed.recoveryStrategyTable.byExceptionType.transient_external_error.maxRetries,
          backoffMultiplier: parsed.recoveryStrategyTable.byExceptionType.transient_external_error.backoffMultiplier,
          initialDelayMs: parsed.recoveryStrategyTable.byExceptionType.transient_external_error.initialDelayMs,
        },
        permanent_external_error: {
          retryable: parsed.recoveryStrategyTable.byExceptionType.permanent_external_error.retryable,
          action: parsed.recoveryStrategyTable.byExceptionType.permanent_external_error.action,
          maxRetries: parsed.recoveryStrategyTable.byExceptionType.permanent_external_error.maxRetries,
        },
        provider_error: {
          retryable: parsed.recoveryStrategyTable.byExceptionType.provider_error.retryable,
          action: parsed.recoveryStrategyTable.byExceptionType.provider_error.action,
          maxRetries: parsed.recoveryStrategyTable.byExceptionType.provider_error.maxRetries,
          backoffMultiplier: parsed.recoveryStrategyTable.byExceptionType.provider_error.backoffMultiplier,
          initialDelayMs: parsed.recoveryStrategyTable.byExceptionType.provider_error.initialDelayMs,
        },
        tool_execution_error: {
          retryable: parsed.recoveryStrategyTable.byExceptionType.tool_execution_error.retryable,
          action: parsed.recoveryStrategyTable.byExceptionType.tool_execution_error.action,
          maxRetries: parsed.recoveryStrategyTable.byExceptionType.tool_execution_error.maxRetries,
        },
        sandbox_error: {
          retryable: parsed.recoveryStrategyTable.byExceptionType.sandbox_error.retryable,
          action: parsed.recoveryStrategyTable.byExceptionType.sandbox_error.action,
          maxRetries: parsed.recoveryStrategyTable.byExceptionType.sandbox_error.maxRetries,
        },
        storage_error: {
          retryable: parsed.recoveryStrategyTable.byExceptionType.storage_error.retryable,
          action: parsed.recoveryStrategyTable.byExceptionType.storage_error.action,
          maxRetries: parsed.recoveryStrategyTable.byExceptionType.storage_error.maxRetries,
          backoffMultiplier: parsed.recoveryStrategyTable.byExceptionType.storage_error.backoffMultiplier,
          initialDelayMs: parsed.recoveryStrategyTable.byExceptionType.storage_error.initialDelayMs,
        },
        workflow_state_error: {
          retryable: parsed.recoveryStrategyTable.byExceptionType.workflow_state_error.retryable,
          action: parsed.recoveryStrategyTable.byExceptionType.workflow_state_error.action,
          maxRetries: parsed.recoveryStrategyTable.byExceptionType.workflow_state_error.maxRetries,
        },
        tenant_boundary_error: {
          retryable: parsed.recoveryStrategyTable.byExceptionType.tenant_boundary_error.retryable,
          action: parsed.recoveryStrategyTable.byExceptionType.tenant_boundary_error.action,
          maxRetries: parsed.recoveryStrategyTable.byExceptionType.tenant_boundary_error.maxRetries,
        },
        monetization_error: {
          retryable: parsed.recoveryStrategyTable.byExceptionType.monetization_error.retryable,
          action: parsed.recoveryStrategyTable.byExceptionType.monetization_error.action,
          maxRetries: parsed.recoveryStrategyTable.byExceptionType.monetization_error.maxRetries,
        },
        internal_error: {
          retryable: parsed.recoveryStrategyTable.byExceptionType.internal_error.retryable,
          action: parsed.recoveryStrategyTable.byExceptionType.internal_error.action,
          maxRetries: parsed.recoveryStrategyTable.byExceptionType.internal_error.maxRetries,
        },
        locking_error: {
          retryable: parsed.recoveryStrategyTable.byExceptionType.locking_error.retryable,
          action: parsed.recoveryStrategyTable.byExceptionType.locking_error.action,
          maxRetries: parsed.recoveryStrategyTable.byExceptionType.locking_error.maxRetries,
          backoffMultiplier: parsed.recoveryStrategyTable.byExceptionType.locking_error.backoffMultiplier,
          initialDelayMs: parsed.recoveryStrategyTable.byExceptionType.locking_error.initialDelayMs,
        },
        memory_error: {
          retryable: parsed.recoveryStrategyTable.byExceptionType.memory_error.retryable,
          action: parsed.recoveryStrategyTable.byExceptionType.memory_error.action,
          maxRetries: parsed.recoveryStrategyTable.byExceptionType.memory_error.maxRetries,
        },
        runtime_error: {
          retryable: parsed.recoveryStrategyTable.byExceptionType.runtime_error.retryable,
          action: parsed.recoveryStrategyTable.byExceptionType.runtime_error.action,
          maxRetries: parsed.recoveryStrategyTable.byExceptionType.runtime_error.maxRetries,
          backoffMultiplier: parsed.recoveryStrategyTable.byExceptionType.runtime_error.backoffMultiplier,
          initialDelayMs: parsed.recoveryStrategyTable.byExceptionType.runtime_error.initialDelayMs,
        },
        unknown_error: {
          retryable: parsed.recoveryStrategyTable.byExceptionType.unknown_error.retryable,
          action: parsed.recoveryStrategyTable.byExceptionType.unknown_error.action,
          maxRetries: parsed.recoveryStrategyTable.byExceptionType.unknown_error.maxRetries,
        },
      },
      byRiskLevel: {
        low: {
          autoRecover: parsed.recoveryStrategyTable.byRiskLevel.low.autoRecover,
          notifyOnFailure: parsed.recoveryStrategyTable.byRiskLevel.low.notifyOnFailure,
        },
        medium: {
          autoRecover: parsed.recoveryStrategyTable.byRiskLevel.medium.autoRecover,
          notifyOnFailure: parsed.recoveryStrategyTable.byRiskLevel.medium.notifyOnFailure,
        },
        high: {
          autoRecover: parsed.recoveryStrategyTable.byRiskLevel.high.autoRecover,
          notifyOnFailure: parsed.recoveryStrategyTable.byRiskLevel.high.notifyOnFailure,
        },
        critical: {
          autoRecover: parsed.recoveryStrategyTable.byRiskLevel.critical.autoRecover,
          notifyOnFailure: parsed.recoveryStrategyTable.byRiskLevel.critical.notifyOnFailure,
        },
      },
      byAttemptThreshold: {
        resumeSameWorkerMaxAttempts: parsed.recoveryStrategyTable.byAttemptThreshold.resumeSameWorkerMaxAttempts,
        retryNewTicketMaxAttempts: parsed.recoveryStrategyTable.byAttemptThreshold.retryNewTicketMaxAttempts,
        escalateTakeoverMinAttempts: parsed.recoveryStrategyTable.byAttemptThreshold.escalateTakeoverMinAttempts,
        moveToDeadLetterMinAttempts: parsed.recoveryStrategyTable.byAttemptThreshold.moveToDeadLetterMinAttempts,
      },
    },
    defaultAction: parsed.defaultAction,
    staleExecutionThresholdMs: parsed.staleExecutionThresholdMs,
    heartbeatTimeoutMs: parsed.heartbeatTimeoutMs,
  };
}

/**
 * Loads the exception recovery configuration from the JSON config file.
 *
 * @param configPath - Optional path to config file (defaults to config/exception-recovery/default.json)
 * @param sandboxPolicy - Optional sandbox policy for path validation
 * @returns The parsed exception recovery configuration
 */
export function loadExceptionRecoveryConfig(
  configPath: string = DEFAULT_CONFIG_PATH,
  sandboxPolicy?: SandboxPolicy,
): ExceptionRecoveryConfig {
  // Validate path before reading to prevent path traversal attacks
  if (sandboxPolicy != null) {
    const check = checkSandboxPath(sandboxPolicy, configPath);
    if (!check.allowed) {
      throw new PolicyDeniedError(
        check.reasonCode ?? "config.exception_recovery_denied",
        check.reasonCode ?? "config.exception_recovery_denied",
      );
    }
    configPath = check.normalizedPath;
  }

  const effectivePath = resolve(configPath);
  const cachedConfig = cachedConfigs.get(effectivePath);
  if (cachedConfig && Date.now() - cachedConfig.cachedAt <= CONFIG_CACHE_TTL_MS) {
    return cachedConfig.value;
  }

  const raw = readFileSync(effectivePath, "utf-8");
  const parsed = JSON.parse(raw);
  const config = cloneExceptionRecoveryConfig(parsed);
  cachedConfigs.set(effectivePath, { value: config, cachedAt: Date.now() });
  return config;
}

/**
 * Clears the cached configuration.
 * Useful for testing or when reloading config.
 */
export function clearExceptionRecoveryConfigCache(): void {
  cachedConfigs.clear();
}
