/**
 * @fileoverview Session Dual Storage Service
 *
 * Implements dual storage for sessions:
 * - SQLite: Authoritative index for fast queries
 * - JSONL: Append-only replay layer for complete audit trail
 *
 * @see DB-45: Session dual storage
 */

import {
  appendFileSync,
  closeSync,
  existsSync,
  fdatasyncSync,
  fstatSync,
  ftruncateSync,
  mkdirSync,
  openSync,
  readFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import type { MessageRecord, SessionRecord } from "../../contracts/types/domain.js";
import { nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 200 });

/**
 * Types of session lifecycle events that can be recorded.
 */
export type SessionEventType =
  | "session_created"
  | "session_updated"
  | "session_completed"
  | "session_failed"
  | "session_cancelled"
  | "message_added"
  | "message_updated"
  | "compaction_recorded";

/**
 * A single event recorded in the JSONL audit trail.
 */
export interface SessionEvent {
  eventType: SessionEventType;
  sessionId: string;
  taskId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface SessionPluginReferenceIssue {
  readonly eventType: SessionEventType;
  readonly pluginId: string;
  readonly reason: "plugin_not_registered" | "plugin_unhealthy";
}

export interface SessionPluginValidationResult {
  readonly valid: boolean;
  readonly referencesChecked: number;
  readonly issues: readonly SessionPluginReferenceIssue[];
}

/**
 * Configuration options for SessionDualStorageService.
 */
export interface SessionDualStorageOptions {
  /** Root directory for JSONL files */
  jsonlRootDir: string;
}

/**
 * SessionDualStorageService provides dual storage for sessions.
 *
 * Maintains two storage layers:
 * - SQLite: Authoritative index for fast queries
 * - JSONL: Append-only replay layer for complete audit trail
 *
 * This enables both fast querying and complete historical replay.
 */
export class SessionDualStorageService {
  private readonly jsonlRootDir: string;

  constructor(options: SessionDualStorageOptions) {
    this.jsonlRootDir = options.jsonlRootDir;
    this.ensureDirectoryExists(this.jsonlRootDir);
  }

  /**
   * Ensures the specified directory exists, creating it if necessary.
   * @param dir - The directory path to check/create
   */
  private ensureDirectoryExists(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Gets the JSONL file path for a specific session.
   * Sanitizes the session ID for safe file system use.
   * @param sessionId - The session ID
   * @returns The path to the session's JSONL file
   */
  private getSessionJsonlPath(sessionId: string): string {
    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.jsonlRootDir, `session-${safeSessionId}.jsonl`);
  }

  /**
   * Gets the task index file path for tracking session history by task.
   * Sanitizes the task ID for safe file system use.
   * @param taskId - The task ID
   * @returns The path to the task's session index file
   */
  private getTaskIndexPath(taskId: string): string {
    const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.jsonlRootDir, `task-${safeTaskId}-sessions.jsonl`);
  }

  /**
   * Appends a session event to both the session file and task index.
   * Events are appended in append-only fashion for audit trail integrity.
   * @param event - The session event to record
   */
  public appendSessionEvent(event: SessionEvent): void {
    const sessionPath = this.getSessionJsonlPath(event.sessionId);
    const taskIndexPath = this.getTaskIndexPath(event.taskId);

    const line = JSON.stringify(event) + "\n";

    const sessionFd = openSync(sessionPath, "a");
    const sessionSizeBeforeWrite = fstatSync(sessionFd).size;
    try {
      appendFileSync(sessionFd, line, "utf8");
      fdatasyncSync(sessionFd);
      let taskIndexFd: number | null = null;
      try {
        taskIndexFd = openSync(taskIndexPath, "a");
        appendFileSync(taskIndexFd, line, "utf8");
        fdatasyncSync(taskIndexFd);
      } catch (err) {
        try {
          ftruncateSync(sessionFd, sessionSizeBeforeWrite);
          fdatasyncSync(sessionFd);
        } catch (rollbackError) {
          logger.error("session_dual_storage.session_rollback_failed", {
            sessionId: event.sessionId,
            taskId: event.taskId,
            eventType: event.eventType,
            error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
            sessionPath,
            taskIndexPath,
          });
        }
        logger.error(taskIndexFd == null
          ? "session_dual_storage.task_index_open_failed"
          : "session_dual_storage.task_index_write_failed", {
          sessionId: event.sessionId,
          taskId: event.taskId,
          eventType: event.eventType,
          error: err instanceof Error ? err.message : String(err),
          sessionPath,
          taskIndexPath,
        });
        throw err;
      } finally {
        if (taskIndexFd != null) {
          closeSync(taskIndexFd);
        }
      }
    } finally {
      closeSync(sessionFd);
    }
  }

  /**
   * Records a session creation event.
   * @param session - The session record to record
   */
  public recordSessionCreated(session: SessionRecord): void {
    this.appendSessionEvent({
      eventType: "session_created",
      sessionId: session.id,
      taskId: session.taskId,
      timestamp: nowIso(),
      payload: {
        id: session.id,
        taskId: session.taskId,
        channel: session.channel,
        status: session.status,
        externalSessionId: session.externalSessionId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  }

  /**
   * Records a session update event.
   * @param session - The session record containing updated data
   */
  public recordSessionUpdated(session: SessionRecord): void {
    this.appendSessionEvent({
      eventType: "session_updated",
      sessionId: session.id,
      taskId: session.taskId,
      timestamp: nowIso(),
      payload: {
        id: session.id,
        status: session.status,
        updatedAt: session.updatedAt,
      },
    });
  }

  /**
   * Records a session completion event.
   * @param sessionId - The session ID
   * @param taskId - The task ID
   */
  public recordSessionCompleted(sessionId: string, taskId: string): void {
    this.appendSessionEvent({
      eventType: "session_completed",
      sessionId,
      taskId,
      timestamp: nowIso(),
      payload: {},
    });
  }

  /**
   * Records a session failure event.
   * @param sessionId - The session ID
   * @param taskId - The task ID
   * @param errorCode - Optional error code describing the failure
   */
  public recordSessionFailed(sessionId: string, taskId: string, errorCode?: string): void {
    this.appendSessionEvent({
      eventType: "session_failed",
      sessionId,
      taskId,
      timestamp: nowIso(),
      payload: errorCode != null ? { errorCode } : {},
    });
  }

  /**
   * Records a session cancellation event.
   * @param sessionId - The session ID
   * @param taskId - The task ID
   */
  public recordSessionCancelled(sessionId: string, taskId: string): void {
    this.appendSessionEvent({
      eventType: "session_cancelled",
      sessionId,
      taskId,
      timestamp: nowIso(),
      payload: {},
    });
  }

  /**
   * Records a message addition event.
   * @param message - The message record to record
   * @param taskId - The task ID this session belongs to
   */
  public recordMessageAdded(message: MessageRecord, taskId: string): void {
    this.appendSessionEvent({
      eventType: "message_added",
      sessionId: message.sessionId,
      taskId,
      timestamp: nowIso(),
      payload: {
        id: message.id,
        sessionId: message.sessionId,
        direction: message.direction,
        messageType: message.messageType,
        content: message.content,
        partsJson: message.partsJson,
        attachmentsJson: message.attachmentsJson,
        createdAt: message.createdAt,
      },
    });
  }

  /**
   * Records a session compaction event.
   * @param sessionId - The session ID
   * @param taskId - The task ID
   * @param compactionSummary - Summary of the compaction operation
   */
  public recordCompaction(sessionId: string, taskId: string, compactionSummary: Record<string, unknown>): void {
    this.appendSessionEvent({
      eventType: "compaction_recorded",
      sessionId,
      taskId,
      timestamp: nowIso(),
      payload: compactionSummary,
    });
  }

  /**
   * Replays all events for a specific session from the JSONL audit trail.
   * @param sessionId - The session ID to replay
   * @returns Array of session events in chronological order
   */
  public replaySessionEvents(sessionId: string): SessionEvent[] {
    const sessionPath = this.getSessionJsonlPath(sessionId);

    if (!existsSync(sessionPath)) {
      return [];
    }

    const content = readFileSync(sessionPath, "utf8");
    const lines = content.split("\n").filter((line) => line.trim().length > 0);

    return this.parseReplayLines(lines, { source: "session", id: sessionId });
  }

  /**
   * Replays all session events for a specific task.
   * Useful for understanding all session activity related to a task.
   * @param taskId - The task ID to replay sessions for
   * @returns Array of session events in chronological order
   */
  public replayTaskSessionHistory(taskId: string): SessionEvent[] {
    const taskIndexPath = this.getTaskIndexPath(taskId);

    if (!existsSync(taskIndexPath)) {
      return [];
    }

    const content = readFileSync(taskIndexPath, "utf8");
    const lines = content.split("\n").filter((line) => line.trim().length > 0);

    return this.parseReplayLines(lines, { source: "task", id: taskId });
  }

  private parseReplayLines(lines: readonly string[], context: { source: "session" | "task"; id: string }): SessionEvent[] {
    const events: SessionEvent[] = [];
    for (const [index, line] of lines.entries()) {
      try {
        events.push(JSON.parse(line) as SessionEvent);
      } catch (error) {
        logger.warn("session_dual_storage.replay_corrupt_line_skipped", {
          source: context.source,
          id: context.id,
          lineNumber: index + 1,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return events;
  }

  /**
   * Gets a summary of the replay data for a session.
   * @param sessionId - The session ID to summarize
   * @returns Summary including event count, time range, and event types
   */
  public getSessionReplaySummary(sessionId: string): {
    eventCount: number;
    firstEvent: string | null;
    lastEvent: string | null;
    eventTypes: string[];
  } {
    const events = this.replaySessionEvents(sessionId);

    if (events.length === 0) {
      return {
        eventCount: 0,
        firstEvent: null,
        lastEvent: null,
        eventTypes: [],
      };
    }

    const eventTypes = [...new Set(events.map((e) => e.eventType))];

    return {
      eventCount: events.length,
      firstEvent: events[0]?.timestamp ?? null,
      lastEvent: events[events.length - 1]?.timestamp ?? null,
      eventTypes,
    };
  }

  /**
   * Verifies consistency between SQLite and JSONL storage for a session.
   * Detects missing events or status mismatches.
   * @param session - The session record from SQLite
   * @param latestStatus - The expected latest status
   * @returns Consistency check result with any issues found
   */
  public verifyDualStorageConsistency(
    session: SessionRecord,
    latestStatus: SessionRecord["status"],
  ): {
    consistent: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const events = this.replaySessionEvents(session.id);

    if (events.length === 0) {
      issues.push("No events found in JSONL for session");
    }

    const createdEvent = events.find((e) => e.eventType === "session_created");
    if (createdEvent == null) {
      issues.push("Missing session_created event");
    }

    // Find the latest status-affecting event
    const latestStatusEvent = events
      .slice()
      .reverse()
      .find((e) =>
        e.eventType === "session_updated" ||
        e.eventType === "session_completed" ||
        e.eventType === "session_failed" ||
        e.eventType === "session_cancelled",
      );

    const expectedStatus = mapSessionStatusEventToStatus(latestStatusEvent);
    if (expectedStatus != null && expectedStatus !== latestStatus) {
      issues.push(`Status mismatch: JSONL=${expectedStatus}, SQLite=${latestStatus}`);
    }

    return {
      consistent: issues.length === 0,
      issues,
    };
  }

  public validateSessionPluginReferences(
    events: readonly SessionEvent[],
    options: {
      readonly installedPluginIds: ReadonlySet<string> | readonly string[];
      readonly healthyPluginIds: ReadonlySet<string> | readonly string[];
    },
  ): SessionPluginValidationResult {
    const installedPluginIds = options.installedPluginIds instanceof Set
      ? options.installedPluginIds
      : new Set(options.installedPluginIds);
    const healthyPluginIds = options.healthyPluginIds instanceof Set
      ? options.healthyPluginIds
      : new Set(options.healthyPluginIds);
    const issues: SessionPluginReferenceIssue[] = [];
    let referencesChecked = 0;

    for (const event of events) {
      for (const pluginId of collectPluginIds(event.payload)) {
        referencesChecked += 1;
        if (!installedPluginIds.has(pluginId)) {
          issues.push({ eventType: event.eventType, pluginId, reason: "plugin_not_registered" });
          continue;
        }
        if (!healthyPluginIds.has(pluginId)) {
          issues.push({ eventType: event.eventType, pluginId, reason: "plugin_unhealthy" });
        }
      }
    }

    return {
      valid: issues.length === 0,
      referencesChecked,
      issues,
    };
  }
}

function collectPluginIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectPluginIds(item));
  }
  if (value == null || typeof value !== "object") {
    return [];
  }
  const record = value as Record<string, unknown>;
  const result: string[] = [];
  for (const [key, nestedValue] of Object.entries(record)) {
    if (key === "pluginId" && typeof nestedValue === "string" && nestedValue.trim().length > 0) {
      result.push(nestedValue.trim());
      continue;
    }
    result.push(...collectPluginIds(nestedValue));
  }
  return result;
}

function mapSessionStatusEventToStatus(event: SessionEvent | undefined): SessionRecord["status"] | null {
  if (event == null) {
    return null;
  }
  switch (event.eventType) {
    case "session_updated":
      return typeof event.payload.status === "string" ? event.payload.status as SessionRecord["status"] : null;
    case "session_completed":
      return "completed";
    case "session_failed":
      return "failed";
    case "session_cancelled":
      return "cancelled";
    default:
      return null;
  }
}
