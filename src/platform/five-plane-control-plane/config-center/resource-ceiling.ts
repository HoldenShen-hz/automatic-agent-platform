/**
 * @fileoverview Resource Ceiling Guard interface.
 *
 * Defines the contract for resource ceiling guards that evaluate execution
 * resource usage against configured limits without importing execution-plane
 * implementation classes.
 */

export interface ExecutionResourceUsageSample {
  executionId: string;
  taskId: string;
  agentId: string;
  status: string;
  runtimeInstanceId?: string | null;
  currentStepId?: string | null;
  toolCallCount?: number | null;
  memoryMb?: number | null;
  startedAt?: string | null;
  now?: string;
}

export interface ExecutionResourceCeilingFinding {
  executionId: string;
  taskId: string;
  agentId: string;
  status: string;
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

/**
 * Interface for resource ceiling guards.
 *
 * Implementations evaluate execution resource usage samples against
 * configured ceilings and return findings when limits are exceeded.
 */
export interface ResourceCeilingGuard {
  /**
   * Evaluates a usage sample against all configured ceilings.
   *
   * @param sample - Resource usage sample to evaluate
   * @returns Array of findings, one per dimension that exceeded its limit
   */
  evaluate(sample: ExecutionResourceUsageSample): ExecutionResourceCeilingFinding[];

  /**
   * Returns the first finding, or null if no ceiling was exceeded.
   *
   * @param sample - Resource usage sample to evaluate
   * @returns First finding or null
   */
  firstFinding(sample: ExecutionResourceUsageSample): ExecutionResourceCeilingFinding | null;
}

export function createDefaultResourceCeilingGuard(): ResourceCeilingGuard {
  return new DefaultResourceCeilingGuard();
}

const DEFAULT_MAX_TOOL_CALLS = 64;
const DEFAULT_MAX_MEMORY_MB = 2048;
const DEFAULT_MAX_ELAPSED_MS = 15 * 60 * 1000;

class DefaultResourceCeilingGuard implements ResourceCeilingGuard {
  private readonly maxToolCalls = readLimit("AA_MAX_TOOL_CALLS", DEFAULT_MAX_TOOL_CALLS);
  private readonly maxMemoryMb = readLimit("AA_MAX_MEMORY_MB", DEFAULT_MAX_MEMORY_MB);
  private readonly maxElapsedMs = readLimit("AA_MAX_ELAPSED_MS", DEFAULT_MAX_ELAPSED_MS);

  public evaluate(sample: ExecutionResourceUsageSample): ExecutionResourceCeilingFinding[] {
    const observedAt = sample.now ?? new Date().toISOString();
    const findings: ExecutionResourceCeilingFinding[] = [];
    if (this.maxToolCalls != null && sample.toolCallCount != null && sample.toolCallCount > this.maxToolCalls) {
      findings.push(buildFinding(sample, observedAt, "tool_calls", "agent.resource_limit.tool_calls_exceeded", sample.toolCallCount, this.maxToolCalls, "count"));
    }
    if (this.maxMemoryMb != null && sample.memoryMb != null && sample.memoryMb > this.maxMemoryMb) {
      findings.push(buildFinding(sample, observedAt, "memory_mb", "agent.resource_limit.memory_exceeded", sample.memoryMb, this.maxMemoryMb, "mb"));
    }
    if (this.maxElapsedMs != null && sample.startedAt != null) {
      const elapsedMs = Date.parse(observedAt) - Date.parse(sample.startedAt);
      if (Number.isFinite(elapsedMs) && elapsedMs > this.maxElapsedMs) {
        findings.push(buildFinding(sample, observedAt, "elapsed_ms", "agent.resource_limit.elapsed_exceeded", elapsedMs, this.maxElapsedMs, "ms"));
      }
    }
    return findings;
  }

  public firstFinding(sample: ExecutionResourceUsageSample): ExecutionResourceCeilingFinding | null {
    return this.evaluate(sample)[0] ?? null;
  }
}

function readLimit(name: string, fallback: number): number | null {
  const raw = process.env[name]?.trim();
  if (raw == null || raw.length === 0) {
    return fallback;
  }
  if (raw.toLowerCase() === "null") {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function buildFinding(
  sample: ExecutionResourceUsageSample,
  observedAt: string,
  dimension: ExecutionResourceCeilingFinding["dimension"],
  reasonCode: ExecutionResourceCeilingFinding["reasonCode"],
  actual: number,
  limit: number,
  unit: ExecutionResourceCeilingFinding["unit"],
): ExecutionResourceCeilingFinding {
  const actualValue = Math.trunc(actual);
  return {
    executionId: sample.executionId,
    taskId: sample.taskId,
    agentId: sample.agentId,
    status: sample.status,
    runtimeInstanceId: sample.runtimeInstanceId ?? null,
    currentStepId: sample.currentStepId ?? null,
    observedAt,
    dimension,
    reasonCode,
    actual: actualValue,
    limit,
    unit,
    message: `Execution ${sample.executionId} exceeded the ${dimension} ceiling (${actualValue}${unit === "count" ? "" : unit} > ${limit}${unit === "count" ? "" : unit}).`,
  };
}
