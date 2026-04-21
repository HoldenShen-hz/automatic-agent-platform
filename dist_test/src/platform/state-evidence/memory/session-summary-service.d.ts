/**
 * Session Summary Service
 *
 * Provides session summary management:
 * - Creates session summaries with key decisions and outcomes
 * - Retrieves the latest summary for a session
 * - Persists summaries to storage
 */
import type { AuthoritativeTaskStore } from "../truth/authoritative-task-store.js";
import type { SessionSummaryRecord } from "../../contracts/types/domain.js";
/**
 * Input for creating a session summary
 */
export interface SessionSummaryInput {
    sessionId: string;
    taskId?: string | null;
    agentId?: string | null;
    summaryText: string;
    keyDecisions?: string[];
    keyOutcomes?: string[];
    memoryIdsReferenced?: string[];
}
/**
 * Session Summary Service
 *
 * Creates and retrieves session summaries for context preservation
 * across sessions.
 */
export declare class SessionSummaryService {
    private readonly store;
    constructor(store: AuthoritativeTaskStore);
    /**
     * Creates a new session summary record
     */
    createSummary(input: SessionSummaryInput): SessionSummaryRecord;
    /**
     * Gets the latest session summary for a session
     */
    getLatestSummary(sessionId: string): SessionSummaryRecord | null;
}
