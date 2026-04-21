/**
 * Exception Recovery Configuration Types
 *
 * Defines the types for the configurable exception recovery strategy table.
 * The configuration is loaded from config/exception-recovery/default.json.
 */
import type { RecoverySuggestedAction } from "./runtime-recovery-service.js";
/**
 * Exception types that can be matched for recovery strategies.
 */
export type ExceptionType = "validation_error" | "policy_denied" | "auth_error" | "transient_external_error" | "permanent_external_error" | "provider_error" | "tool_execution_error" | "sandbox_error" | "storage_error" | "workflow_state_error" | "tenant_boundary_error" | "monetization_error" | "internal_error" | "locking_error" | "memory_error" | "runtime_error" | "unknown_error";
/**
 * Strategy for a specific exception type.
 */
export interface ExceptionStrategy {
    /** Whether errors of this type are retryable */
    retryable: boolean;
    /** The recovery action to take */
    action: RecoverySuggestedAction;
    /** Maximum number of retry attempts */
    maxRetries: number;
    /** Backoff multiplier for exponential backoff (if retryable) */
    backoffMultiplier?: number;
    /** Initial delay in milliseconds before first retry (if retryable) */
    initialDelayMs?: number;
}
/**
 * Risk level definitions for recovery.
 */
export type RiskLevel = "low" | "medium" | "high" | "critical";
/**
 * Strategy for a specific risk level.
 */
export interface RiskLevelStrategy {
    /** Whether to automatically recover */
    autoRecover: boolean;
    /** Whether to send notification on failure */
    notifyOnFailure: boolean;
}
/**
 * Attempt threshold configuration.
 */
export interface AttemptThresholds {
    /** Maximum attempts before switching from resume_same_worker */
    resumeSameWorkerMaxAttempts: number;
    /** Maximum attempts before switching to new ticket retry */
    retryNewTicketMaxAttempts: number;
    /** Minimum attempts before allowing escalate_takeover */
    escalateTakeoverMinAttempts: number;
    /** Minimum attempts before allowing move_to_dead_letter */
    moveToDeadLetterMinAttempts: number;
}
/**
 * Recovery strategy table by exception type.
 */
export type ExceptionStrategyMap = Record<ExceptionType, ExceptionStrategy>;
/**
 * Recovery strategy table by risk level.
 */
export type RiskLevelStrategyMap = Record<RiskLevel, RiskLevelStrategy>;
/**
 * Exception recovery configuration loaded from JSON.
 */
export interface ExceptionRecoveryConfig {
    /** Strategy table organized by exception type and risk level */
    recoveryStrategyTable: {
        /** Recovery strategies indexed by exception type */
        byExceptionType: ExceptionStrategyMap;
        /** Recovery strategies indexed by risk level */
        byRiskLevel: RiskLevelStrategyMap;
        /** Attempt thresholds for different actions */
        byAttemptThreshold: AttemptThresholds;
    };
    /** Default action when no matching strategy is found */
    defaultAction: RecoverySuggestedAction;
    /** Stale execution threshold in milliseconds */
    staleExecutionThresholdMs: number;
    /** Heartbeat timeout in milliseconds */
    heartbeatTimeoutMs: number;
}
/**
 * Maps error class names to exception types for strategy lookup.
 */
export declare const ERROR_CLASS_TO_EXCEPTION_TYPE: Record<string, ExceptionType>;
/**
 * Maps AppError category to exception type for strategy lookup.
 */
export declare const CATEGORY_TO_EXCEPTION_TYPE: Record<string, ExceptionType>;
