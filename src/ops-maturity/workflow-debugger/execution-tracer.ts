/**
 * @fileoverview Execution Tracer
 *
 * Provides:
 * - Workflow execution flow tracing
 * - Event recording with timestamps
 * - Trace playback and navigation
 * - Performance measurement
 *
 * §64 调试器 - 执行追踪器
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";

export type TraceStatus = "active" | "paused" | "completed" | "aborted";

export interface TraceEvent {
  readonly eventId: string;
  readonly nodeRunId: string;
  /** @deprecated compatibility alias; use nodeRunId */
  readonly stepId?: string;
  readonly eventType: "enter" | "exit" | "error" | "variable_change" | "checkpoint";
  readonly timestamp: string;
  readonly durationMs: number | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ExecutionTrace {
  readonly traceId: string;
  readonly planGraphId: string;
  readonly harnessRunId: string;
  /** @deprecated compatibility alias; use planGraphId */
  readonly workflowId?: string;
  /** @deprecated compatibility alias; use harnessRunId */
  readonly executionId?: string;
  readonly status: TraceStatus;
  readonly events: readonly TraceEvent[];
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly totalDurationMs: number | null;
}

export interface TraceFilter {
  readonly nodeRunId?: string;
  /** @deprecated compatibility alias; use nodeRunId */
  readonly stepId?: string;
  readonly eventType?: TraceEvent["eventType"];
  readonly fromTimestamp?: string;
  readonly toTimestamp?: string;
}

export interface ExecutionTracerOptions {
  maxEventsPerTrace?: number;
  captureMetadata?: boolean;
  measurePerformance?: boolean;
}

export class ExecutionTracer {
  private readonly maxEventsPerTrace: number;
  private readonly captureMetadata: boolean;
  private readonly measurePerformance: boolean;
  private activeTraces = new Map<string, ExecutionTrace>();
  private activeEvents = new Map<string, TraceEvent[]>();
  private traceStartTimes = new Map<string, number>();

  public constructor(options: ExecutionTracerOptions = {}) {
    this.maxEventsPerTrace = options.maxEventsPerTrace ?? 10_000;
    this.captureMetadata = options.captureMetadata ?? true;
    this.measurePerformance = options.measurePerformance ?? true;
  }

  public startTrace(planGraphId: string, harnessRunId: string): ExecutionTrace {
    const traceId = newId("trace");
    const startedAt = nowIso();
    this.traceStartTimes.set(traceId, Date.now());

    const trace: ExecutionTrace = {
      traceId,
      planGraphId,
      harnessRunId,
      workflowId: planGraphId,
      executionId: harnessRunId,
      status: "active",
      events: [],
      startedAt,
      endedAt: null,
      totalDurationMs: null,
    };

    this.activeTraces.set(traceId, trace);
    this.activeEvents.set(traceId, []);

    return trace;
  }

  public recordEvent(
    traceId: string,
    nodeRunId: string,
    eventType: TraceEvent["eventType"],
    metadata: Record<string, unknown> = {},
  ): TraceEvent | null {
    const trace = this.activeTraces.get(traceId);
    if (!trace || trace.status !== "active") {
      return null;
    }

    const events = this.activeEvents.get(traceId) ?? [];
    if (events.length >= this.maxEventsPerTrace) {
      return null;
    }

    const startTime = this.traceStartTimes.get(traceId) ?? Date.now();
    const durationMs = this.measurePerformance ? Date.now() - startTime : null;

    const event: TraceEvent = {
      eventId: newId("evt"),
      nodeRunId,
      stepId: nodeRunId,
      eventType,
      timestamp: nowIso(),
      durationMs,
      metadata: this.captureMetadata ? { ...metadata } : {},
    };

    this.activeEvents.set(traceId, [...events, event]);
    return event;
  }

  public pauseTrace(traceId: string): boolean {
    const trace = this.activeTraces.get(traceId);
    if (!trace || trace.status !== "active") {
      return false;
    }

    const updated: ExecutionTrace = {
      ...trace,
      status: "paused",
    };

    this.activeTraces.set(traceId, updated);
    return true;
  }

  public resumeTrace(traceId: string): boolean {
    const trace = this.activeTraces.get(traceId);
    if (!trace || trace.status !== "paused") {
      return false;
    }

    const updated: ExecutionTrace = {
      ...trace,
      status: "active",
    };

    this.activeTraces.set(traceId, updated);
    return true;
  }

  public stopTrace(traceId: string): ExecutionTrace | null {
    const trace = this.activeTraces.get(traceId);
    if (!trace || trace.status === "completed" || trace.status === "aborted") {
      return null;
    }

    const startTime = this.traceStartTimes.get(traceId) ?? Date.now();
    const totalDurationMs = Date.now() - startTime;

    const updated: ExecutionTrace = {
      ...trace,
      status: "completed",
      events: [...(this.activeEvents.get(traceId) ?? [])],
      endedAt: nowIso(),
      totalDurationMs,
    };

    this.activeTraces.set(traceId, updated);
    this.activeEvents.delete(traceId);
    this.traceStartTimes.delete(traceId);

    return updated;
  }

  public abortTrace(traceId: string): ExecutionTrace | null {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      return null;
    }

    const updated: ExecutionTrace = {
      ...trace,
      status: "aborted",
      events: [...(this.activeEvents.get(traceId) ?? [])],
      endedAt: nowIso(),
      totalDurationMs: null,
    };

    this.activeTraces.set(traceId, updated);
    this.activeEvents.delete(traceId);
    this.traceStartTimes.delete(traceId);

    return updated;
  }

  public getTrace(traceId: string): ExecutionTrace | null {
    const trace = this.activeTraces.get(traceId);
    if (trace) {
      return {
        ...trace,
        events: [...(this.activeEvents.get(traceId) ?? trace.events)],
      };
    }

    // Check completed/aborted traces - return with current events
    const events = this.activeEvents.get(traceId);
    if (events) {
      return {
        ...trace!,
        events: [...events],
      };
    }

    return null;
  }

  public filterEvents(traceId: string, filter: TraceFilter): readonly TraceEvent[] {
    const trace = this.activeTraces.get(traceId) ?? this.getTrace(traceId);
    if (!trace) {
      return [];
    }

    const events = this.activeEvents.get(traceId) ?? trace.events ?? [];

    return events.filter((event) => {
      const filterNodeRunId = filter.nodeRunId ?? filter.stepId;
      if (filterNodeRunId && event.nodeRunId !== filterNodeRunId && event.stepId !== filterNodeRunId) {
        return false;
      }
      if (filter.eventType && event.eventType !== filter.eventType) {
        return false;
      }
      if (filter.fromTimestamp && event.timestamp < filter.fromTimestamp) {
        return false;
      }
      if (filter.toTimestamp && event.timestamp > filter.toTimestamp) {
        return false;
      }
      return true;
    });
  }

  public getTracesByPlanGraph(planGraphId: string): readonly ExecutionTrace[] {
    return [...this.activeTraces.values()].filter((t) => t.planGraphId === planGraphId || t.workflowId === planGraphId);
  }

  public getTracesByHarnessRun(harnessRunId: string): readonly ExecutionTrace[] {
    return [...this.activeTraces.values()].filter((t) => t.harnessRunId === harnessRunId || t.executionId === harnessRunId);
  }

  /** @deprecated use getTracesByPlanGraph */
  public getTracesByWorkflow(workflowId: string): readonly ExecutionTrace[] {
    return this.getTracesByPlanGraph(workflowId);
  }

  /** @deprecated use getTracesByHarnessRun */
  public getTracesByExecution(executionId: string): readonly ExecutionTrace[] {
    return this.getTracesByHarnessRun(executionId);
  }

  public getActiveTraceCount(): number {
    return [...this.activeTraces.values()].filter((t) => t.status === "active").length;
  }

  public reset(): void {
    this.activeTraces.clear();
    this.activeEvents.clear();
    this.traceStartTimes.clear();
  }
}
