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
import type { SandboxPolicy } from "../../control-plane/iam/sandbox-policy.js";
import type { ToolCallErrorSource, ToolCallStatus } from "./tool-call-result.js";
/**
 * Describes the scope of side effects a tool may produce during execution.
 * Used for risk assessment and sandbox policy enforcement.
 */
export type ToolSideEffectScope = "none" | "local_file" | "local_process" | "remote_api" | "billing" | "org_state";
/**
 * Defines the strategy for recovering from tool execution failures.
 * Determines whether a failed tool call can be safely retried.
 */
export type ToolRecoveryStrategy = "retry_safe" | "retry_with_check" | "skip_if_verified" | "manual_resume_required";
/**
 * Retry policy configuration for tool execution.
 */
export interface ToolRetryPolicy {
    /** Maximum number of retry attempts */
    maxAttempts?: number;
    /** Initial backoff delay in milliseconds */
    initialDelayMs?: number;
    /** Maximum backoff delay in milliseconds */
    maxDelayMs?: number;
    /** Backoff multiplier for exponential retry */
    backoffMultiplier?: number;
    /** Error codes that should not be retried */
    nonRetryableCodes?: readonly string[];
}
/**
 * Indicates whether a tool requires a file lock before execution and what type.
 * - "none": No file lock required
 * - "read": Shared read lock needed
 * - "write": Exclusive write lock needed
 * - "dynamic": Lock type determined at runtime based on operation
 */
export type ToolNeedsFileLock = "none" | "read" | "write" | "dynamic";
/**
 * Controls how tool path access is validated against declared paths.
 * - "none": No path scope validation
 * - "declared": Only explicitly declared paths are allowed
 * - "dynamic": Path scope determined at runtime
 */
export type ToolPathScopeMode = "none" | "declared" | "dynamic";
/**
 * Categorizes the primary output format produced by a tool.
 * Used for downstream processing and rendering decisions.
 */
export type ToolOutputKind = "text" | "structured_json" | "artifact_ref" | "mixed";
/**
 * Determines when a tool requires explicit user approval before execution.
 * - "never": No approval required
 * - "policy_driven": Approval based on sandbox policy rules
 * - "always": Always requires explicit approval
 */
export type ToolApprovalMode = "never" | "policy_driven" | "always";
/**
 * Risk level classification for tool execution.
 * Used for approval gating and audit logging.
 */
export type ToolRiskLevel = "low" | "medium" | "high" | "critical";
/**
 * Comprehensive metadata describing a tool's execution characteristics,
 * security posture, and runtime requirements.
 * This interface serves as the primary schema for tool registration
 * and runtime policy enforcement.
 */
export interface ToolExecutionMetadata {
    /** Unique identifier for the tool (e.g., "command_exec", "edit_replace") */
    toolName: string;
    /** If true, the tool does not modify any state; enables read-only optimization */
    readOnly: boolean;
    /** If true, executing the tool multiple times with same inputs produces same result */
    idempotent: boolean;
    /** Scope of side effects the tool may produce during execution */
    sideEffectScope: ToolSideEffectScope;
    /** Strategy for handling execution failures */
    recoveryStrategy: ToolRecoveryStrategy;
    /** If true, this tool requires explicit user confirmation before execution */
    requiresConfirmation: boolean;
    /** Risk level classification for security and approval decisions */
    riskLevel: ToolRiskLevel;
    /** Type of file lock required for safe execution */
    needsFileLock: ToolNeedsFileLock;
    /** How path access is validated against declared paths */
    pathScopeMode: ToolPathScopeMode;
    /** If true, the tool may produce artifact references in its output */
    producesArtifact: boolean;
    /** Primary format of the tool's output */
    outputKind: ToolOutputKind;
    /** If true, the tool supports streaming output responses */
    supportsStreamingOutput: boolean;
    /** Degree of dependency on external tool providers */
    providerDependency: "none" | "optional" | "required";
    /** Default maximum execution time in milliseconds if not specified in request */
    defaultTimeoutMs: number;
    /** Maximum size of output in bytes; undefined means no limit */
    maxOutputBytes?: number;
    /** Explicit error codes that are eligible for automatic retry under this tool's recovery policy */
    retryableErrorCodes: readonly string[];
    /** Mode controlling when approval is required */
    approvalMode: ToolApprovalMode;
    /** If true, the tool supports cancellation via AbortSignal */
    supportsCancellation: boolean;
    /** Guarantee level for cleanup operations after execution */
    cleanupGuarantee: "none" | "best_effort" | "required";
    /** If true, an execution receipt must be generated for audit trail */
    requiresExecutionReceipt: boolean;
    /** Regular expression patterns that indicate high-risk operations */
    highRiskPatterns: readonly RegExp[];
    /** If true, the tool can safely execute in parallel with other concurrency-safe tools */
    isConcurrencySafe?: boolean;
    /** Defines how the tool behaves when interrupted during execution */
    interruptBehavior?: "graceful" | "forceful" | "deferred";
    /** If true, the tool is considered long-running and may be subject to special scheduling */
    isLongRunning?: boolean;
    /** Retry policy configuration for the tool */
    retryPolicy?: ToolRetryPolicy;
    /** Maximum size of output in characters; undefined means no limit */
    maxResultSizeChars?: number;
}
/**
 * Base request interface for tool execution.
 * Contains all information needed to execute any tool,
 * including tracing context and sandbox policy.
 */
export interface ToolExecutionRequest {
    /** Unique identifier for this specific tool call */
    callId: string;
    /** Identifier of the task this execution belongs to */
    taskId: string;
    /** Identifier of the agent initiating the execution */
    agentId: string;
    /** Optional execution context used for runtime tool/path authorization */
    executionId?: string | null;
    /** Distributed tracing identifier for observability */
    traceId: string;
    /** Name of the tool to execute */
    toolName: string;
    /** Maximum time in milliseconds before execution is aborted; defaults to tool metadata when omitted */
    timeoutMs?: number;
    /** Sandbox policy controlling allowed operations and paths */
    sandboxPolicy: SandboxPolicy;
    /** Optional execution-level path scope allowlist; when present, tool paths must stay under these roots */
    allowedPathRoots?: readonly string[];
}
/**
 * Request interface for the command execution tool.
 * Extends base execution request with command-specific parameters.
 */
export interface CommandToolRequest extends ToolExecutionRequest {
    /** The command executable to run (e.g., "ls", "git") */
    command: string;
    /** Command-line arguments passed to the executable */
    args: readonly string[];
    /** Working directory for command execution */
    cwd: string;
    /** Paths the command intends to read; validated against sandbox policy */
    declaredReadPaths?: readonly string[];
    /** Paths the command intends to write; validated against sandbox policy */
    declaredWritePaths?: readonly string[];
}
/**
 * Request interface for the edit/replace tool.
 * Specifies the file and string replacement to apply.
 */
export interface EditToolRequest extends ToolExecutionRequest {
    /** Absolute path to the file to modify */
    filePath: string;
    /** The exact text to find in the file */
    oldString: string;
    /** The replacement text */
    newString: string;
    /** Optional text that must appear immediately before the target edit region */
    beforeAnchor?: string;
    /** Optional text that must appear immediately after the target edit region */
    afterAnchor?: string;
}
import type { FilePatch } from "./patch-dsl-service.js";
/**
 * Request interface for the patch tool.
 * Applies structured patches to files.
 */
export interface PatchToolRequest extends ToolExecutionRequest {
    /** Array of file patches to apply */
    patches: readonly FilePatch[];
    /** If true, fail on conflicts */
    strictMode?: boolean;
    /** If true, allow creating new files */
    allowCreation?: boolean;
}
/**
 * Predefined metadata for the command execution tool (command_exec).
 * Configured as a high-risk tool that executes local processes.
 */
export declare const COMMAND_TOOL_METADATA: ToolExecutionMetadata;
/**
 * Predefined metadata for the edit/replace tool (edit_replace).
 * Configured as a high-risk but idempotent file modification tool.
 */
export declare const EDIT_TOOL_METADATA: ToolExecutionMetadata;
/**
 * Predefined metadata for the read tool.
 * Read-only, concurrency-safe file access.
 */
export declare const READ_TOOL_METADATA: ToolExecutionMetadata;
/**
 * Predefined metadata for bash tool (alias for command_exec).
 */
export declare const BASH_TOOL_METADATA: ToolExecutionMetadata;
/**
 * Predefined metadata for edit_batch tool (alias for edit_replace).
 */
export declare const EDIT_BATCH_TOOL_METADATA: ToolExecutionMetadata;
/**
 * Predefined metadata for the apply_patch tool.
 * High-risk file modification with structured patches.
 */
export declare const APPLY_PATCH_TOOL_METADATA: ToolExecutionMetadata;
/**
 * Predefined metadata for the question tool.
 * Read-only HITL interaction tool.
 */
export declare const QUESTION_TOOL_METADATA: ToolExecutionMetadata;
/**
 * Predefined metadata for the todo_write tool.
 * Medium-risk org state modification.
 */
export declare const TODO_WRITE_TOOL_METADATA: ToolExecutionMetadata;
/**
 * Predefined metadata for the web_search tool.
 * Medium-risk remote API access.
 */
export declare const WEB_SEARCH_TOOL_METADATA: ToolExecutionMetadata;
/**
 * Predefined metadata for the web_fetch tool.
 * Medium-risk remote API access.
 */
export declare const WEB_FETCH_TOOL_METADATA: ToolExecutionMetadata;
/**
 * Returns all built-in tool metadata entries.
 */
export declare function listBuiltinToolExecutionMetadata(): ToolExecutionMetadata[];
/**
 * Resolves tool execution metadata by tool name.
 *
 * @param toolName - Name of the tool
 * @returns Metadata if tool is built-in, null otherwise
 */
export declare function resolveToolExecutionMetadata(toolName: string): ToolExecutionMetadata | null;
/**
 * Resolves the effective timeout for a tool execution.
 * Priority: explicit request timeout > tool metadata default > fallback
 *
 * @param requestedTimeoutMs - Timeout requested by the caller
 * @param metadata - Tool metadata containing default timeout
 * @returns Effective timeout in milliseconds
 */
export declare function resolveToolTimeoutMs(requestedTimeoutMs: number | null | undefined, metadata: ToolExecutionMetadata | null | undefined): number;
/**
 * Determines if a tool failure is eligible for automatic retry.
 *
 * @param input - Contains metadata, status, error code, and source
 * @returns true if the failure can be retried
 */
export declare function isToolFailureRetryable(input: {
    metadata: ToolExecutionMetadata | null | undefined;
    status?: ToolCallStatus | null;
    source?: ToolCallErrorSource | null;
    errorCode?: string | null;
    requestedRetryable?: boolean | null | undefined;
}): boolean;
