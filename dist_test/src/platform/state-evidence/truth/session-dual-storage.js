/**
 * @fileoverview Session Dual Storage Service
 *
 * Implements dual storage for sessions:
 * - SQLite: Authoritative index for fast queries
 * - JSONL: Append-only replay layer for complete audit trail
 *
 * @see DB-45: Session dual storage
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { nowIso } from "../../contracts/types/ids.js";
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
    jsonlRootDir;
    constructor(options) {
        this.jsonlRootDir = options.jsonlRootDir;
        this.ensureDirectoryExists(this.jsonlRootDir);
    }
    /**
     * Ensures the specified directory exists, creating it if necessary.
     * @param dir - The directory path to check/create
     */
    ensureDirectoryExists(dir) {
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
    getSessionJsonlPath(sessionId) {
        const safeSessionId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
        return join(this.jsonlRootDir, `session-${safeSessionId}.jsonl`);
    }
    /**
     * Gets the task index file path for tracking session history by task.
     * Sanitizes the task ID for safe file system use.
     * @param taskId - The task ID
     * @returns The path to the task's session index file
     */
    getTaskIndexPath(taskId) {
        const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, "_");
        return join(this.jsonlRootDir, `task-${safeTaskId}-sessions.jsonl`);
    }
    /**
     * Appends a session event to both the session file and task index.
     * Events are appended in append-only fashion for audit trail integrity.
     * @param event - The session event to record
     */
    appendSessionEvent(event) {
        const sessionPath = this.getSessionJsonlPath(event.sessionId);
        const taskIndexPath = this.getTaskIndexPath(event.taskId);
        const line = JSON.stringify(event) + "\n";
        appendFileSync(sessionPath, line, "utf8");
        appendFileSync(taskIndexPath, line, "utf8");
    }
    /**
     * Records a session creation event.
     * @param session - The session record to record
     */
    recordSessionCreated(session) {
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
    recordSessionUpdated(session) {
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
    recordSessionCompleted(sessionId, taskId) {
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
    recordSessionFailed(sessionId, taskId, errorCode) {
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
    recordSessionCancelled(sessionId, taskId) {
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
    recordMessageAdded(message, taskId) {
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
    recordCompaction(sessionId, taskId, compactionSummary) {
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
    replaySessionEvents(sessionId) {
        const sessionPath = this.getSessionJsonlPath(sessionId);
        if (!existsSync(sessionPath)) {
            return [];
        }
        const content = readFileSync(sessionPath, "utf8");
        const lines = content.split("\n").filter((line) => line.trim().length > 0);
        return lines.map((line) => JSON.parse(line));
    }
    /**
     * Replays all session events for a specific task.
     * Useful for understanding all session activity related to a task.
     * @param taskId - The task ID to replay sessions for
     * @returns Array of session events in chronological order
     */
    replayTaskSessionHistory(taskId) {
        const taskIndexPath = this.getTaskIndexPath(taskId);
        if (!existsSync(taskIndexPath)) {
            return [];
        }
        const content = readFileSync(taskIndexPath, "utf8");
        const lines = content.split("\n").filter((line) => line.trim().length > 0);
        return lines.map((line) => JSON.parse(line));
    }
    /**
     * Gets a summary of the replay data for a session.
     * @param sessionId - The session ID to summarize
     * @returns Summary including event count, time range, and event types
     */
    getSessionReplaySummary(sessionId) {
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
    verifyDualStorageConsistency(session, latestStatus) {
        const issues = [];
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
            .find((e) => e.eventType === "session_updated" ||
            e.eventType === "session_completed" ||
            e.eventType === "session_failed" ||
            e.eventType === "session_cancelled");
        if (latestStatusEvent != null && latestStatusEvent.eventType === "session_updated") {
            const payloadStatus = latestStatusEvent.payload.status;
            if (payloadStatus !== undefined && payloadStatus !== latestStatus) {
                issues.push(`Status mismatch: JSONL=${payloadStatus}, SQLite=${latestStatus}`);
            }
        }
        return {
            consistent: issues.length === 0,
            issues,
        };
    }
}
//# sourceMappingURL=session-dual-storage.js.map