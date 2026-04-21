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
import type { LogTransport } from "./log-transport.js";
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
export declare class StructuredLogger {
    private static globalFileSink;
    private static transports;
    private readonly buffer;
    private readonly retentionLimit;
    private head;
    private count;
    private droppedEntryCount;
    static configureGlobalFileSink(filePathOrOptions: string | StructuredLoggerFileSinkOptions | null): void;
    static getGlobalFileSinkPath(): string | null;
    /**
     * Adds a log transport to receive structured log entries.
     * @param transport - The transport to add
     */
    static addTransport(transport: LogTransport): void;
    /**
     * Removes a log transport by name.
     * @param name - The name of the transport to remove
     * @returns True if the transport was found and removed
     */
    static removeTransport(name: string): boolean;
    /**
     * Flushes all transports that support flushing.
     */
    static flushTransports(): Promise<void>;
    /**
     * Closes all transports and removes them.
     */
    static closeTransports(): Promise<void>;
    constructor(options?: {
        retentionLimit?: number;
    });
    /**
     * Logs a structured entry with the current timestamp automatically added.
     * O(1) insertion using ring buffer.
     * @param entry - Log entry without timestamp (timestamp is auto-generated)
     * @returns The complete log entry with createdAt timestamp
     */
    log(entry: Omit<StructuredLogEntry, "createdAt">): StructuredLogEntry;
    debug(message: string, data?: Record<string, unknown>): StructuredLogEntry;
    info(message: string, data?: Record<string, unknown>): StructuredLogEntry;
    warn(message: string, data?: Record<string, unknown>): StructuredLogEntry;
    error(message: string, data?: Record<string, unknown>): StructuredLogEntry;
    /**
     * Returns the most recent log entries up to the specified limit.
     * @param limit - Maximum number of entries to return (default: 50)
     * @returns Array of recent log entries
     */
    recent(limit?: number): StructuredLogEntry[];
    /**
     * Returns the most recent log entries for a specific task.
     * @param taskId - The task ID to filter by
     * @param limit - Maximum number of entries to return (default: 50)
     * @returns Array of recent log entries for the task
     */
    recentByTask(taskId: string, limit?: number): StructuredLogEntry[];
    /**
     * Returns the most recent log entries for a specific trace.
     * @param traceId - The trace ID to filter by
     * @param limit - Maximum number of entries to return (default: 50)
     * @returns Array of recent log entries for the trace
     */
    recentByTrace(traceId: string, limit?: number): StructuredLogEntry[];
    /**
     * Returns the most recent log entries for a specific correlation context.
     * @param correlationId - The correlation ID to filter by
     * @param limit - Maximum number of entries to return (default: 50)
     * @returns Array of recent log entries for the correlation
     */
    recentByCorrelation(correlationId: string, limit?: number): StructuredLogEntry[];
    getBufferSummary(): StructuredLoggerBufferSummary;
    private writeToGlobalFileSink;
    private writeToTransports;
    private rotateFileSinkIfNeeded;
}
