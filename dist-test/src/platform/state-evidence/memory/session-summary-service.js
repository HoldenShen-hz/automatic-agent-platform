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
/**
 * Session Summary Service
 *
 * Creates and retrieves session summaries for context preservation
 * across sessions.
 */
export class SessionSummaryService {
    store;
    constructor(store) {
        this.store = store;
    }
    /**
     * Creates a new session summary record
     */
    createSummary(input) {
        const record = {
            id: newId("summ"),
            sessionId: input.sessionId,
            taskId: input.taskId ?? null,
            agentId: input.agentId ?? null,
            summaryText: input.summaryText,
            keyDecisions: input.keyDecisions ? JSON.stringify(input.keyDecisions) : null,
            keyOutcomes: input.keyOutcomes ? JSON.stringify(input.keyOutcomes) : null,
            memoryIdsReferenced: input.memoryIdsReferenced ? JSON.stringify(input.memoryIdsReferenced) : null,
            tokenCount: estimateTextTokens(input.summaryText),
            createdAt: nowIso(),
        };
        this.store.session.insertSessionSummary(record);
        return record;
    }
    /**
     * Gets the latest session summary for a session
     */
    getLatestSummary(sessionId) {
        return this.store.session.getLatestSessionSummary(sessionId);
    }
}
//# sourceMappingURL=session-summary-service.js.map