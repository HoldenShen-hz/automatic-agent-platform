/**
 * Structured Logger
 *
 * ## Overview
 *
 * Provides in-memory structured logging with support for filtering by task,
 * trace, and other correlation IDs. Maintains a rolling buffer for diagnostics.
 *
 * ## Key Concepts
 *
 * - **Structured Log**: Structured, queryable logs with contextual fields
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: structured log}
 *
 * - **Trace**: Global execution tracking across modules
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: trace}
 *
 * - **Span**: Single operation segment within a trace
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: span}
 *
 * - **Correlation ID**: Unified identifier for cross-module log/event/request correlation
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: correlation id}
 *
 * @see Observability Contract: docs_zh/contracts/debug_inspect_health_backpressure_contract.md
 * @see Glossary: docs_zh/governance/glossary_and_terminology.md
 */

import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";

import type { LogTransport } from "./log-transport.js";
import { getActiveTelemetryContext } from "./otel-tracer.js";

/**
 * Structured log entry with level, message, optional correlation IDs
 * (taskId, agentId, sessionId, stepId, traceId), optional data payload,
 * and ISO timestamp.
 */
export interface StructuredLogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  taskId?: string;
  agentId?: string;
  sessionId?: string;
  stepId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  correlationId?: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

export interface StructuredLoggerBufferSummary {
  entryCount: number;
  retentionLimit: number;
  droppedEntryCount: number;
}

interface StructuredLoggerFileSink {
  filePath: string;
  maxBytes: number | null;
  maxFiles: number;
}

export interface StructuredLoggerFileSinkOptions {
  filePath: string;
  maxBytes?: number | null;
  maxFiles?: number;
}

/**
 * StructuredLogger maintains an in-memory ring buffer of structured log entries
 * with support for filtering by task, trace, or retrieving the most recent entries.
 * Uses a proper ring buffer for O(1) insertion.
 * Used for diagnostics and debugging observability scenarios.
 */
export class StructuredLogger {
  private static globalFileSink: StructuredLoggerFileSink | null = null;
  private static transports: LogTransport[] = [];

  private readonly buffer: (StructuredLogEntry | undefined)[];
  private readonly retentionLimit: number;
  private head: number = 0;
  private count: number = 0;
  private droppedEntryCount: number = 0;

  public static configureGlobalFileSink(filePathOrOptions: string | StructuredLoggerFileSinkOptions | null): void {
    if (filePathOrOptions == null) {
      StructuredLogger.globalFileSink = null;
      return;
    }

    const options = typeof filePathOrOptions === "string"
      ? { filePath: filePathOrOptions }
      : filePathOrOptions;
    if (options.filePath.trim().length === 0) {
      StructuredLogger.globalFileSink = null;
      return;
    }

    const maxBytes = options.maxBytes == null
      ? null
      : Math.max(1, Math.trunc(options.maxBytes));
    const maxFiles = Math.max(1, Math.trunc(options.maxFiles ?? 5));
    mkdirSync(dirname(options.filePath), { recursive: true });
    StructuredLogger.globalFileSink = {
      filePath: options.filePath,
      maxBytes,
      maxFiles,
    };
  }

  public static getGlobalFileSinkPath(): string | null {
    return StructuredLogger.globalFileSink?.filePath ?? null;
  }

  /**
   * Adds a log transport to receive structured log entries.
   * @param transport - The transport to add
   */
  public static addTransport(transport: LogTransport): void {
    StructuredLogger.transports.push(transport);
  }

  /**
   * Removes a log transport by name.
   * @param name - The name of the transport to remove
   * @returns True if the transport was found and removed
   */
  public static removeTransport(name: string): boolean {
    const index = StructuredLogger.transports.findIndex((t) => t.name === name);
    if (index === -1) {
      return false;
    }
    StructuredLogger.transports.splice(index, 1);
    return true;
  }

  /**
   * Flushes all transports that support flushing.
   */
  public static async flushTransports(): Promise<void> {
    await Promise.all(
      StructuredLogger.transports
        .filter((t) => t.flush)
        .map((t) => t.flush!())
    );
  }

  /**
   * Closes all transports and removes them.
   */
  public static async closeTransports(): Promise<void> {
    await Promise.all(
      StructuredLogger.transports
        .filter((t) => t.close)
        .map((t) => t.close!())
    );
    StructuredLogger.transports = [];
  }

  public constructor(options: { retentionLimit?: number } = {}) {
    this.retentionLimit = Math.max(1, Math.trunc(options.retentionLimit ?? 500));
    // Pre-allocate buffer for O(1) insertion
    this.buffer = new Array(this.retentionLimit);
  }

  /**
   * Logs a structured entry with the current timestamp automatically added.
   * O(1) insertion using ring buffer.
   * @param entry - Log entry without timestamp (timestamp is auto-generated)
   * @returns The complete log entry with createdAt timestamp
   */
  public log(entry: Omit<StructuredLogEntry, "createdAt">): StructuredLogEntry {
    const activeTelemetryContext = getActiveTelemetryContext();
    const traceId = entry.traceId ?? activeTelemetryContext?.traceId;
    const spanId = entry.spanId ?? activeTelemetryContext?.spanId;
    // Note: ActiveTelemetryContext.parentSpanId is string | null, but StructuredLogEntry.parentSpanId is string | undefined
    const parentSpanId = (entry.parentSpanId ?? activeTelemetryContext?.parentSpanId) ?? undefined;
    const correlationId = entry.correlationId ?? entry.traceId ?? activeTelemetryContext?.traceId;

    const record: StructuredLogEntry = {
      ...entry,
      ...(traceId !== undefined ? { traceId } : {}),
      ...(spanId !== undefined ? { spanId } : {}),
      ...(parentSpanId !== undefined ? { parentSpanId } : {}),
      ...(correlationId !== undefined && correlationId !== null ? { correlationId } : {}),
      createdAt: new Date().toISOString(),
    };

    // If buffer is full, track overflow
    if (this.count === this.retentionLimit) {
      this.droppedEntryCount++;
    }

    // O(1) ring buffer insertion
    this.buffer[this.head] = record;
    this.head = (this.head + 1) % this.retentionLimit;
    if (this.count < this.retentionLimit) {
      this.count++;
    }

    this.writeToGlobalFileSink(record);
    this.writeToTransports(record);

    return record;
  }

  public debug(message: string, data?: Record<string, unknown>): StructuredLogEntry {
    return this.log({ level: "debug", message, ...(data ? { data } : {}) });
  }

  public info(message: string, data?: Record<string, unknown>): StructuredLogEntry {
    return this.log({ level: "info", message, ...(data ? { data } : {}) });
  }

  public warn(message: string, data?: Record<string, unknown>): StructuredLogEntry {
    return this.log({ level: "warn", message, ...(data ? { data } : {}) });
  }

  public error(message: string, data?: Record<string, unknown>): StructuredLogEntry {
    return this.log({ level: "error", message, ...(data ? { data } : {}) });
  }

  /**
   * Returns the most recent log entries up to the specified limit.
   * @param limit - Maximum number of entries to return (default: 50)
   * @returns Array of recent log entries
   */
  public recent(limit = 50): StructuredLogEntry[] {
    const result: StructuredLogEntry[] = [];
    const actualLimit = Math.min(limit, this.count);

    if (actualLimit === 0) return result;

    // Start from the oldest entry and go forward
    const start = (this.head - this.count + this.retentionLimit) % this.retentionLimit;
    for (let i = 0; i < actualLimit; i++) {
      const index = (start + i) % this.retentionLimit;
      const entry = this.buffer[index];
      if (entry !== undefined) {
        result.push(entry);
      }
    }

    return result;
  }

  /**
   * Returns the most recent log entries for a specific task.
   * @param taskId - The task ID to filter by
   * @param limit - Maximum number of entries to return (default: 50)
   * @returns Array of recent log entries for the task
   */
  public recentByTask(taskId: string, limit = 50): StructuredLogEntry[] {
    return this.recent(this.count).filter((entry) => entry.taskId === taskId).slice(-limit);
  }

  /**
   * Returns the most recent log entries for a specific trace.
   * @param traceId - The trace ID to filter by
   * @param limit - Maximum number of entries to return (default: 50)
   * @returns Array of recent log entries for the trace
   */
  public recentByTrace(traceId: string, limit = 50): StructuredLogEntry[] {
    return this.recent(this.count).filter((entry) => entry.traceId === traceId).slice(-limit);
  }

  /**
   * Returns the most recent log entries for a specific correlation context.
   * @param correlationId - The correlation ID to filter by
   * @param limit - Maximum number of entries to return (default: 50)
   * @returns Array of recent log entries for the correlation
   */
  public recentByCorrelation(correlationId: string, limit = 50): StructuredLogEntry[] {
    return this.recent(this.count).filter((entry) => entry.correlationId === correlationId).slice(-limit);
  }

  public getBufferSummary(): StructuredLoggerBufferSummary {
    return {
      entryCount: this.count,
      retentionLimit: this.retentionLimit,
      droppedEntryCount: this.droppedEntryCount,
    };
  }

  private writeToGlobalFileSink(entry: StructuredLogEntry): void {
    const sink = StructuredLogger.globalFileSink;
    if (sink == null) {
      return;
    }
    try {
      const serialized = `${JSON.stringify(entry)}\n`;
      this.rotateFileSinkIfNeeded(sink, Buffer.byteLength(serialized, "utf8"));
      appendFileSync(sink.filePath, serialized, "utf8");
    } catch {
      // File sink failures must not take down the caller path.
    }
  }

  private writeToTransports(entry: StructuredLogEntry): void {
    for (const transport of StructuredLogger.transports) {
      try {
        const result = transport.write(entry);
        if (result instanceof Promise) {
          void result.catch(() => {
            // Transport failures must not take down the caller path.
          });
        }
      } catch {
        // Transport write must not take down the caller path.
      }
    }
  }

  private rotateFileSinkIfNeeded(sink: StructuredLoggerFileSink, incomingBytes: number): void {
    if (sink.maxBytes == null) {
      return;
    }

    let currentBytes = 0;
    if (existsSync(sink.filePath)) {
      currentBytes = statSync(sink.filePath).size;
    }
    if (currentBytes + incomingBytes <= sink.maxBytes) {
      return;
    }

    const archiveCount = Math.max(0, sink.maxFiles - 1);
    if (archiveCount === 0) {
      if (existsSync(sink.filePath)) {
        unlinkSync(sink.filePath);
      }
      return;
    }

    const oldestArchivePath = `${sink.filePath}.${archiveCount}`;
    if (existsSync(oldestArchivePath)) {
      unlinkSync(oldestArchivePath);
    }

    for (let index = archiveCount - 1; index >= 1; index -= 1) {
      const fromPath = `${sink.filePath}.${index}`;
      const toPath = `${sink.filePath}.${index + 1}`;
      if (existsSync(fromPath)) {
        renameSync(fromPath, toPath);
      }
    }

    if (existsSync(sink.filePath)) {
      renameSync(sink.filePath, `${sink.filePath}.1`);
    }
  }
}
