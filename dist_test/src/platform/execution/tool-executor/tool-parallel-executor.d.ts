/**
 * @fileoverview Tool Parallel Executor - Concurrent-safe parallel tool execution.
 *
 * Provides parallel execution capabilities for tools that are deemed safe to run concurrently,
 * based on their metadata characteristics (read-only status, file lock requirements, etc.).
 *
 * Key concepts:
 * - Concurrent-safe tools: tools that can execute in parallel without interfering with each other
 * - Write tools: require exclusive access and must be serialized
 * - Read tools: can run in parallel with other read-only tools
 * - Side effect awareness: tools with side effects are handled carefully
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/contracts/tool_contract.md}
 */
import type { ToolExecutionMetadata } from "./tool-metadata.js";
/**
 * Result of a parallel tool execution containing all individual tool results.
 */
export interface ParallelToolExecutionResult<T> {
    /** Results for each tool execution, in the same order as inputs */
    results: readonly T[];
    /** Errors that occurred during parallel execution */
    errors: readonly ParallelToolExecutionError[];
    /** Whether all executions succeeded */
    allSucceeded: boolean;
    /** Whether any execution failed */
    anyFailed: boolean;
}
/**
 * Error information for a failed tool execution in parallel mode.
 */
export interface ParallelToolExecutionError {
    /** Index in the original input array where this tool was specified */
    index: number;
    /** Tool name that failed */
    toolName: string;
    /** Error that caused the failure */
    error: unknown;
}
/**
 * Determines if a tool is safe to execute in parallel with other tools.
 * A tool is concurrent-safe if:
 * - It is read-only, OR
 * - It requires only a read lock (which can be shared), OR
 * - It has no file lock requirements
 *
 * @param metadata - Tool execution metadata
 * @returns true if the tool can run in parallel with other concurrent-safe tools
 */
export declare function isConcurrentSafe(metadata: ToolExecutionMetadata): boolean;
/**
 * Determines if a tool requires exclusive execution (cannot run in parallel).
 * A tool requires exclusive execution if:
 * - It has side effects beyond local scope, OR
 * - It requires a write lock, OR
 * - It is not idempotent and has local_file side effects
 *
 * @param metadata - Tool execution metadata
 * @returns true if the tool must run exclusively (serialized with other tools)
 */
export declare function requiresExclusiveExecution(metadata: ToolExecutionMetadata): boolean;
/**
 * Partitions a list of tools into concurrent-safe groups that can be executed in parallel.
 *
 * @param toolMetadatas - Array of tool metadata in execution order
 * @returns Array of groups; each group contains indices of tools that can run in parallel
 */
export declare function partitionParallelToolGroups(toolMetadatas: readonly ToolExecutionMetadata[]): readonly number[][];
/**
 * Checks if a set of tool metadatas can be safely executed in parallel.
 *
 * @param metadatas - Tool metadatas to check
 * @returns true if all tools can run in parallel
 */
export declare function canExecuteInParallel(metadatas: readonly ToolExecutionMetadata[]): boolean;
/**
 * Result of partitioning tools into parallel and exclusive execution groups.
 */
export interface ToolExecutionPartition {
    /** Indices of tools that can execute in parallel */
    parallelIndices: readonly number[];
    /** Indices of tools that require exclusive execution */
    exclusiveIndices: readonly number[];
    /** Whether the partition is valid (no conflicts) */
    isValid: boolean;
    /** Explanation of why partition is invalid (if applicable) */
    invalidReason?: string;
}
/**
 * Partitions tools into those that can run in parallel and those that must run exclusively.
 * Returns detailed information about the partition validity.
 *
 * @param toolMetadatas - Array of tool metadata to partition
 * @returns Partition result with parallel and exclusive groups
 */
export declare function partitionToolsByExecutionMode(toolMetadatas: readonly ToolExecutionMetadata[]): ToolExecutionPartition;
/**
 * Options for parallel tool execution.
 */
export interface ParallelToolExecutorOptions {
    /** Maximum number of tools to execute in parallel (default: 4) */
    maxParallelism?: number;
    /** Whether to stop execution on first failure (default: false) */
    failFast?: boolean;
    /** Logger function for debugging */
    logger?: (message: string, context?: Record<string, unknown>) => void;
}
/**
 * Executes multiple tool functions in parallel when they are concurrent-safe.
 *
 * @param toolFunctions - Array of tool functions to execute
 * @param toolMetadatas - Array of corresponding tool metadata
 * @param options - Execution options
 * @returns Promise resolving to parallel execution results
 */
export declare function executeToolsInParallel<T>(toolFunctions: readonly (() => Promise<T>)[], toolMetadatas: readonly ToolExecutionMetadata[], options?: ParallelToolExecutorOptions): Promise<ParallelToolExecutionResult<T>>;
/**
 * Metadata and function pair for parallel execution.
 */
export interface ToolExecutionItem<T> {
    metadata: ToolExecutionMetadata;
    execute: () => Promise<T>;
}
/**
 * Executes multiple tool items in parallel, respecting concurrency constraints.
 *
 * @param items - Array of tool execution items (metadata + function)
 * @param options - Execution options
 * @returns Promise resolving to parallel execution results
 */
export declare function executeToolItemsInParallel<T>(items: readonly ToolExecutionItem<T>[], options?: ParallelToolExecutorOptions): Promise<ParallelToolExecutionResult<T>>;
