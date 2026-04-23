/**
 * @fileoverview Session Dual Storage Service
 *
 * Implements dual storage for sessions:
 * - SQLite: Authoritative index for fast queries
 * - JSONL: Append-only replay layer for complete audit trail
 *
 * @see DB-45: Session dual storage
 */
import type { MessageRecord, SessionRecord } from "../../contracts/types/domain.js";
/**
 * Types of session lifecycle events that can be recorded.
 */
export type SessionEventType = "session_created" | "session_updated" | "session_completed" | "session_failed" | "session_cancelled" | "message_added" | "message_updated" | "compaction_recorded";
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
export declare class SessionDualStorageService {
    private readonly jsonlRootDir;
    constructor(options: SessionDualStorageOptions);
    /**
     * Ensures the specified directory exists, creating it if necessary.
     * @param dir - The directory path to check/create
     */
    private ensureDirectoryExists;
    /**
     * Gets the JSONL file path for a specific session.
     * Sanitizes the session ID for safe file system use.
     * @param sessionId - The session ID
     * @returns The path to the session's JSONL file
     */
    private getSessionJsonlPath;
    /**
     * Gets the task index file path for tracking session history by task.
     * Sanitizes the task ID for safe file system use.
     * @param taskId - The task ID
     * @returns The path to the task's session index file
     */
    private getTaskIndexPath;
    /**
     * Appends a session event to both the session file and task index.
     * Events are appended in append-only fashion for audit trail integrity.
     * @param event - The session event to record
     */
    appendSessionEvent(event: SessionEvent): void;
    /**
     * Records a session creation event.
     * @param session - The session record to record
     */
    recordSessionCreated(session: SessionRecord): void;
    /**
     * Records a session update event.
     * @param session - The session record containing updated data
     */
    recordSessionUpdated(session: SessionRecord): void;
    /**
     * Records a session completion event.
     * @param sessionId - The session ID
     * @param taskId - The task ID
     */
    recordSessionCompleted(sessionId: string, taskId: string): void;
    /**
     * Records a session failure event.
     * @param sessionId - The session ID
     * @param taskId - The task ID
     * @param errorCode - Optional error code describing the failure
     */
    recordSessionFailed(sessionId: string, taskId: string, errorCode?: string): void;
    /**
     * Records a session cancellation event.
     * @param sessionId - The session ID
     * @param taskId - The task ID
     */
    recordSessionCancelled(sessionId: string, taskId: string): void;
    /**
     * Records a message addition event.
     * @param message - The message record to record
     * @param taskId - The task ID this session belongs to
     */
    recordMessageAdded(message: MessageRecord, taskId: string): void;
    /**
     * Records a session compaction event.
     * @param sessionId - The session ID
     * @param taskId - The task ID
     * @param compactionSummary - Summary of the compaction operation
     */
    recordCompaction(sessionId: string, taskId: string, compactionSummary: Record<string, unknown>): void;
    /**
     * Replays all events for a specific session from the JSONL audit trail.
     * @param sessionId - The session ID to replay
     * @returns Array of session events in chronological order
     */
    replaySessionEvents(sessionId: string): SessionEvent[];
    /**
     * Replays all session events for a specific task.
     * Useful for understanding all session activity related to a task.
     * @param taskId - The task ID to replay sessions for
     * @returns Array of session events in chronological order
     */
    replayTaskSessionHistory(taskId: string): SessionEvent[];
    /**
     * Gets a summary of the replay data for a session.
     * @param sessionId - The session ID to summarize
     * @returns Summary including event count, time range, and event types
     */
    getSessionReplaySummary(sessionId: string): {
        eventCount: number;
        firstEvent: string | null;
        lastEvent: string | null;
        eventTypes: string[];
    };
    /**
     * Verifies consistency between SQLite and JSONL storage for a session.
     * Detects missing events or status mismatches.
     * @param session - The session record from SQLite
     * @param latestStatus - The expected latest status
     * @returns Consistency check result with any issues found
     */
    verifyDualStorageConsistency(session: SessionRecord, latestStatus: SessionRecord["status"]): {
        consistent: boolean;
        issues: string[];
    };
}
