import type { ModelMetadataRegistry, ModelProfileMetadata } from "../../control-plane/config-center/model-metadata-registry.js";
import type { ResourceCeilingGuard } from "../../control-plane/config-center/resource-ceiling.js";
import type { StepOutputRecord } from "../../contracts/types/domain.js";
import type { ToolCallErrorSource, ToolCallStatus } from "./tool-call-result.js";
import type { ToolExecutionMetadata, ToolRecoveryStrategy } from "./tool-metadata.js";
export interface SkillStepDefinition {
    /** Unique identifier for this step */
    stepId: string;
    /** Name of the tool to invoke for this step */
    toolName: string;
    /** Human-readable description of what this step does */
    description?: string;
    /** What to do when this step fails (default: "fail") */
    onFailure?: "fail" | "continue" | "retry";
    /** Maximum number of attempts (including retries) */
    maxAttempts?: number;
    /** Input parameters to pass to the tool */
    input?: Record<string, unknown>;
    /** Model profile overrides for specific tools */
    modelOverrides?: readonly SkillStepModelOverride[];
}
/**
 * Model profile override for a specific tool in a step.
 */
export interface SkillStepModelOverride {
    /** Tool name this override applies to */
    toolName: string;
    /** Only apply if profile name matches (null/empty means all profiles) */
    profileNames?: readonly string[];
    /** Only apply if tier matches (null/empty means all tiers) */
    tiers?: readonly ModelProfileMetadata["tier"][];
    /** Only apply if profile has these capabilities */
    requiredCapabilities?: readonly string[];
}
/**
 * Complete skill definition including metadata and steps.
 */
export interface SkillDefinition {
    /** Unique skill identifier */
    skillId: string;
    /** Semantic version */
    version: string;
    /** Human-readable description */
    description: string;
    /** Tools required by this skill */
    requiredTools: readonly string[];
    /** Ordered steps to execute */
    steps: readonly SkillStepDefinition[];
    /** Whether results can be cached */
    cacheable?: boolean;
    /** Cache TTL in seconds (default: 3600) */
    cacheTtlSeconds?: number;
}
/**
 * Request to invoke a tool within a skill step.
 */
export interface SkillToolCallRequest {
    /** Skill this call belongs to */
    skillId: string;
    /** Skill version */
    skillVersion: string;
    /** Execution context ID */
    executionId: string;
    /** Task context ID */
    taskId: string;
    /** Distributed tracing ID */
    traceId: string;
    /** Step this call belongs to */
    stepId: string;
    /** Tool to invoke */
    toolName: string;
    /** Current attempt number (1-indexed) */
    attempt: number;
    /** Maximum attempts allowed */
    maxAttempts: number;
    /** Timeout in milliseconds */
    timeoutMs: number;
    /** Recovery strategy from tool metadata */
    recoveryStrategy: ToolRecoveryStrategy;
    /** Input parameters for the tool */
    input: Record<string, unknown>;
}
/**
 * Result of a tool call within a skill step.
 */
export interface SkillToolCallResult {
    /** Whether the call succeeded */
    success: boolean;
    /** Call status */
    status?: ToolCallStatus;
    /** Human-readable summary */
    summary?: string;
    /** Output content */
    output?: string;
    /** Structured result data */
    data?: Record<string, unknown> | null;
    /** Error code if failed */
    errorCode?: string | null;
    /** Whether this error can be retried */
    retryable?: boolean;
    /** Source of the error */
    errorSource?: ToolCallErrorSource | null;
    /** Duration in milliseconds */
    durationMs?: number;
}
/**
 * Request to execute a complete skill.
 */
export interface SkillExecutionRequest {
    /** Execution context ID */
    executionId: string;
    /** Skill definition to execute */
    skill: SkillDefinition;
    /** Optional override for allowed tools */
    allowedTools?: readonly string[];
    /** Cache policy for this execution */
    cache?: SkillExecutionCachePolicy;
    /** Model profile to use */
    modelProfileName?: string | null;
}
/**
 * Result of a single step execution.
 */
export interface SkillStepExecutionResult {
    /** Step identifier */
    stepId: string;
    /** Tool that was invoked */
    toolName: string;
    /** Final status of the step */
    status: StepOutputRecord["status"];
    /** Number of attempts made */
    attempts: number;
    /** Number of retries performed */
    retryCount: number;
    /** Whether execution continued after failure (for onFailure="continue") */
    continuedAfterFailure: boolean;
    /** Error code if failed */
    errorCode: string | null;
}
/**
 * Final result of skill execution.
 */
export interface SkillExecutionResult {
    /** Overall execution status */
    status: "succeeded" | "completed_with_failures" | "failed";
    /** Execution context ID */
    executionId: string;
    /** Task context ID */
    taskId: string;
    /** Skill identifier */
    skillId: string;
    /** Results of each step */
    steps: SkillStepExecutionResult[];
    /** Total retry count across all steps */
    retryCount: number;
    /** Cache metadata for this execution */
    cache: SkillExecutionCacheMetadata;
}
/**
 * Function type for the tool runner that executes actual tool calls.
 */
export type SkillToolRunner = (request: SkillToolCallRequest) => Promise<SkillToolCallResult> | SkillToolCallResult;
/**
 * Policy controlling skill execution caching behavior.
 */
export interface SkillExecutionCachePolicy {
    /** Whether caching is enabled (default: true) */
    enabled?: boolean;
    /** Additional parameters to include in cache key */
    parameters?: Record<string, unknown>;
    /** Working directory for git head resolution */
    workingDirectory?: string | null;
    /** Explicit source hash (alternative to git head) */
    sourceHash?: string | null;
}
/**
 * Metadata about the cache status for an execution.
 */
export interface SkillExecutionCacheMetadata {
    /** Whether this execution was eligible for caching */
    eligible: boolean;
    /** Whether caching is enabled */
    enabled: boolean;
    /** Cache status (disabled, ineligible, miss, hit, stored) */
    status: "disabled" | "ineligible" | "miss" | "hit" | "stored";
    /** Cache key if eligible */
    key: string | null;
    /** Working directory used for cache key */
    workingDirectory: string | null;
    /** Git commit hash used for cache key */
    gitHead: string | null;
    /** Source hash used for cache key */
    sourceHash: string | null;
    /** When the cached result was stored */
    storedAt: string | null;
    /** When the cached result expires */
    expiresAt: string | null;
    /** Why caching was not eligible (if applicable) */
    reason: string | null;
}
/**
 * Options for configuring SkillExecutionService.
 */
export interface SkillExecutionServiceOptions {
    /** Maximum number of cache entries to keep (default: 100) */
    cacheMaxEntries?: number;
    /** Custom function to resolve git HEAD (default: runs git rev-parse HEAD) */
    gitHeadResolver?: (workingDirectory: string) => Promise<string | null> | string | null;
    /** Model metadata registry for profile resolution */
    modelMetadataRegistry?: ModelMetadataRegistry;
    /** Custom tool metadata resolver (default: uses built-in metadata) */
    toolMetadataResolver?: (toolName: string) => ToolExecutionMetadata | null;
    /** Resource ceiling guard for limiting execution */
    resourceCeilingGuard?: ResourceCeilingGuard;
}
/**
 * Internal structure for cached step results.
 */
export interface CachedSkillStepResult {
    stepId: string;
    requestedToolName: string;
    resolvedToolName: string;
    status: StepOutputRecord["status"];
    attempts: number;
    maxAttempts: number;
    retryCount: number;
    continuedAfterFailure: boolean;
    errorCode: string | null;
    summary: string | null;
    output: string | null;
    data: Record<string, unknown> | null;
    onFailure: "fail" | "continue" | "retry";
    durationMs: number;
}
/**
 * Internal structure for a complete cached skill execution.
 */
export interface CachedSkillExecutionEntry {
    key: string;
    skillId: string;
    skillVersion: string;
    workingDirectory: string | null;
    gitHead: string | null;
    sourceHash: string | null;
    createdAt: string;
    expiresAt: string;
    resultStatus: "succeeded";
    retryCount: number;
    steps: CachedSkillStepResult[];
}
/**
 * Result of a cache lookup operation.
 */
export interface CacheLookup {
    metadata: SkillExecutionCacheMetadata;
    entry: CachedSkillExecutionEntry | null;
}
/**
 * Resolved model profile with metadata.
 */
export interface ResolvedSkillModelProfile {
    profileName: string;
    profile: ModelProfileMetadata;
}
/**
 * Resolved step with tool name resolved and model overrides applied.
 */
export interface ResolvedSkillStep {
    stepId: string;
    requestedToolName: string;
    resolvedToolName: string;
    description: string | undefined;
    onFailure: "fail" | "continue" | "retry" | undefined;
    maxAttempts: number | undefined;
    input: Record<string, unknown> | undefined;
    modelOverrideApplied: boolean;
}
/**
 * Normalizes the max attempts value, defaulting based on failure mode.
 */
export declare function normalizeAttempts(step: {
    maxAttempts: number | undefined;
    onFailure: "fail" | "continue" | "retry" | undefined;
}): number;
/**
 * Generates a default summary message for a step result.
 */
export declare function defaultSummary(step: {
    stepId: string;
    resolvedToolName: string;
}, status: StepOutputRecord["status"]): string;
/**
 * Creates a stable serialization of a value for use in cache keys.
 * Handles arrays, objects (with sorted keys), and primitives.
 */
export declare function stableSerialize(value: unknown): string;
/**
 * Normalizes a working directory path, resolving symlinks.
 */
export declare function normalizeWorkingDirectory(workingDirectory: string | null | undefined): string | null;
/**
 * Default implementation of git HEAD resolver.
 * Runs `git rev-parse HEAD` in the working directory.
 */
export declare function defaultGitHeadResolver(workingDirectory: string): Promise<string | null>;
/**
 * SkillExecutionService executes multi-step skills with caching and observability.
 *
 * The service:
 * 1. Resolves skill steps and validates tool access
 * 2. Checks cache for previous successful execution (based on git head/source hash)
 * 3. Executes steps sequentially, applying retry logic per step
 * 4. Publishes events for each step transition and overall completion
 * 5. Stores results and updates execution records
 *
 * Each step can specify:
 * - onFailure: "fail" (stop execution), "continue" (mark partial_success), or "retry" (retry the step)
 * - maxAttempts: Number of retry attempts for retry mode
 * - modelOverrides: Override model profile for specific tools
 */
