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
import { promises as fsPromises } from "node:fs";
import { basename, dirname, isAbsolute, join, normalize, resolve, sep } from "node:path";

import type { LogTransport } from "./log-transport.js";
import { getActiveTelemetryContext } from "./otel-tracer.js";

export type StructuredPlane = "P1" | "P2" | "P3" | "P4" | "P5" | "X1";
export type StructuredLogLevel = "debug" | "info" | "warn" | "error" | "fatal";
export type CrosscuttingFabricCategory = "reliability" | "security" | "governance";

/**
 * Structured log entry with level, message, optional correlation IDs
 * (taskId, agentId, sessionId, stepId, traceId), optional data payload,
 * and ISO timestamp.
 */
export interface StructuredLogEntry {
  level: StructuredLogLevel;
  message: string;
  service: string;
  plane?: StructuredPlane;
  crosscuttingFabric?: CrosscuttingFabricCategory;
  taskId?: string;
  agentId?: string;
  sessionId?: string;
  stepId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  correlationId?: string;
  data?: Record<string, unknown> | null;
  structuredPayload?: Record<string, unknown>;
  createdAt: string;
  timestamp: string;
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

export interface StructuredLoggerOptions {
  retentionLimit?: number;
  plane?: StructuredPlane;
  planeSourceFile?: string;
  service?: string;
}

type StructuredLogInput = Omit<StructuredLogEntry, "createdAt" | "timestamp" | "service" | "structuredPayload"> & {
  service?: string;
  timestamp?: string;
  structuredPayload?: Record<string, unknown>;
  crosscuttingFabric?: CrosscuttingFabricCategory;
};

/**
 * Validates and sanitizes a file path to prevent path traversal attacks.
 * Ensures the path is within an allowed directory and doesn't escape via ".."
 *
 * @param userPath - The path provided by the user or external input
 * @param baseDir - The base directory that the path must be within
 * @returns The sanitized absolute path
 * @throws Error if the path is absolute, contains traversal sequences, or escapes baseDir
 */
function safePath(userPath: string, baseDir: string): string {
  // Block absolute paths - they cannot be within a relative base directory
  if (isAbsolute(userPath)) {
    throw new Error("path_traversal.blocked_absolute_path");
  }

  // Normalize the path to resolve any ".." or "." sequences
  const normalized = normalize(userPath);

  // Block any path that still contains traversal markers after normalization
  if (normalized.includes("..")) {
    throw new Error("path_traversal.blocked_traversal_sequence");
  }

  // Reject paths that normalize to escape the base directory
  const fullPath = join(baseDir, normalized);
  const resolvedFullPath = resolve(fullPath);
  const resolvedBaseDir = resolve(baseDir);

  // Ensure the resolved path is still within the base directory
  if (!resolvedFullPath.startsWith(resolvedBaseDir + sep)) {
    throw new Error("path_traversal.blocked_escape_from_base");
  }

  return resolvedFullPath;
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
  private readonly plane: StructuredPlane;
  private readonly service: string;
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

    // Use process.cwd() as the base directory for path validation
    // This ensures the log file path cannot escape to arbitrary locations
    const baseDir = process.cwd();
    let safeFilePath: string;
    try {
      safeFilePath = safePath(options.filePath, baseDir);
    } catch {
      // Invalid path - silently disable sink to avoid crashing the logging path
      StructuredLogger.globalFileSink = null;
      return;
    }

    const maxBytes = options.maxBytes == null
      ? null
      : Math.max(1, Math.trunc(options.maxBytes));
    const maxFiles = Math.max(1, Math.trunc(options.maxFiles ?? 5));
    mkdirSync(dirname(safeFilePath), { recursive: true });
    StructuredLogger.globalFileSink = {
      filePath: safeFilePath,
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

  public constructor(options: StructuredLoggerOptions = {}) {
    this.retentionLimit = Math.max(0, Math.trunc(options.retentionLimit ?? 500));
    this.plane = options.plane ?? inferStructuredPlane(options.planeSourceFile);
    this.service = normalizeStructuredService(options.service ?? options.planeSourceFile);
    // Pre-allocate buffer for O(1) insertion
    this.buffer = new Array(this.retentionLimit);
  }

  /**
   * Logs a structured entry with the current timestamp automatically added.
   * O(1) insertion using ring buffer.
   * @param entry - Log entry without timestamp (timestamp is auto-generated)
   * @returns The complete log entry with createdAt timestamp
   */
  public log(entry: StructuredLogInput): StructuredLogEntry {
    const activeTelemetryContext = getActiveTelemetryContext();
    const rawData = entry.data ?? entry.structuredPayload;
    const taskId = entry.taskId ?? readStringField(rawData, "taskId");
    const agentId = entry.agentId ?? readStringField(rawData, "agentId");
    const sessionId = entry.sessionId ?? readStringField(rawData, "sessionId");
    const stepId = entry.stepId ?? readStringField(rawData, "stepId");
    const traceId = entry.traceId ?? readStringField(rawData, "traceId") ?? activeTelemetryContext?.traceId;
    const spanId = entry.spanId ?? activeTelemetryContext?.spanId;
    // Note: ActiveTelemetryContext.parentSpanId is string | null, but StructuredLogEntry.parentSpanId is string | undefined
    const parentSpanId = (entry.parentSpanId ?? activeTelemetryContext?.parentSpanId) ?? undefined;
    const correlationId =
      entry.correlationId ??
      readStringField(rawData, "correlationId") ??
      traceId ??
      activeTelemetryContext?.traceId;

    const timestamp = entry.timestamp ?? new Date().toISOString();
    const data = rawData;

    const record: StructuredLogEntry = {
      ...entry,
      service: entry.service ?? this.service,
      plane: entry.plane ?? this.plane,
      ...(taskId !== undefined ? { taskId } : {}),
      ...(agentId !== undefined ? { agentId } : {}),
      ...(sessionId !== undefined ? { sessionId } : {}),
      ...(stepId !== undefined ? { stepId } : {}),
      ...(traceId !== undefined ? { traceId } : {}),
      ...(spanId !== undefined ? { spanId } : {}),
      ...(parentSpanId !== undefined ? { parentSpanId } : {}),
      ...(correlationId !== undefined && correlationId !== null ? { correlationId } : {}),
      ...(data !== undefined ? { data, structuredPayload: data } : {}),
      createdAt: timestamp,
      timestamp,
    };

    if (this.retentionLimit > 0) {
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

  public fatal(message: string, data?: Record<string, unknown>): StructuredLogEntry {
    return this.log({ level: "fatal", message, ...(data ? { data } : {}) });
  }

  /**
   * Backward-compatible alias used by older tests and callers.
   */
  public getEntries(): StructuredLogEntry[] {
    return this.recent(this.count);
  }

  /**
   * Clears the in-memory ring buffer without touching external sinks.
   */
  public clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this.count = 0;
    this.droppedEntryCount = 0;
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

    // Start from the earliest entry inside the requested trailing window.
    const start = (this.head - actualLimit + this.retentionLimit) % this.retentionLimit;
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
      // Schedule rotation check asynchronously to avoid blocking event loop
      // The rotation itself will be async if needed
      this.scheduleRotationIfNeeded(sink, Buffer.byteLength(serialized, "utf8"));
      // Use async appendFile to avoid blocking the event loop
      fsPromises.appendFile(sink.filePath, serialized, "utf8").catch(() => {
        // File sink failures must not take down the caller path.
      });
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

  private rotationScheduled = false;

  private scheduleRotationIfNeeded(sink: StructuredLoggerFileSink, incomingBytes: number): void {
    if (this.rotationScheduled || sink.maxBytes == null) {
      return;
    }

    // Quick sync check if rotation is even needed
    let currentBytes = 0;
    try {
      if (existsSync(sink.filePath)) {
        currentBytes = statSync(sink.filePath).size;
      }
    } catch {
      return;
    }

    if (currentBytes + incomingBytes <= sink.maxBytes) {
      return;
    }

    // Schedule async rotation
    this.rotationScheduled = true;
    setImmediate(() => this.performRotation(sink));
  }

  private async performRotation(sink: StructuredLoggerFileSink): Promise<void> {
    try {
      const archiveCount = Math.max(0, sink.maxFiles - 1);
      if (archiveCount === 0) {
        try {
          await fsPromises.unlink(sink.filePath);
        } catch {
          // File may not exist
        }
        this.rotationScheduled = false;
        return;
      }

      const oldestArchivePath = `${sink.filePath}.${archiveCount}`;
      try {
        await fsPromises.unlink(oldestArchivePath);
      } catch {
        // File may not exist
      }

      for (let index = archiveCount - 1; index >= 1; index -= 1) {
        const fromPath = `${sink.filePath}.${index}`;
        const toPath = `${sink.filePath}.${index + 1}`;
        try {
          await fsPromises.rename(fromPath, toPath);
        } catch {
          // File may not exist
        }
      }

      try {
        await fsPromises.rename(sink.filePath, `${sink.filePath}.1`);
      } catch {
        // File may not exist
      }
    } catch {
      // Rotation errors should not affect logging
    } finally {
      this.rotationScheduled = false;
    }
  }
}

function normalizeStructuredService(value: string | undefined): string {
  if (value == null) {
    return "unknown_service";
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "unknown_service";
  }
  const candidate = trimmed.includes("/") || trimmed.includes("\\")
    ? basename(trimmed).replace(/\.[cm]?[jt]sx?$/i, "")
    : trimmed;
  return candidate.length > 0 ? candidate : "unknown_service";
}

function readStringField(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function inferStructuredPlane(explicitSourceFile?: string): StructuredPlane {
  const sourcePath = explicitSourceFile ?? inferCallerSourcePath();
  return mapPathToStructuredPlane(sourcePath);
}

function inferCallerSourcePath(): string {
  const stack = new Error().stack?.split("\n") ?? [];
  for (const line of stack) {
    if (line.includes("structured-logger")) {
      continue;
    }
    const match = line.match(/(?:file:\/\/)?(\/[^:\)\s]+(?:src|dist)\/[^:\)\s]+)/);
    if (match?.[1] != null) {
      return match[1];
    }
  }
  return "";
}

function mapPathToStructuredPlane(sourcePath: string): StructuredPlane {
  if (sourcePath.includes("/platform/interface/")) return "P1";
  if (sourcePath.includes("/platform/control-plane/")) return "P2";
  if (sourcePath.includes("/platform/orchestration/")) return "P3";
  if (sourcePath.includes("/platform/execution/")) return "P4";
  if (sourcePath.includes("/platform/state-evidence/")) return "P5";
  return "X1";
}
