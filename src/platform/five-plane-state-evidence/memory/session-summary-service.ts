/**
 * Session Summary Service
 *
 * Provides session summary management:
 * - Creates session summaries with key decisions and outcomes
 * - Retrieves the latest summary for a session
 * - Persists summaries to storage
 */

import { newId, nowIso } from "../../contracts/types/ids.js";
import { estimateTextTokens } from "../../model-gateway/messages/token-estimator.js";
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
  createdAt?: string;
}

/**
 * Session Summary Service
 *
 * Creates and retrieves session summaries for context preservation
 * across sessions.
 */
export class SessionSummaryService {
  public constructor(private readonly store: AuthoritativeTaskStore) {}

  /**
   * Creates a new session summary record
   */
  public createSummary(input: SessionSummaryInput): SessionSummaryRecord {
    const record: SessionSummaryRecord = {
      id: newId("summ"),
      sessionId: input.sessionId,
      taskId: input.taskId ?? null,
      agentId: input.agentId ?? null,
      summaryText: input.summaryText,
      keyDecisions: input.keyDecisions ? JSON.stringify(input.keyDecisions) : null,
      keyOutcomes: input.keyOutcomes ? JSON.stringify(input.keyOutcomes) : null,
      memoryIdsReferenced: input.memoryIdsReferenced ? JSON.stringify(input.memoryIdsReferenced) : null,
      tokenCount: estimateTextTokens(input.summaryText),
      createdAt: input.createdAt ?? nowIso(),
    };

    this.store.session.insertSessionSummary(record);
    return record;
  }

  /**
   * Gets the latest session summary for a session
   */
  public getLatestSummary(sessionId: string): SessionSummaryRecord | null {
    return this.store.session.getLatestSessionSummary(sessionId);
  }
}
