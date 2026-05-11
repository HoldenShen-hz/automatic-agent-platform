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
  readonly stepId: string;
  readonly eventType: "enter" | "exit" | "error" | "variable_change" | "checkpoint";
  readonly timestamp: string;
  readonly durationMs: number | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ExecutionTrace {
  readonly traceId: string;
  readonly workflowId: string;
  readonly executionId: string;
  readonly status: TraceStatus;
  readonly events: readonly TraceEvent[];
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly totalDurationMs: number | null;
}

export interface TraceFilter {
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

  public startTrace(workflowId: string, executionId: string): ExecutionTrace {
    const traceId = newId("trace");
    const startedAt = nowIso();
    this.traceStartTimes.set(traceId, Date.now());

    const trace: ExecutionTrace = {
      traceId,
      workflowId,
      executionId,
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
    stepId: string,
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
      stepId,
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

    this.activeTraces.delete(traceId);
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

    this.activeTraces.delete(traceId);
    this.activeEvents.delete(traceId);
    this.traceStartTimes.delete(traceId);

    return updated;
  }

  public getTrace(traceId: string): ExecutionTrace | null {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      return null;
    }

    const events = [...(this.activeEvents.get(traceId) ?? [])];

    // Calculate totalDurationMs dynamically for active trace
    // Use explicit null check to avoid NaN from invalid date strings (e.g., "" or malformed)
    const totalDurationMs = trace.endedAt !== null
      ? new Date(trace.endedAt).getTime() - new Date(trace.startedAt).getTime()
      : null;

    return {
      ...trace,
      events,
      totalDurationMs,
    };
  }

  public filterEvents(traceId: string, filter: TraceFilter): readonly TraceEvent[] {
    const trace = this.activeTraces.get(traceId) ?? this.getTrace(traceId);
    if (!trace) {
      return [];
    }

    const events = this.activeEvents.get(traceId) ?? trace.events ?? [];

    return events.filter((event) => {
      if (filter.stepId && event.stepId !== filter.stepId) {
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

  public getTracesByWorkflow(workflowId: string): readonly ExecutionTrace[] {
    return Array.from(this.activeTraces.values()).filter((t) => t.workflowId === workflowId);
  }

  public getTracesByExecution(executionId: string): readonly ExecutionTrace[] {
    return Array.from(this.activeTraces.values()).filter((t) => t.executionId === executionId);
  }

  public getActiveTraceCount(): number {
    return Array.from(this.activeTraces.values()).filter((t) => t.status === "active").length;
  }

  public reset(): void {
    this.activeTraces.clear();
    this.activeEvents.clear();
    this.traceStartTimes.clear();
  }
}
