/**
 * @fileoverview Output Continuation Service
 *
 * Handles cases where LLM output is truncated due to max_output_tokens limit.
 * Provides continuation capability to resume truncated responses.
 *
 * @see AGENT-24: 补齐超长输出 continuation 恢复
 */

import { newId, nowIso } from "../../contracts/types/ids.js";

export type ContinuationReason =
  | "max_tokens_exceeded"
  | "content_filtered"
  | "stop_sequence"
  | "normal"
  | "unknown";

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

export function parseFinishReason(reason: string): ContinuationReason {
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

export function canContinueResponse(finishReason: string): boolean {
  const reason = parseFinishReason(finishReason);
  return reason === "max_tokens_exceeded";
}

function stripContinuationMarker(value: string): string {
  let stripped = value;
  while (true) {
    const next = stripped
    .replace(/\s*\[truncated\]\s*$/i, "")
    .replace(/\s*\[continued\]\s*$/i, "")
    .replace(/\s*【未完】\s*$/u, "")
    .replace(/\s*\[未完成\]\s*$/u, "")
      .replace(/\.{3,}\s*$/u, "");
    if (next === stripped) {
      return value === stripped ? value : stripped.trimEnd();
    }
    stripped = next;
  }
}

export function buildContinuationPrompt(
  partialOutput: string,
  originalPrompt: string,
  maxContinuationTokens: number = 2000,
): string {
  return `Original prompt:\n${originalPrompt}\n\n[Previous output was truncated. Continue from where it left off. Remaining budget: ${maxContinuationTokens} tokens.]\n\nPartial output so far:\n${partialOutput}\n\nPlease continue the response:`;
}

export function extractContinuationPoint(partialOutput: string): string | null {
  if (!partialOutput || partialOutput.trim().length === 0) {
    return null;
  }

  const lines = partialOutput.split("\n");

  const incompletePatterns = [
    /\{\s*$/,
    /\[\s*$/,
    /\(\s*$/,
    /<[^>\n]*$/,
    /:\s*$/,
    /,\s*$/,
    /=\s*$/,
    /=>\s*$/,
  ];

  if (lines.length <= 2) {
    const markerStripped = stripContinuationMarker(partialOutput);
    if (markerStripped !== partialOutput) {
      return markerStripped;
    }
    if (lines.length === 2) {
      const firstLineStripped = stripContinuationMarker(lines[0] ?? "");
      if (firstLineStripped !== lines[0]) {
        return firstLineStripped;
      }
      return partialOutput;
    }
    for (const pattern of incompletePatterns) {
      if (pattern.test(partialOutput)) {
        return partialOutput;
      }
    }
    return partialOutput;
  }

  const lastLine = lines[lines.length - 1];
  const previousLine = lines[lines.length - 2];
  if (lastLine && stripContinuationMarker(lastLine) !== lastLine) {
    return lines.slice(0, -1).join("\n").trim();
  }
  if (previousLine && stripContinuationMarker(previousLine) !== previousLine) {
    return lines.slice(0, -1).join("\n").trim();
  }

  if (partialOutput.endsWith(",") || partialOutput.endsWith("，")) {
    return partialOutput;
  }

  const lastPunctuation = partialOutput.match(/[.!?。！？；;]\s*$/);
  if (lastPunctuation) {
    return partialOutput;
  }

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
  private records: Map<string, ContinuationRecord> = new Map();
  // C-09: TTL-based eviction to prevent memory leaks
  private readonly MAX_RECORDS = 1000;
  private readonly RECORD_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private lastEvictionTime = 0;
  private readonly EVICTION_INTERVAL_MS = 60 * 60 * 1000; // Once per hour

  /**
   * C-09: Evict expired and excess records to prevent memory leaks.
   */
  private evictExpired(): void {
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
        this.records.delete(sortedEntries[i]![0]);
      }
    }
  }

  public createContinuationRecord(request: ContinueRequest): ContinuationRecord {
    // C-09: Evict expired records before creating new one
    this.evictExpired();

    const reason = parseFinishReason(request.finishReason);
    const continuationPoint = extractContinuationPoint(request.partialOutput);

    const record: ContinuationRecord = {
      id: `continuation:${newId("continuation")}`,
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

  public getRecord(id: string): ContinuationRecord | undefined {
    return this.records.get(id);
  }

  public getRecordsByExecution(executionId: string): ContinuationRecord[] {
    return [...this.records.values()].filter((r) => r.executionId === executionId);
  }

  public getRecordsBySession(sessionId: string): ContinuationRecord[] {
    return [...this.records.values()].filter((r) => r.sessionId === sessionId);
  }

  public getRecordsByTask(taskId: string): ContinuationRecord[] {
    return [...this.records.values()].filter((r) => r.taskId === taskId);
  }

  public incrementContinuationCount(recordId: string): void {
    const record = this.records.get(recordId);
    if (record) {
      record.continuationCount += 1;
      record.lastContinuationAt = nowIso();
    }
  }

  public checkContinuationStatus(
    finishReason: string,
    partialOutput: string,
  ): ContinuationStatus {
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

  public clearRecords(): void {
    this.records.clear();
  }

  public getRecordCount(): number {
    return this.records.size;
  }
}

let globalContinuationService: OutputContinuationService | null = null;

export function getGlobalContinuationService(): OutputContinuationService {
  if (!globalContinuationService) {
    globalContinuationService = new OutputContinuationService();
  }
  return globalContinuationService;
}
