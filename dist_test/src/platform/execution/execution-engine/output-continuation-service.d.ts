/**
 * @fileoverview Output Continuation Service
 *
 * Handles cases where LLM output is truncated due to max_output_tokens limit.
 * Provides continuation capability to resume truncated responses.
 *
 * @see AGENT-24: 补齐超长输出 continuation 恢复
 */
export type ContinuationReason = "max_tokens_exceeded" | "content_filtered" | "stop_sequence" | "normal" | "unknown";
export interface ContinuationStatus {
    canContinue: boolean;
    reason: ContinuationReason;
    partialOutput: string | null;
    continuationTokenBudget: number | null;
    nextInputContent: string | null;
}
export interface ContinuationRecord {
    id: string;
    taskId: string;
    sessionId: string;
    executionId: string;
    originalResponseId: string;
    partialOutput: string;
    finishReason: ContinuationReason;
    continuationPoint: string | null;
    continuationCount: number;
    lastContinuationAt: string | null;
    createdAt: string;
}
export interface ContinueRequest {
    taskId: string;
    sessionId: string;
    executionId: string;
    originalResponseId: string;
    partialOutput: string;
    finishReason: string;
    maxContinuationTokens?: number;
}
export declare function parseFinishReason(reason: string): ContinuationReason;
export declare function canContinueResponse(finishReason: string): boolean;
export declare function buildContinuationPrompt(partialOutput: string, originalPrompt: string, maxContinuationTokens?: number): string;
export declare function extractContinuationPoint(partialOutput: string): string | null;
export declare class OutputContinuationService {
    private records;
    private readonly MAX_RECORDS;
    private readonly RECORD_TTL_MS;
    private lastEvictionTime;
    private readonly EVICTION_INTERVAL_MS;
    /**
     * C-09: Evict expired and excess records to prevent memory leaks.
     */
    private evictExpired;
    createContinuationRecord(request: ContinueRequest): ContinuationRecord;
    getRecord(id: string): ContinuationRecord | undefined;
    getRecordsByExecution(executionId: string): ContinuationRecord[];
    getRecordsBySession(sessionId: string): ContinuationRecord[];
    getRecordsByTask(taskId: string): ContinuationRecord[];
    incrementContinuationCount(recordId: string): void;
    checkContinuationStatus(finishReason: string, partialOutput: string): ContinuationStatus;
    clearRecords(): void;
    getRecordCount(): number;
}
export declare function getGlobalContinuationService(): OutputContinuationService;
