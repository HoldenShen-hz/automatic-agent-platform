/**
 * @fileoverview Execution Resource Ceiling Guard - Enforces resource limits on executions.
 *
 * Monitors resource usage during execution and detects when executions exceed
 * configurable ceilings for:
 * - Tool call count: Maximum number of tool invocations per execution
 * - Memory usage: Maximum memory consumption in megabytes
 * - Elapsed time: Maximum execution duration in milliseconds
 *
 * When a ceiling is exceeded, a finding is generated with details about the
 * violation. These findings can be used to terminate runaway executions or
 * alert operators.
 *
 * Limits can be configured via constructor options or environment variables
 * (AA_MAX_TOOL_CALLS, AA_MAX_MEMORY_MB, AA_MAX_ELAPSED_MS).
 *
 * @see Resource Monitor: execution-resource-monitor.ts
 */
import type { ExecutionStatus } from "../../contracts/types/status.js";
/**
 * Configuration options for resource ceiling limits.
 *
 * All options are nullable - null means "no limit" for that dimension.
 * Defaults are loaded from environment variables if not provided.
 */
export interface ExecutionResourceCeilingOptions {
    maxToolCalls?: number | null;
    maxMemoryMb?: number | null;
    maxElapsedMs?: number | null;
}
/**
 * A snapshot of resource usage for an execution at a point in time.
 *
 * Used as input to evaluate() to check against configured ceilings.
 */
export interface ExecutionResourceUsageSample {
    executionId: string;
    taskId: string;
    agentId: string;
    status: ExecutionStatus | string;
    runtimeInstanceId?: string | null;
    currentStepId?: string | null;
    /** Current cumulative tool call count for this execution. */
    toolCallCount?: number | null;
    /** Current memory usage in megabytes. */
    memoryMb?: number | null;
    /** When the execution started, used to compute elapsed time. */
    startedAt?: string | null;
    /** Timestamp of this sample (defaults to now if not provided). */
    now?: string;
}
/**
 * A finding indicating that an execution exceeded a resource ceiling.
 *
 * Reports which dimension was exceeded, the actual vs limit values,
 * and a reason code for programmatic handling.
 */
export interface ExecutionResourceCeilingFinding {
    executionId: string;
    taskId: string;
    agentId: string;
    status: ExecutionStatus | string;
    runtimeInstanceId: string | null;
    currentStepId: string | null;
    observedAt: string;
    dimension: "tool_calls" | "memory_mb" | "elapsed_ms";
    reasonCode: "agent.resource_limit.tool_calls_exceeded" | "agent.resource_limit.memory_exceeded" | "agent.resource_limit.elapsed_exceeded";
    actual: number;
    limit: number;
    unit: "count" | "mb" | "ms";
    message: string;
}
/**
 * Guard that evaluates execution resource usage against configured ceilings.
 *
 * Checks each dimension independently, returning findings for any ceilings
 * that are exceeded. An execution may generate multiple findings if it
 * exceeds multiple limits simultaneously.
 */
export declare class ExecutionResourceCeilingGuard {
    private readonly maxToolCalls;
    private readonly maxMemoryMb;
    private readonly maxElapsedMs;
    constructor(options?: ExecutionResourceCeilingOptions);
    /**
     * Evaluates a usage sample against all configured ceilings.
     *
     * Returns an array of findings, one per dimension that exceeded its limit.
     * Returns an empty array if no ceilings were exceeded.
     */
    evaluate(sample: ExecutionResourceUsageSample): ExecutionResourceCeilingFinding[];
    /** Returns the first finding, or null if no ceiling was exceeded. */
    firstFinding(sample: ExecutionResourceUsageSample): ExecutionResourceCeilingFinding | null;
}
