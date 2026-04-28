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

import { loadExecutionResourceCeilingEnv } from "../../control-plane/config-center/runtime-env.js";
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
  reasonCode:
    | "agent.resource_limit.tool_calls_exceeded"
    | "agent.resource_limit.memory_exceeded"
    | "agent.resource_limit.elapsed_exceeded";
  actual: number;
  limit: number;
  unit: "count" | "mb" | "ms";
  message: string;
}

/** Default ceiling values when not configured via options or environment. */
const DEFAULT_MAX_TOOL_CALLS = 64;
const DEFAULT_MAX_MEMORY_MB = 2048;
const DEFAULT_MAX_ELAPSED_MS = 15 * 60 * 1000;

/**
 * Resolves a limit value from configuration.
 *
 * Respects explicit null (no limit), uses fallback for invalid/zero values,
 * and otherwise uses the provided value.
 */
function resolveLimit(value: number | null | undefined, fallback: number): number | null {
  if (value === null) {
    return null;
  }
  if (value == null) {
    return fallback;
  }
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.trunc(value);
}

function resolveNow(now: string | undefined): string {
  return now ?? new Date().toISOString();
}

function buildFinding(
  sample: ExecutionResourceUsageSample,
  observedAt: string,
  finding: Omit<
    ExecutionResourceCeilingFinding,
    "executionId" | "taskId" | "agentId" | "status" | "runtimeInstanceId" | "currentStepId" | "observedAt"
  >,
): ExecutionResourceCeilingFinding {
  return {
    executionId: sample.executionId,
    taskId: sample.taskId,
    agentId: sample.agentId,
    status: sample.status,
    runtimeInstanceId: sample.runtimeInstanceId ?? null,
    currentStepId: sample.currentStepId ?? null,
    observedAt,
    ...finding,
  };
}

/**
 * Guard that evaluates execution resource usage against configured ceilings.
 *
 * Checks each dimension independently, returning findings for any ceilings
 * that are exceeded. An execution may generate multiple findings if it
 * exceeds multiple limits simultaneously.
 */
export class ExecutionResourceCeilingGuard {
  private readonly maxToolCalls: number | null;
  private readonly maxMemoryMb: number | null;
  private readonly maxElapsedMs: number | null;

  public constructor(options: ExecutionResourceCeilingOptions = {}) {
    const envLimits = loadExecutionResourceCeilingEnv();
    this.maxToolCalls = resolveLimit(
      options.maxToolCalls ?? envLimits.maxToolCalls,
      DEFAULT_MAX_TOOL_CALLS,
    );
    this.maxMemoryMb = resolveLimit(
      options.maxMemoryMb ?? envLimits.maxMemoryMb,
      DEFAULT_MAX_MEMORY_MB,
    );
    this.maxElapsedMs = resolveLimit(
      options.maxElapsedMs ?? envLimits.maxElapsedMs,
      DEFAULT_MAX_ELAPSED_MS,
    );
  }

  /**
   * Evaluates a usage sample against all configured ceilings.
   *
   * Returns an array of findings, one per dimension that exceeded its limit.
   * Returns an empty array if no ceilings were exceeded.
   */
  public evaluate(sample: ExecutionResourceUsageSample): ExecutionResourceCeilingFinding[] {
    const observedAt = resolveNow(sample.now);
    const findings: ExecutionResourceCeilingFinding[] = [];

    if (this.maxToolCalls != null && sample.toolCallCount != null && sample.toolCallCount > this.maxToolCalls) {
      findings.push(
        buildFinding(sample, observedAt, {
          dimension: "tool_calls",
          reasonCode: "agent.resource_limit.tool_calls_exceeded",
          actual: Math.trunc(sample.toolCallCount),
          limit: this.maxToolCalls,
          unit: "count",
          message: `Execution ${sample.executionId} exceeded the tool-call ceiling (${Math.trunc(sample.toolCallCount)} > ${this.maxToolCalls}).`,
        }),
      );
    }

    if (this.maxMemoryMb != null && sample.memoryMb != null && sample.memoryMb > this.maxMemoryMb) {
      findings.push(
        buildFinding(sample, observedAt, {
          dimension: "memory_mb",
          reasonCode: "agent.resource_limit.memory_exceeded",
          actual: Math.trunc(sample.memoryMb),
          limit: this.maxMemoryMb,
          unit: "mb",
          message: `Execution ${sample.executionId} exceeded the memory ceiling (${Math.trunc(sample.memoryMb)}MB > ${this.maxMemoryMb}MB).`,
        }),
      );
    }

    if (this.maxElapsedMs != null && sample.startedAt != null) {
      const startedAtMs = Date.parse(sample.startedAt);
      const observedAtMs = Date.parse(observedAt);
      if (Number.isFinite(startedAtMs) && Number.isFinite(observedAtMs)) {
        const elapsedMs = Math.max(0, Math.trunc(observedAtMs - startedAtMs));
        if (elapsedMs > this.maxElapsedMs) {
          findings.push(
            buildFinding(sample, observedAt, {
              dimension: "elapsed_ms",
              reasonCode: "agent.resource_limit.elapsed_exceeded",
              actual: elapsedMs,
              limit: this.maxElapsedMs,
              unit: "ms",
              message: `Execution ${sample.executionId} exceeded the elapsed-time ceiling (${elapsedMs}ms > ${this.maxElapsedMs}ms).`,
            }),
          );
        }
      }
    }

    return findings;
  }

  /** Returns the first finding, or null if no ceiling was exceeded. */
  public firstFinding(sample: ExecutionResourceUsageSample): ExecutionResourceCeilingFinding | null {
    return this.evaluate(sample)[0] ?? null;
  }
}
