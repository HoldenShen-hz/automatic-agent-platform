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
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/tool_contract.md}
 */

import { ValidationError } from "../../contracts/errors.js";
import type { ToolExecutionMetadata } from "./tool-metadata.js";

/**
 * Result of a parallel tool execution containing all individual tool results.
 */
export interface ParallelToolExecutionResult<T> {
  /** Successful results, preserved in input order without failed-position holes */
  results: readonly T[];
  /** Indexed results preserve original positions and make missing slots explicit. */
  resultsByIndex: readonly (T | null)[];
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
export function isConcurrentSafe(metadata: ToolExecutionMetadata): boolean {
  if (metadata.isConcurrencySafe != null) {
    return metadata.isConcurrencySafe;
  }

  if (metadata.readOnly) {
    return true;
  }

  if (metadata.needsFileLock === "none") {
    return true;
  }

  if (metadata.needsFileLock === "read") {
    return true;
  }

  return false;
}

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
export function requiresExclusiveExecution(metadata: ToolExecutionMetadata): boolean {
  if (metadata.needsFileLock === "write" || metadata.needsFileLock === "dynamic") {
    return true;
  }

  if (metadata.sideEffectScope === "remote_api" || metadata.sideEffectScope === "org_state") {
    return true;
  }

  if (!metadata.readOnly && !metadata.idempotent && metadata.sideEffectScope === "local_file") {
    return true;
  }

  return false;
}

/**
 * Partitions a list of tools into concurrent-safe groups that can be executed in parallel.
 *
 * @param toolMetadatas - Array of tool metadata in execution order
 * @returns Array of groups; each group contains indices of tools that can run in parallel
 */
export function partitionParallelToolGroups(
  toolMetadatas: readonly ToolExecutionMetadata[],
): readonly number[][] {
  if (toolMetadatas.length === 0) {
    return [];
  }

  if (toolMetadatas.length === 1) {
    return [[0]];
  }

  const groups: number[][] = [];
  let currentGroup: number[] = [];
  let hasExclusiveInGroup = false;

  for (let i = 0; i < toolMetadatas.length; i++) {
    const metadata = toolMetadatas[i];
    if (metadata == null) {
      continue;
    }

    if (requiresExclusiveExecution(metadata)) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
        hasExclusiveInGroup = false;
      }
      groups.push([i]);
      hasExclusiveInGroup = false;
    } else if (isConcurrentSafe(metadata)) {
      if (hasExclusiveInGroup) {
        groups.push(currentGroup);
        currentGroup = [i];
        hasExclusiveInGroup = false;
      } else {
        currentGroup.push(i);
      }
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
        hasExclusiveInGroup = false;
      }
      currentGroup.push(i);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Checks if a set of tool metadatas can be safely executed in parallel.
 *
 * @param metadatas - Tool metadatas to check
 * @returns true if all tools can run in parallel
 */
export function canExecuteInParallel(
  metadatas: readonly ToolExecutionMetadata[],
): boolean {
  if (metadatas.length <= 1) {
    return true;
  }

  for (const metadata of metadatas) {
    if (requiresExclusiveExecution(metadata)) {
      return false;
    }
    if (!isConcurrentSafe(metadata)) {
      return false;
    }
  }

  return true;
}

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
export function partitionToolsByExecutionMode(
  toolMetadatas: readonly ToolExecutionMetadata[],
): ToolExecutionPartition {
  if (toolMetadatas.length === 0) {
    return {
      parallelIndices: [],
      exclusiveIndices: [],
      isValid: true,
    };
  }

  const parallelIndices: number[] = [];
  const exclusiveIndices: number[] = [];

  for (let i = 0; i < toolMetadatas.length; i++) {
    const metadata = toolMetadatas[i];
    if (metadata == null) {
      continue;
    }

    if (requiresExclusiveExecution(metadata)) {
      exclusiveIndices.push(i);
    } else if (isConcurrentSafe(metadata)) {
      parallelIndices.push(i);
    } else {
      exclusiveIndices.push(i);
    }
  }

  if (exclusiveIndices.length > 1) {
    return {
      parallelIndices,
      exclusiveIndices,
      isValid: false,
      invalidReason: "Multiple tools require exclusive execution but have conflicting requirements",
    };
  }

  return {
    parallelIndices,
    exclusiveIndices,
    isValid: true,
  };
}

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
export async function executeToolsInParallel<T>(
  toolFunctions: readonly (() => Promise<T>)[],
  toolMetadatas: readonly ToolExecutionMetadata[],
  options: ParallelToolExecutorOptions = {},
): Promise<ParallelToolExecutionResult<T>> {
  const { maxParallelism = 4, failFast = false, logger } = options;

  if (toolFunctions.length !== toolMetadatas.length) {
    throw new ValidationError(
      "tool_parallel.length_mismatch",
      "tool_parallel.length_mismatch: toolFunctions and toolMetadatas must have same length",
      {
        source: "tool",
        details: {
          functionCount: toolFunctions.length,
          metadataCount: toolMetadatas.length,
        },
      },
    );
  }

  if (toolFunctions.length === 0) {
    return { results: [], resultsByIndex: [], errors: [], allSucceeded: true, anyFailed: false };
  }

  if (toolFunctions.length === 1) {
    try {
      const firstFn = toolFunctions[0];
      if (firstFn == null) {
        throw new ValidationError("tool_parallel.null_function", "tool_parallel.null_function: first tool function is null", {
          source: "tool",
          details: { index: 0 },
        });
      }
      const result = await firstFn();
      return { results: [result], resultsByIndex: [result], errors: [], allSucceeded: true, anyFailed: false };
    } catch (error) {
      return {
        results: [],
        resultsByIndex: [null],
        errors: [{ index: 0, toolName: toolMetadatas[0]?.toolName ?? "unknown", error }],
        allSucceeded: false,
        anyFailed: true,
      };
    }
  }

  const partition = partitionToolsByExecutionMode(toolMetadatas);

  if (!partition.isValid) {
    logger?.("partition_invalid", { reason: partition.invalidReason });
  }

  const results: (T | undefined)[] = new Array(toolFunctions.length);
  const errors: ParallelToolExecutionError[] = [];

  // Iterate in original order to preserve execution order.
  // Group consecutive parallel tools together, but execute exclusive tools
  // immediately when encountered (interleaving order is preserved).
  let parallelBatch: number[] = [];

  const executeBatch = async (indices: number[]): Promise<void> => {
    if (indices.length === 0) return;
    for (let offset = 0; offset < indices.length; offset += maxParallelism) {
      const chunk = indices.slice(offset, offset + maxParallelism);
      const batchFns = chunk
        .map(i => toolFunctions[i])
        .filter((fn): fn is () => Promise<T> => fn != null);
      const batchResults = await Promise.allSettled(batchFns.map(fn => fn()));
      for (let i = 0; i < batchResults.length; i++) {
        const settledResult = batchResults[i];
        if (settledResult == null) continue;
        const originalIndex = chunk[i];
        if (originalIndex == null) continue;
        if (settledResult.status === "fulfilled") {
          results[originalIndex] = settledResult.value;
        } else {
          errors.push({
            index: originalIndex,
            toolName: toolMetadatas[originalIndex]?.toolName ?? "unknown",
            error: settledResult.reason,
          });
        }
      }
    }
  };

  for (let i = 0; i < toolMetadatas.length; i++) {
    if (failFast && errors.length > 0) break;

    const metadata = toolMetadatas[i];
    if (metadata == null) continue;

    if (requiresExclusiveExecution(metadata)) {
      // Execute any pending parallel batch first to preserve order
      await executeBatch(parallelBatch);
      parallelBatch = [];

      // Execute exclusive tool immediately
      logger?.("executing_exclusive", {
        index: i,
        toolName: metadata.toolName,
      });
      const exclusiveFn = toolFunctions[i];
      if (exclusiveFn != null) {
        try {
          results[i] = await exclusiveFn();
        } catch (error) {
          errors.push({
            index: i,
            toolName: metadata.toolName ?? "unknown",
            error,
          });
        }
      }
    } else if (isConcurrentSafe(metadata)) {
      parallelBatch.push(i);
    } else {
      // Non-concurrent-safe non-exclusive tool - execute any pending batch and itself
      await executeBatch(parallelBatch);
      parallelBatch = [];
      const fn = toolFunctions[i];
      if (fn != null) {
        try {
          results[i] = await fn();
        } catch (error) {
          errors.push({
            index: i,
            toolName: metadata.toolName ?? "unknown",
            error,
          });
        }
      }
    }
  }

  // Execute any remaining parallel batch
  await executeBatch(parallelBatch);

  return {
    results: results.filter((value): value is T => value !== undefined),
    resultsByIndex: Array.from({ length: results.length }, (_, index) => results[index] ?? null),
    errors,
    allSucceeded: errors.length === 0,
    anyFailed: errors.length > 0,
  };
}

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
export async function executeToolItemsInParallel<T>(
  items: readonly ToolExecutionItem<T>[],
  options: ParallelToolExecutorOptions = {},
): Promise<ParallelToolExecutionResult<T>> {
  const functions = items.map(item => item.execute);
  const metadatas = items.map(item => item.metadata);
  return executeToolsInParallel(functions, metadatas, options);
}
