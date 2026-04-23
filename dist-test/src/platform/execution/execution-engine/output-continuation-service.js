/**
 * @fileoverview Output Continuation Service
 *
 * Handles cases where LLM output is truncated due to max_output_tokens limit.
 * Provides continuation capability to resume truncated responses.
 *
 * @see AGENT-24: 补齐超长输出 continuation 恢复
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
export function parseFinishReason(reason) {
    const lowerReason = reason.toLowerCase();
    if (lowerReason === "length" || lowerReason === "max_tokens" || lowerReason === "token_limit") {
        return "max_tokens_exceeded";
    }
    if (lowerReason === "content_filter" || lowerReason === "content_filtered") {
        return "content_filtered";
    }
    if (lowerReason === "stop" || lowerReason === "stop_sequence") {
        return "stop_sequence";
    }
    if (lowerReason === "normal" || lowerReason === "completed") {
        return "normal";
    }
    return "unknown";
}
export function canContinueResponse(finishReason) {
    const reason = parseFinishReason(finishReason);
    return reason === "max_tokens_exceeded";
}
export function buildContinuationPrompt(partialOutput, originalPrompt, maxContinuationTokens = 2000) {
    return `${originalPrompt}\n\n[Previous output was truncated. Continue from where it left off. Remaining budget: ${maxContinuationTokens} tokens.]\n\nPartial output so far:\n${partialOutput}\n\nPlease continue the response:`;
}
export function extractContinuationPoint(partialOutput) {
    if (!partialOutput || partialOutput.trim().length === 0) {
        return null;
    }
    const lines = partialOutput.split("\n");
    if (lines.length <= 2) {
        return partialOutput;
    }
    const cutoffIndicators = [
        "...",
        " [truncated]",
        "[continued]",
        "...",
        "【未完】",
        "[未完成]",
    ];
    for (const indicator of cutoffIndicators) {
        const lastLine = lines[lines.length - 1];
        if (lastLine && lastLine.includes(indicator)) {
            return lines.slice(0, -1).join("\n");
        }
    }
    if (partialOutput.endsWith(",") || partialOutput.endsWith("，")) {
        return partialOutput;
    }
    const lastPunctuation = partialOutput.match(/[.!?。！？；;]\s*$/);
    if (lastPunctuation) {
        return partialOutput;
    }
    const incompletePatterns = [
        /\{\s*$/,
        /\[\s*$/,
        /\(\s*$/,
        /<\w+\s*$/,
        /,\s*$/,
    ];
    for (const pattern of incompletePatterns) {
        if (pattern.test(partialOutput)) {
            return partialOutput;
        }
    }
    const sentenceEnd = partialOutput.search(/[.!?。！？]\s+[A-Z(「]/);
    if (sentenceEnd > partialOutput.length * 0.7) {
        return partialOutput.slice(0, sentenceEnd + 1);
    }
    return null;
}
export class OutputContinuationService {
    records = new Map();
    // C-09: TTL-based eviction to prevent memory leaks
    MAX_RECORDS = 1000;
    RECORD_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
    lastEvictionTime = 0;
    EVICTION_INTERVAL_MS = 60 * 60 * 1000; // Once per hour
    /**
     * C-09: Evict expired and excess records to prevent memory leaks.
     */
    evictExpired() {
        const now = Date.now();
        if (now - this.lastEvictionTime < this.EVICTION_INTERVAL_MS) {
            return;
        }
        this.lastEvictionTime = now;
        const expiryThreshold = now - this.RECORD_TTL_MS;
        // Evict expired records
        for (const [id, record] of this.records) {
            const createdAt = new Date(record.createdAt).getTime();
            if (createdAt < expiryThreshold) {
                this.records.delete(id);
            }
        }
        // If still over capacity, remove oldest records
        if (this.records.size > this.MAX_RECORDS) {
            const sortedEntries = [...this.records.entries()].sort((a, b) => {
                const aTime = new Date(a[1].createdAt).getTime();
                const bTime = new Date(b[1].createdAt).getTime();
                return aTime - bTime;
            });
            const toRemove = this.records.size - this.MAX_RECORDS;
            for (let i = 0; i < toRemove; i++) {
                this.records.delete(sortedEntries[i][0]);
            }
        }
    }
    createContinuationRecord(request) {
        // C-09: Evict expired records before creating new one
        this.evictExpired();
        const reason = parseFinishReason(request.finishReason);
        const continuationPoint = extractContinuationPoint(request.partialOutput);
        const record = {
            id: newId("continuation"),
            taskId: request.taskId,
            sessionId: request.sessionId,
            executionId: request.executionId,
            originalResponseId: request.originalResponseId,
            partialOutput: request.partialOutput,
            finishReason: reason,
            continuationPoint,
            continuationCount: 0,
            lastContinuationAt: null,
            createdAt: nowIso(),
        };
        this.records.set(record.id, record);
        return record;
    }
    getRecord(id) {
        return this.records.get(id);
    }
    getRecordsByExecution(executionId) {
        return [...this.records.values()].filter((r) => r.executionId === executionId);
    }
    getRecordsBySession(sessionId) {
        return [...this.records.values()].filter((r) => r.sessionId === sessionId);
    }
    getRecordsByTask(taskId) {
        return [...this.records.values()].filter((r) => r.taskId === taskId);
    }
    incrementContinuationCount(recordId) {
        const record = this.records.get(recordId);
        if (record) {
            record.continuationCount += 1;
            record.lastContinuationAt = nowIso();
        }
    }
    checkContinuationStatus(finishReason, partialOutput) {
        const reason = parseFinishReason(finishReason);
        const continuationPoint = extractContinuationPoint(partialOutput);
        const canContinue = reason === "max_tokens_exceeded" && continuationPoint !== null;
        return {
            canContinue,
            reason,
            partialOutput,
            continuationTokenBudget: canContinue ? 2000 : null,
            nextInputContent: canContinue && continuationPoint
                ? `Please continue from where you left off:\n\n${continuationPoint}`
                : null,
        };
    }
    clearRecords() {
        this.records.clear();
    }
    getRecordCount() {
        return this.records.size;
    }
}
let globalContinuationService = null;
export function getGlobalContinuationService() {
    if (!globalContinuationService) {
        globalContinuationService = new OutputContinuationService();
    }
    return globalContinuationService;
}
//# sourceMappingURL=output-continuation-service.js.map