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
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/automatic_agent_patform_arthitecture_design.md}
 */

import type { SandboxPolicy } from "../../control-plane/iam/sandbox-policy.js";
import type { ToolCallErrorSource, ToolCallStatus } from "./tool-call-result.js";

/**
 * Describes the scope of side effects a tool may produce during execution.
 * Used for risk assessment and sandbox policy enforcement.
 */
export type ToolSideEffectScope =
  | "none"
  | "local_file"
  | "local_process"
  | "remote_api"
  | "billing"
  | "org_state";

/**
 * Defines the strategy for recovering from tool execution failures.
 * Determines whether a failed tool call can be safely retried.
 */
export type ToolRecoveryStrategy =
  | "retry_safe"
  | "retry_with_check"
  | "skip_if_verified"
  | "manual_resume_required";

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
export const COMMAND_TOOL_METADATA: ToolExecutionMetadata = {
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
export const EDIT_TOOL_METADATA: ToolExecutionMetadata = {
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
export const READ_TOOL_METADATA: ToolExecutionMetadata = {
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
export const BASH_TOOL_METADATA: ToolExecutionMetadata = {
  ...COMMAND_TOOL_METADATA,
  toolName: "bash",
};

/**
 * Predefined metadata for edit_batch tool (alias for edit_replace).
 */
export const EDIT_BATCH_TOOL_METADATA: ToolExecutionMetadata = {
  ...EDIT_TOOL_METADATA,
  toolName: "edit_batch",
};

/**
 * Predefined metadata for the apply_patch tool.
 * High-risk file modification with structured patches.
 */
export const APPLY_PATCH_TOOL_METADATA: ToolExecutionMetadata = {
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
export const QUESTION_TOOL_METADATA: ToolExecutionMetadata = {
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
export const TODO_WRITE_TOOL_METADATA: ToolExecutionMetadata = {
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
export const WEB_SEARCH_TOOL_METADATA: ToolExecutionMetadata = {
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
export const WEB_FETCH_TOOL_METADATA: ToolExecutionMetadata = {
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
const BUILTIN_TOOL_METADATA_BY_NAME = new Map<string, ToolExecutionMetadata>([
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
export function listBuiltinToolExecutionMetadata(): ToolExecutionMetadata[] {
  return [...BUILTIN_TOOL_METADATA_BY_NAME.values()];
}

/**
 * Resolves tool execution metadata by tool name.
 *
 * @param toolName - Name of the tool
 * @returns Metadata if tool is built-in, null otherwise
 */
export function resolveToolExecutionMetadata(toolName: string): ToolExecutionMetadata | null {
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
export function resolveToolTimeoutMs(
  requestedTimeoutMs: number | null | undefined,
  metadata: ToolExecutionMetadata | null | undefined,
): number {
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
export function isToolFailureRetryable(input: {
  metadata: ToolExecutionMetadata | null | undefined;
  status?: ToolCallStatus | null;
  source?: ToolCallErrorSource | null;
  errorCode?: string | null;
  requestedRetryable?: boolean | null | undefined;
}): boolean {
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
