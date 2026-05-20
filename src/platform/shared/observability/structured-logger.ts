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

import { createHash } from "node:crypto";
import { appendFileSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, renameSync, statSync, unlinkSync } from "node:fs";
import { promises as fsPromises } from "node:fs";
import { basename, dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";

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
  tenantId?: string;
  harnessRunId?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  correlationId?: string;
  causationId?: string;
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
  durability: "buffered" | "fsync";
}

export interface StructuredLoggerFileSinkOptions {
  filePath: string;
  maxBytes?: number | null;
  maxFiles?: number;
  durability?: "buffered" | "fsync";
}

export interface StructuredLoggerOptions {
  retentionLimit?: number;
  plane?: StructuredPlane;
  planeSourceFile?: string;
  service?: string;
  minLogLevel?: StructuredLogLevel;
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
  const normalized = normalize(userPath.replace(/\\/g, "/"));

  const segments = normalized.split(/[\\/]+/).filter((segment) => segment.length > 0);
  if (segments.includes("..")) {
    throw new Error("path_traversal.blocked_traversal_sequence");
  }

  // Reject paths that normalize to escape the base directory
  const fullPath = join(baseDir, normalized);
  const resolvedFullPath = resolve(fullPath);
  const resolvedBaseDir = resolve(baseDir);

  // Ensure the resolved path is still within the base directory
  const relativePath = relative(resolvedBaseDir, resolvedFullPath);
  if (relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))) {
    return resolvedFullPath;
  }
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
  private static rotationStateByPath = new Map<string, { scheduled: boolean; pendingBytes: number }>();
  private static sinkBaseDir = process.cwd();

  private readonly buffer: (StructuredLogEntry | undefined)[];
  private readonly retentionLimit: number;
  private readonly plane: StructuredPlane;
  private readonly service: string;
  private readonly minLogLevel: StructuredLogLevel;
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
    const baseDir = StructuredLogger.sinkBaseDir;
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
      durability: options.durability ?? "fsync",
    };
  }

  public static getGlobalFileSinkPath(): string | null {
    return StructuredLogger.globalFileSink?.filePath ?? null;
  }

  public static setGlobalFileSinkBaseDir(baseDir: string): void {
    StructuredLogger.sinkBaseDir = resolve(baseDir);
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
    this.minLogLevel = options.minLogLevel ?? "debug";
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
    const tenantId = entry.tenantId ?? readStringField(rawData, "tenantId");
    const harnessRunId = entry.harnessRunId ?? readStringField(rawData, "harnessRunId");
    const requestId = entry.requestId ?? readStringField(rawData, "requestId");
    const traceId = entry.traceId ?? readStringField(rawData, "traceId") ?? activeTelemetryContext?.traceId;
    const spanId = entry.spanId ?? activeTelemetryContext?.spanId;
    // Note: ActiveTelemetryContext.parentSpanId is string | null, but StructuredLogEntry.parentSpanId is string | undefined
    const parentSpanId = (entry.parentSpanId ?? activeTelemetryContext?.parentSpanId) ?? undefined;
    const correlationId =
      entry.correlationId ??
      readStringField(rawData, "correlationId") ??
      traceId ??
      activeTelemetryContext?.traceId;
    const causationId = entry.causationId ?? readStringField(rawData, "causationId");
    const crosscuttingFabricCandidate = entry.crosscuttingFabric ?? readStringField(rawData, "crosscuttingFabric");
    const crosscuttingFabric = crosscuttingFabricCandidate === "reliability"
      || crosscuttingFabricCandidate === "security"
      || crosscuttingFabricCandidate === "governance"
      ? crosscuttingFabricCandidate
      : undefined;

    const timestamp = entry.timestamp ?? new Date().toISOString();
    const data = sanitizeLogData(rawData);
    const message = sanitizeLogText(entry.message);

    const record: StructuredLogEntry = {
      ...entry,
      message,
      service: entry.service ?? this.service,
      plane: entry.plane ?? this.plane,
      ...(crosscuttingFabric !== undefined ? { crosscuttingFabric } : {}),
      ...(taskId !== undefined ? { taskId } : {}),
      ...(agentId !== undefined ? { agentId } : {}),
      ...(sessionId !== undefined ? { sessionId } : {}),
      ...(stepId !== undefined ? { stepId } : {}),
      ...(tenantId !== undefined ? { tenantId } : {}),
      ...(harnessRunId !== undefined ? { harnessRunId } : {}),
      ...(requestId !== undefined ? { requestId } : {}),
      ...(traceId !== undefined ? { traceId } : {}),
      ...(spanId !== undefined ? { spanId } : {}),
      ...(parentSpanId !== undefined ? { parentSpanId } : {}),
      ...(correlationId !== undefined && correlationId !== null ? { correlationId } : {}),
      ...(causationId !== undefined && causationId !== null ? { causationId } : {}),
      ...(data !== undefined ? { data, structuredPayload: data } : {}),
      createdAt: timestamp,
      timestamp,
    };

    if (compareLogLevels(record.level, this.minLogLevel) < 0) {
      return record;
    }

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
      const serialized = `${JSON.stringify(redactEntryForFileSink(entry))}\n`;
      const serializedBytes = Buffer.byteLength(serialized, "utf8");
      const state = this.getOrCreateRotationState(sink.filePath);
      state.pendingBytes += serializedBytes;
      // Track inflight writes so concurrent async appends do not all race against
      // the same stale file size.
      this.scheduleRotationIfNeeded(sink);
      if (sink.durability === "fsync") {
        this.appendFileWithFsync(sink.filePath, serialized);
        const latestState = StructuredLogger.rotationStateByPath.get(sink.filePath);
        if (latestState != null) {
          latestState.pendingBytes = Math.max(0, latestState.pendingBytes - serializedBytes);
        }
      } else {
        fsPromises.appendFile(sink.filePath, serialized, "utf8")
          .catch((error) => {
            process.stderr.write(`structured_logger.file_sink_error:${error instanceof Error ? error.message : String(error)}\n`);
          })
          .finally(() => {
            const latestState = StructuredLogger.rotationStateByPath.get(sink.filePath);
            if (latestState != null) {
              latestState.pendingBytes = Math.max(0, latestState.pendingBytes - serializedBytes);
            }
          });
      }
    } catch {
      // File sink failures must not take down the caller path.
    }
  }

  private appendFileWithFsync(filePath: string, serialized: string): void {
    const fd = openSync(filePath, "a");
    try {
      appendFileSync(fd, serialized, "utf8");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
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

  private getOrCreateRotationState(filePath: string): { scheduled: boolean; pendingBytes: number } {
    const existing = StructuredLogger.rotationStateByPath.get(filePath);
    if (existing != null) {
      return existing;
    }
    const created = { scheduled: false, pendingBytes: 0 };
    StructuredLogger.rotationStateByPath.set(filePath, created);
    return created;
  }

  private scheduleRotationIfNeeded(sink: StructuredLoggerFileSink): void {
    const state = this.getOrCreateRotationState(sink.filePath);
    if (state.scheduled || sink.maxBytes == null) {
      return;
    }

    // Check asynchronously if rotation is needed to avoid blocking the event loop
    // and prevent race condition between statSync (sync) and appendFile (async)
    state.scheduled = true;
    this.checkRotationAsync(sink).catch(() => {
      // Rotation check errors should not affect logging
      state.scheduled = false;
    });
  }

  private async checkRotationAsync(sink: StructuredLoggerFileSink): Promise<void> {
    const state = StructuredLogger.rotationStateByPath.get(sink.filePath);
    if (!state || sink.maxBytes == null) {
      return;
    }

    let currentBytes = 0;
    try {
      currentBytes = (await fsPromises.stat(sink.filePath)).size;
    } catch {
      state.scheduled = false;
      return;
    }

    if (currentBytes + state.pendingBytes <= sink.maxBytes) {
      state.scheduled = false;
      return;
    }

    // Schedule async rotation
    setImmediate(() => void this.performRotation(sink));
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
        const state = StructuredLogger.rotationStateByPath.get(sink.filePath);
        if (state != null) {
          state.scheduled = false;
          if (sink.maxBytes != null && state.pendingBytes >= sink.maxBytes) {
            this.scheduleRotationIfNeeded(sink);
          }
        }
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
          await renameWithCrossDeviceFallback(fromPath, toPath);
        } catch {
          // File may not exist
        }
      }

      try {
        await renameWithCrossDeviceFallback(sink.filePath, `${sink.filePath}.1`);
      } catch {
        // File may not exist
      }
    } catch {
      // Rotation errors should not affect logging
    } finally {
      const state = StructuredLogger.rotationStateByPath.get(sink.filePath);
      if (state != null) {
        state.scheduled = false;
        if (sink.maxBytes != null && state.pendingBytes >= sink.maxBytes) {
          this.scheduleRotationIfNeeded(sink);
        }
      }
    }
  }
}

const LOG_LEVEL_ORDER: Record<StructuredLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

function compareLogLevels(left: StructuredLogLevel, right: StructuredLogLevel): number {
  return LOG_LEVEL_ORDER[left] - LOG_LEVEL_ORDER[right];
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

const SENSITIVE_LOG_VALUE_PATTERN = /\b(?:Bearer\s+[A-Za-z0-9._~+/=-]+|(?:sk|pk|rk|pat|ghp|gho|github_pat)_[A-Za-z0-9_=-]{8,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]{8,})?)\b/g;
const REDACTED_LOG_VALUE = "[REDACTED]";

const SENSITIVE_KEY_TOKENS = new Set([
  "authorization",
  "token",
  "tokens",
  "secret",
  "password",
  "cookie",
  "cookies",
  "email",
  "emails",
  "credential",
  "credentials",
  "bearer",
  "jwt",
  "signature",
  "mfa",
  "otp",
  "phone",
  "mobile",
  "ssn",
  "passport",
  "address",
  "dob",
]);

const SENSITIVE_KEY_TOKEN_PAIRS = new Set([
  "api:key",
  "set:cookie",
  "private:key",
  "refresh:token",
  "id:card",
  "tax:id",
  "full:name",
]);

function tokenizeStructuredLogKey(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);
}

function isSensitiveLogKey(key: string): boolean {
  const tokens = tokenizeStructuredLogKey(key);
  if (tokens.some((token) => SENSITIVE_KEY_TOKENS.has(token))) {
    return true;
  }
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (SENSITIVE_KEY_TOKEN_PAIRS.has(`${tokens[index]}:${tokens[index + 1]}`)) {
      return true;
    }
  }
  return false;
}

function sanitizeLogText(value: string): string {
  return value.replace(SENSITIVE_LOG_VALUE_PATTERN, REDACTED_LOG_VALUE);
}

function sanitizeLogData(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): Record<string, unknown> | undefined {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return value === undefined ? undefined : { value: sanitizeLogValue(value, depth, seen) };
  }
  return sanitizeLogObject(value as Record<string, unknown>, depth, seen);
}

function sanitizeLogObject(record: Record<string, unknown>, depth: number, seen: WeakSet<object>): Record<string, unknown> {
  if (depth > 6) {
    return { truncated: true };
  }
  if (seen.has(record)) {
    return { circular: true };
  }
  seen.add(record);
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (isSensitiveLogKey(key)) {
      sanitized[key] = REDACTED_LOG_VALUE;
      continue;
    }
    sanitized[key] = sanitizeLogValue(value, depth + 1, seen);
  }
  seen.delete(record);
  return sanitized;
}

function sanitizeLogValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return sanitizeLogText(value);
  }
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return { circular: true };
    }
    seen.add(value);
    const sanitized = value.map((item) => sanitizeLogValue(item, depth + 1, seen));
    seen.delete(value);
    return sanitized;
  }
  if (typeof value === "object") {
    if (value instanceof Error) {
      return sanitizeLogObject({
        name: value.name,
        message: sanitizeLogText(value.message),
        stack: value.stack != null ? sanitizeLogText(value.stack) : undefined,
        cause: value.cause,
      }, depth + 1, seen);
    }
    return sanitizeLogObject(value as Record<string, unknown>, depth + 1, seen);
  }
  return String(value);
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
    const match = line.match(/(?:file:\/\/)?((?:[A-Za-z]:[\\/]|\/)[^:\)\s]+(?:src|dist)[\\/][^:\)\s]+)/);
    if (match?.[1] != null) {
      return match[1].replace(/\\/g, "/");
    }
  }
  return "";
}

function mapPathToStructuredPlane(sourcePath: string): StructuredPlane {
  if (sourcePath.includes("/platform/five-plane-interface/")) return "P1";
  if (sourcePath.includes("/platform/five-plane-control-plane/")) return "P2";
  if (sourcePath.includes("/platform/five-plane-orchestration/")) return "P3";
  if (sourcePath.includes("/platform/five-plane-execution/")) return "P4";
  if (sourcePath.includes("/platform/five-plane-state-evidence/")) return "P5";
  return "X1";
}

function redactEntryForFileSink(entry: StructuredLogEntry): StructuredLogEntry {
  const redacted: StructuredLogEntry = { ...entry };
  applyHashedIdentifier(redacted, "taskId", entry.taskId);
  applyHashedIdentifier(redacted, "agentId", entry.agentId);
  applyHashedIdentifier(redacted, "sessionId", entry.sessionId);
  applyHashedIdentifier(redacted, "tenantId", entry.tenantId);
  applyHashedIdentifier(redacted, "harnessRunId", entry.harnessRunId);
  applyHashedIdentifier(redacted, "requestId", entry.requestId);
  applyHashedIdentifier(redacted, "traceId", entry.traceId);
  applyHashedIdentifier(redacted, "spanId", entry.spanId);
  applyHashedIdentifier(redacted, "parentSpanId", entry.parentSpanId);
  applyHashedIdentifier(redacted, "correlationId", entry.correlationId);
  applyHashedIdentifier(redacted, "causationId", entry.causationId);
  return redacted;
}

function hashIdentifier(value: string | undefined): string | undefined {
  if (value == null || value.length === 0) {
    return value;
  }
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function applyHashedIdentifier(
  entry: StructuredLogEntry,
  key: keyof Pick<
    StructuredLogEntry,
    | "taskId"
    | "agentId"
    | "sessionId"
    | "tenantId"
    | "harnessRunId"
    | "requestId"
    | "traceId"
    | "spanId"
    | "parentSpanId"
    | "correlationId"
    | "causationId"
  >,
  value: string | undefined,
): void {
  if (value == null) {
    delete entry[key];
    return;
  }
  const hashed = hashIdentifier(value);
  if (hashed != null) {
    entry[key] = hashed;
  }
}

async function renameWithCrossDeviceFallback(fromPath: string, toPath: string): Promise<void> {
  try {
    await fsPromises.rename(fromPath, toPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") {
      throw error;
    }
    await fsPromises.copyFile(fromPath, toPath);
    await fsPromises.unlink(fromPath);
  }
}
