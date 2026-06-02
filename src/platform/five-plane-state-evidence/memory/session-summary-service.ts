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
import { ValidationError } from "../../contracts/errors.js";

const MAX_SESSION_SUMMARY_LIST_ITEMS = 50;
const MAX_SESSION_SUMMARY_JSON_BYTES = 8 * 1024;

function normalizeSummaryList(fieldName: string, values: readonly string[] | undefined): string[] | null {
  if (values == null) {
    return null;
  }
  if (values.length > MAX_SESSION_SUMMARY_LIST_ITEMS) {
    throw new ValidationError(
      "session_summary.list_limit_exceeded",
      `session_summary.list_limit_exceeded:${fieldName}`,
      {
        retryable: false,
        details: {
          fieldName,
          itemCount: values.length,
          maxItems: MAX_SESSION_SUMMARY_LIST_ITEMS,
        },
      },
    );
  }
  const normalized = values.map((value) => value.trim()).filter((value) => value.length > 0);
  const json = JSON.stringify(normalized);
  if (Buffer.byteLength(json, "utf8") > MAX_SESSION_SUMMARY_JSON_BYTES) {
    throw new ValidationError(
      "session_summary.json_payload_too_large",
      `session_summary.json_payload_too_large:${fieldName}`,
      {
        retryable: false,
        details: {
          fieldName,
          sizeBytes: Buffer.byteLength(json, "utf8"),
          maxBytes: MAX_SESSION_SUMMARY_JSON_BYTES,
        },
      },
    );
  }
  return normalized;
}

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
    const keyDecisions = normalizeSummaryList("keyDecisions", input.keyDecisions);
    const keyOutcomes = normalizeSummaryList("keyOutcomes", input.keyOutcomes);
    const memoryIdsReferenced = normalizeSummaryList("memoryIdsReferenced", input.memoryIdsReferenced);
    const record: SessionSummaryRecord = {
      id: newId("summ"),
      sessionId: input.sessionId,
      taskId: input.taskId ?? null,
      agentId: input.agentId ?? null,
      summaryText: input.summaryText,
      keyDecisions: keyDecisions ? JSON.stringify(keyDecisions) : null,
      keyOutcomes: keyOutcomes ? JSON.stringify(keyOutcomes) : null,
      memoryIdsReferenced: memoryIdsReferenced ? JSON.stringify(memoryIdsReferenced) : null,
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
