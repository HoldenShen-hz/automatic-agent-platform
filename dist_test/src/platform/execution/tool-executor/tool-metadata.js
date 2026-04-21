/**
 * Tool Metadata Definitions
 *
 * This module defines the core type system for tool execution metadata, request/response interfaces,
 * and predefined metadata configurations for built-in tools (command execution and edit/replace).
 * It provides a centralized schema for describing tool characteristics such as security posture,
 * side effects, recovery strategies, and output handling.
 *
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/contracts/sandbox_contract.md}
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/contracts/policy_engine_contract.md}
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/governance/glossary_and_terminology.md}
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/architecture/00-platform-architecture.md}
 */
/**
 * Predefined metadata for the command execution tool (command_exec).
 * Configured as a high-risk tool that executes local processes.
 */
export const COMMAND_TOOL_METADATA = {
    toolName: "command_exec",
    readOnly: false,
    idempotent: false,
    sideEffectScope: "local_process",
    recoveryStrategy: "retry_with_check",
    requiresConfirmation: false,
    riskLevel: "high",
    needsFileLock: "dynamic",
    pathScopeMode: "declared",
    producesArtifact: false,
    outputKind: "text",
    supportsStreamingOutput: false,
    providerDependency: "none",
    defaultTimeoutMs: 60_000,
    maxOutputBytes: 200_000,
    retryableErrorCodes: ["tool.timeout"],
    approvalMode: "policy_driven",
    supportsCancellation: true,
    cleanupGuarantee: "best_effort",
    requiresExecutionReceipt: true,
    highRiskPatterns: [
        /\|/,
        />/,
        /<</,
        /\$\(/,
        /^python$/i,
        /^node$/i,
        /^bash$/i,
        /^sh$/i,
    ],
    isConcurrencySafe: false,
    interruptBehavior: "graceful",
    isLongRunning: true,
    retryPolicy: {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
    },
};
/**
 * Predefined metadata for the edit/replace tool (edit_replace).
 * Configured as a high-risk but idempotent file modification tool.
 */
export const EDIT_TOOL_METADATA = {
    toolName: "edit_replace",
    readOnly: false,
    idempotent: true,
    sideEffectScope: "local_file",
    recoveryStrategy: "retry_with_check",
    requiresConfirmation: false,
    riskLevel: "high",
    needsFileLock: "write",
    pathScopeMode: "declared",
    producesArtifact: false,
    outputKind: "structured_json",
    supportsStreamingOutput: false,
    providerDependency: "none",
    defaultTimeoutMs: 30_000,
    maxOutputBytes: 20_000,
    retryableErrorCodes: ["tool.file_lock_conflict", "tool.timeout"],
    approvalMode: "policy_driven",
    supportsCancellation: false,
    cleanupGuarantee: "required",
    requiresExecutionReceipt: true,
    highRiskPatterns: [],
    isConcurrencySafe: false,
    interruptBehavior: "forceful",
    isLongRunning: false,
};
/**
 * Predefined metadata for the read tool.
 * Read-only, concurrency-safe file access.
 */
export const READ_TOOL_METADATA = {
    toolName: "read",
    readOnly: true,
    idempotent: true,
    sideEffectScope: "none",
    recoveryStrategy: "retry_safe",
    requiresConfirmation: false,
    riskLevel: "low",
    needsFileLock: "read",
    pathScopeMode: "declared",
    producesArtifact: false,
    outputKind: "text",
    supportsStreamingOutput: false,
    providerDependency: "none",
    defaultTimeoutMs: 15_000,
    maxOutputBytes: 200_000,
    retryableErrorCodes: ["tool.execution_failed", "tool.timeout"],
    approvalMode: "never",
    supportsCancellation: false,
    cleanupGuarantee: "none",
    requiresExecutionReceipt: false,
    highRiskPatterns: [],
    isConcurrencySafe: true,
    interruptBehavior: "graceful",
    isLongRunning: false,
};
/**
 * Predefined metadata for bash tool (alias for command_exec).
 */
export const BASH_TOOL_METADATA = {
    ...COMMAND_TOOL_METADATA,
    toolName: "bash",
};
/**
 * Predefined metadata for edit_batch tool (alias for edit_replace).
 */
export const EDIT_BATCH_TOOL_METADATA = {
    ...EDIT_TOOL_METADATA,
    toolName: "edit_batch",
};
/**
 * Predefined metadata for the apply_patch tool.
 * High-risk file modification with structured patches.
 */
export const APPLY_PATCH_TOOL_METADATA = {
    toolName: "apply_patch",
    readOnly: false,
    idempotent: false,
    sideEffectScope: "local_file",
    recoveryStrategy: "retry_with_check",
    requiresConfirmation: false,
    riskLevel: "high",
    needsFileLock: "write",
    pathScopeMode: "declared",
    producesArtifact: false,
    outputKind: "structured_json",
    supportsStreamingOutput: false,
    providerDependency: "none",
    defaultTimeoutMs: 30_000,
    maxOutputBytes: 20_000,
    retryableErrorCodes: ["tool.file_lock_conflict", "tool.timeout"],
    approvalMode: "policy_driven",
    supportsCancellation: false,
    cleanupGuarantee: "required",
    requiresExecutionReceipt: true,
    highRiskPatterns: [],
    isConcurrencySafe: false,
    interruptBehavior: "forceful",
    isLongRunning: false,
};
/**
 * Predefined metadata for the question tool.
 * Read-only HITL interaction tool.
 */
export const QUESTION_TOOL_METADATA = {
    toolName: "question",
    readOnly: true,
    idempotent: false,
    sideEffectScope: "none",
    recoveryStrategy: "retry_safe",
    requiresConfirmation: false,
    riskLevel: "low",
    needsFileLock: "none",
    pathScopeMode: "none",
    producesArtifact: false,
    outputKind: "structured_json",
    supportsStreamingOutput: false,
    providerDependency: "none",
    defaultTimeoutMs: 15_000,
    maxOutputBytes: 20_000,
    retryableErrorCodes: [],
    approvalMode: "never",
    supportsCancellation: false,
    cleanupGuarantee: "none",
    requiresExecutionReceipt: false,
    highRiskPatterns: [],
    isConcurrencySafe: true,
    interruptBehavior: "graceful",
    isLongRunning: false,
};
/**
 * Predefined metadata for the todo_write tool.
 * Medium-risk org state modification.
 */
export const TODO_WRITE_TOOL_METADATA = {
    toolName: "todo_write",
    readOnly: false,
    idempotent: false,
    sideEffectScope: "org_state",
    recoveryStrategy: "manual_resume_required",
    requiresConfirmation: false,
    riskLevel: "medium",
    needsFileLock: "none",
    pathScopeMode: "none",
    producesArtifact: false,
    outputKind: "structured_json",
    supportsStreamingOutput: false,
    providerDependency: "none",
    defaultTimeoutMs: 15_000,
    maxOutputBytes: 20_000,
    retryableErrorCodes: [],
    approvalMode: "policy_driven",
    supportsCancellation: false,
    cleanupGuarantee: "none",
    requiresExecutionReceipt: true,
    highRiskPatterns: [],
    isConcurrencySafe: false,
    interruptBehavior: "forceful",
    isLongRunning: false,
};
/**
 * Predefined metadata for the web_search tool.
 * Medium-risk remote API access.
 */
export const WEB_SEARCH_TOOL_METADATA = {
    toolName: "web_search",
    readOnly: false,
    idempotent: false,
    sideEffectScope: "remote_api",
    recoveryStrategy: "retry_safe",
    requiresConfirmation: false,
    riskLevel: "medium",
    needsFileLock: "none",
    pathScopeMode: "none",
    producesArtifact: false,
    outputKind: "structured_json",
    supportsStreamingOutput: false,
    providerDependency: "none",
    defaultTimeoutMs: 15_000,
    maxOutputBytes: 50_000,
    retryableErrorCodes: ["TIMEOUT", "FETCH_ERROR"],
    approvalMode: "never",
    supportsCancellation: true,
    cleanupGuarantee: "none",
    requiresExecutionReceipt: true,
    highRiskPatterns: [],
    isConcurrencySafe: true,
    interruptBehavior: "graceful",
    isLongRunning: false,
};
/**
 * Predefined metadata for the web_fetch tool.
 * Medium-risk remote API access.
 */
export const WEB_FETCH_TOOL_METADATA = {
    toolName: "web_fetch",
    readOnly: false,
    idempotent: false,
    sideEffectScope: "remote_api",
    recoveryStrategy: "retry_safe",
    requiresConfirmation: false,
    riskLevel: "medium",
    needsFileLock: "none",
    pathScopeMode: "none",
    producesArtifact: false,
    outputKind: "text",
    supportsStreamingOutput: false,
    providerDependency: "none",
    defaultTimeoutMs: 15_000,
    maxOutputBytes: 100_000,
    retryableErrorCodes: ["TIMEOUT", "FETCH_ERROR"],
    approvalMode: "never",
    supportsCancellation: true,
    cleanupGuarantee: "none",
    requiresExecutionReceipt: true,
    highRiskPatterns: [],
    isConcurrencySafe: true,
    interruptBehavior: "graceful",
    isLongRunning: false,
};
/**
 * Fallback timeout when no timeout is specified and tool has no default.
 */
const FALLBACK_TOOL_TIMEOUT_MS = 30_000;
/**
 * Registry of all built-in tool metadata, keyed by tool name.
 */
const BUILTIN_TOOL_METADATA_BY_NAME = new Map([
    [COMMAND_TOOL_METADATA.toolName, COMMAND_TOOL_METADATA],
    [EDIT_TOOL_METADATA.toolName, EDIT_TOOL_METADATA],
    [READ_TOOL_METADATA.toolName, READ_TOOL_METADATA],
    [BASH_TOOL_METADATA.toolName, BASH_TOOL_METADATA],
    [EDIT_BATCH_TOOL_METADATA.toolName, EDIT_BATCH_TOOL_METADATA],
    [APPLY_PATCH_TOOL_METADATA.toolName, APPLY_PATCH_TOOL_METADATA],
    [QUESTION_TOOL_METADATA.toolName, QUESTION_TOOL_METADATA],
    [TODO_WRITE_TOOL_METADATA.toolName, TODO_WRITE_TOOL_METADATA],
    [WEB_SEARCH_TOOL_METADATA.toolName, WEB_SEARCH_TOOL_METADATA],
    [WEB_FETCH_TOOL_METADATA.toolName, WEB_FETCH_TOOL_METADATA],
]);
/**
 * Returns all built-in tool metadata entries.
 */
export function listBuiltinToolExecutionMetadata() {
    return [...BUILTIN_TOOL_METADATA_BY_NAME.values()];
}
/**
 * Resolves tool execution metadata by tool name.
 *
 * @param toolName - Name of the tool
 * @returns Metadata if tool is built-in, null otherwise
 */
export function resolveToolExecutionMetadata(toolName) {
    return BUILTIN_TOOL_METADATA_BY_NAME.get(toolName) ?? null;
}
/**
 * Resolves the effective timeout for a tool execution.
 * Priority: explicit request timeout > tool metadata default > fallback
 *
 * @param requestedTimeoutMs - Timeout requested by the caller
 * @param metadata - Tool metadata containing default timeout
 * @returns Effective timeout in milliseconds
 */
export function resolveToolTimeoutMs(requestedTimeoutMs, metadata) {
    if (typeof requestedTimeoutMs === "number" && Number.isFinite(requestedTimeoutMs) && requestedTimeoutMs > 0) {
        return Math.max(1, Math.trunc(requestedTimeoutMs));
    }
    if (metadata != null && Number.isFinite(metadata.defaultTimeoutMs) && metadata.defaultTimeoutMs > 0) {
        return Math.max(1, Math.trunc(metadata.defaultTimeoutMs));
    }
    return FALLBACK_TOOL_TIMEOUT_MS;
}
/**
 * Determines if a tool failure is eligible for automatic retry.
 *
 * @param input - Contains metadata, status, error code, and source
 * @returns true if the failure can be retried
 */
export function isToolFailureRetryable(input) {
    const status = input.status ?? "failed";
    // These statuses can never be retried
    if (status === "blocked" || status === "cancelled" || status === "succeeded") {
        return false;
    }
    const metadata = input.metadata ?? null;
    const errorCode = input.errorCode?.trim() || null;
    const source = input.source ?? null;
    const allowlistedError = errorCode != null && (metadata?.retryableErrorCodes.includes(errorCode) ?? false);
    // Explicit non-retryable request
    if (input.requestedRetryable === false) {
        return false;
    }
    // No metadata - use requested retryable or default to no retry
    if (metadata == null) {
        return input.requestedRetryable === true;
    }
    // These recovery strategies never allow automatic retry
    if (metadata.recoveryStrategy === "manual_resume_required" || metadata.recoveryStrategy === "skip_if_verified") {
        return false;
    }
    // Explicit retryable request with error code allowlist
    if (input.requestedRetryable === true) {
        if (allowlistedError) {
            return true;
        }
        // retry_with_check allows retry if error is not from security/validation
        return metadata.recoveryStrategy === "retry_with_check"
            && source !== "security"
            && source !== "validation"
            && !(errorCode?.startsWith("sandbox.") ?? false)
            && !(errorCode?.startsWith("validation.") ?? false);
    }
    // Error code is in allowlist
    if (allowlistedError) {
        return true;
    }
    // retry_safe allows retry for non-security/validation errors
    return metadata.recoveryStrategy === "retry_safe" && source !== "security" && source !== "validation";
}
//# sourceMappingURL=tool-metadata.js.map