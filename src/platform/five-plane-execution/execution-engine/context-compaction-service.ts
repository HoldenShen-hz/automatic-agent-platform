/**
 * Context Compaction Service
 *
 * Manages context window overflow by compressing conversation history when
 * token budgets are nearly exhausted. Implements a two-stage compaction strategy:
 *
 * Stage 1 (trim): Removes less critical tool results while preserving recent ones
 * and protected messages (user requests, plans, approvals, summaries).
 *
 * Stage 2 (summarize): When trim is insufficient, synthesizes a summary of
 * compacted content and replaces the original messages with a compact summary.
 *
 * Both stages are recorded as CompactionRecords for audit and replay purposes.
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/contracts/context_compaction_and_overflow_contract.md | Context Compaction and Overflow Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */

import type { CompactionRecord, MessageRecord } from "../../contracts/types/domain.js";

import { estimateMessageTokens } from "../../model-gateway/messages/token-estimator.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { renderMessagePartsForContext } from "../../model-gateway/messages/message-parts.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { KvCachePrefixConfig } from "./kv-cache-prefix-config.js";
import { createKvCachePrefixConfig, estimateTokens } from "./kv-cache-prefix-config.js";

export interface ContextCompactionOptions {
  taskId: string;
  sessionId: string;
  maxContextTokens: number;
  providerMaxOutputTokens?: number;
  reservedOutputBudgetTokens?: number;
  stage1TriggerRatio?: number;
  stage2TriggerRatio?: number;
  recentToolResultWindow?: number;
  compactionMaxFrequencyPerSession?: number;
  occurredAt?: string;
  /** KV Cache prefix configuration for three-layer prompt partitioning */
  kvCacheConfig?: Partial<KvCachePrefixConfig>;
  /** Harness run ID for compaction record (v4.3+) */
  harnessRunId?: string | null;
  /** Node run ID for compaction record (v4.3+) */
  nodeRunId?: string | null;
  /** Message range covered by compaction (start_index-end_index) */
  coveredMessageRange?: string | null;
}

export interface CompactedContextMessage {
  messageId: string;
  direction: MessageRecord["direction"];
  messageType: string;
  content: string;
  estimatedTokens: number;
  trimmed: boolean;
  protected: boolean;
}

export interface ContextCompactionResult {
  usageBeforeTokens: number;
  usageAfterStage1Tokens: number;
  usageAfterStage2Tokens: number;
  stage1Triggered: boolean;
  stage2Triggered: boolean;
  fallbackToStage1: boolean;
  contextMessages: CompactedContextMessage[];
  persistedRecords: CompactionRecord[];
  errorCode: "runtime.compaction_budget_exhausted" | null;
  /** KV cache keys preserved for this compaction session */
  kvCacheFixedPrefixCacheKey?: string | null;
  kvCacheDomainBlockCacheKey?: string | null;
}

function clampRatio(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function excerpt(content: string, maxLength: number = 80): string {
  return content.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isProtectedMessage(message: MessageRecord, latestUserMessageId: string | null): boolean {
  if (message.id === latestUserMessageId) {
    return true;
  }

  return (
    message.messageType === "user_request" ||
    message.messageType === "assistant_plan" ||
    message.messageType === "approval_decision" ||
    message.messageType === "compaction_summary"
  );
}

/**
 * Checks if a message is part of the fixed_prefix layer (system messages at the start).
 * Per ADR-003: fixed_prefix is never compacted as it's cached across agents.
 */
function isFixedPrefixMessage(message: MessageRecord, fixedPrefixEndIndex: number, messageIndex: number): boolean {
  return message.direction === "system" && messageIndex < fixedPrefixEndIndex;
}

export class ContextCompactionService {
  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
  ) {}

  public compactContext(options: ContextCompactionOptions): ContextCompactionResult {
    const occurredAt = options.occurredAt ?? nowIso();
    const stage1TriggerRatio = clampRatio(options.stage1TriggerRatio ?? 0.7, 0.7);
    const stage2TriggerRatio = clampRatio(options.stage2TriggerRatio ?? 0.85, 0.85);
    const recentToolResultWindow = Math.max(0, options.recentToolResultWindow ?? 3);
    const compactionMaxFrequencyPerSession = Math.max(1, options.compactionMaxFrequencyPerSession ?? 2);
    const reservedOutputBudgetTokens =
      options.reservedOutputBudgetTokens ?? Math.min(20_000, options.providerMaxOutputTokens ?? 2_000);
    const usableBudgetTokens = Math.max(options.maxContextTokens - reservedOutputBudgetTokens, 1);

    // G9: KV Cache fixed prefix support
    const kvConfig = createKvCachePrefixConfig(options.kvCacheConfig ?? {});
    const kvCacheEnabled = kvConfig.strategy.kvCacheEnabled;

    return this.db.transaction(() => {
      const sessionMessages = this.store.dispatch.listMessagesBySession(options.sessionId);

      // G9: Compute fixed prefix end index — all system messages at the start form the fixed_prefix
      // (which includes both fixed_prefix and domain_block layers)
      // Per ADR-003: fixed_prefix is never compacted as it's cached across agents
      let fixedPrefixEndIndex = 0;
      if (kvCacheEnabled) {
        for (let i = 0; i < sessionMessages.length; i++) {
          if (sessionMessages[i]!.direction === "system") {
            fixedPrefixEndIndex = i + 1;
          } else {
            break;
          }
        }
      }

      const compactionRecords = this.store.session.listCompactionRecordsBySession(options.sessionId);
      const latestUserMessage = [...sessionMessages].reverse().find((message) => message.direction === "inbound") ?? null;
      const usageBeforeTokens = sessionMessages.reduce(
        (sum, message) => {
          const rendered = renderMessagePartsForContext(message);
          return sum + estimateMessageTokens(message, { renderedContent: rendered.content });
        },
        0,
      );

      const toolResults = sessionMessages.filter((message) => message.messageType === "tool_result");
      const recentToolResultIds = new Set(toolResults.slice(-recentToolResultWindow).map((message) => message.id));
      const trimCandidates = sessionMessages.filter(
        (message, idx) =>
          message.messageType === "tool_result" &&
          !recentToolResultIds.has(message.id) &&
          !isProtectedMessage(message, latestUserMessage?.id ?? null) &&
          // G9: fixed_prefix messages are never compacted
          !isFixedPrefixMessage(message, fixedPrefixEndIndex, idx),
      );
      const trimCandidateIds = new Set(trimCandidates.map((message) => message.id));

      const stage1Triggered = usageBeforeTokens > usableBudgetTokens * stage1TriggerRatio && trimCandidates.length > 0;
      let stage2Triggered = false;
      let fallbackToStage1 = false;
      let errorCode: ContextCompactionResult["errorCode"] = null;
      const persistedRecords: CompactionRecord[] = [];

      // G9: Compute KV cache keys if enabled
      let kvCacheFixedPrefixCacheKey: string | null = null;
      let kvCacheDomainBlockCacheKey: string | null = null;

      const stage1Messages = sessionMessages.map((message, idx) => {
        const protectedMessage = isProtectedMessage(message, latestUserMessage?.id ?? null);
        // G9: fixed_prefix messages are always protected
        const isFixedPrefix = isFixedPrefixMessage(message, fixedPrefixEndIndex, idx);
        const projected = renderMessagePartsForContext(message, {
          trimToolResultParts: stage1Triggered && !isFixedPrefix && trimCandidateIds.has(message.id),
        });

        return {
          messageId: message.id,
          direction: message.direction,
          messageType: message.messageType,
          content: projected.content,
          estimatedTokens: estimateMessageTokens(message, {
            renderedContent: projected.content,
            trimmed: projected.trimmed,
          }),
          trimmed: projected.trimmed,
          protected: protectedMessage || isFixedPrefix,
        };
      });

      if (stage1Triggered) {
        const record: CompactionRecord = {
          id: newId("compact"),
          sessionId: options.sessionId,
          taskId: options.taskId,
          harnessRunId: options.harnessRunId ?? null,
          nodeRunId: options.nodeRunId ?? null,
          stage: "trim",
          sourceMessageIdsJson: JSON.stringify(trimCandidates.map((message) => message.id)),
          coveredMessageRange: options.coveredMessageRange ?? null,
          summaryText: null,
          summaryRef: null,
          compactionReason: "context_overflow_stage1_trim",
          overflowTriggered: 1,
          autoTriggered: 1,
          tokenReductionEstimate: Math.max(usageBeforeTokens - stage1Messages.reduce((sum, item) => sum + item.estimatedTokens, 0), 0),
          createdAt: occurredAt,
        };
        this.store.session.insertCompactionRecord(record);
        persistedRecords.push(record);
      }

      const usageAfterStage1Tokens = stage1Messages.reduce((sum, message) => sum + message.estimatedTokens, 0);

      let finalMessages = stage1Messages;
      let usageAfterStage2Tokens = usageAfterStage1Tokens;

      if (usageAfterStage1Tokens > usableBudgetTokens * stage2TriggerRatio) {
        stage2Triggered = true;

        const priorSummaries = compactionRecords.filter((record) => record.stage === "summarize").length;
        if (priorSummaries >= compactionMaxFrequencyPerSession) {
          fallbackToStage1 = true;
          errorCode = "runtime.compaction_budget_exhausted";
        } else {
          const summaryCandidates = stage1Messages.filter(
            (message) =>
              !message.protected &&
              (message.trimmed || message.messageType === "assistant_response" || message.messageType === "tool_result"),
          );

          if (summaryCandidates.length > 0) {
            const summaryText = summaryCandidates
              .slice(0, 6)
              .map((message) => `[${message.messageType}] ${excerpt(message.content)}`)
              .join(" | ");
            const summaryContent = `Compacted context summary: ${summaryText}`;
            const summaryMessage: CompactedContextMessage = {
              messageId: newId("msg"),
              direction: "system",
              messageType: "compaction_summary",
              content: summaryContent,
              estimatedTokens: estimateMessageTokens(
                { content: summaryContent, partsJson: null },
                { renderedContent: summaryContent },
              ),
              trimmed: false,
              protected: true,
            };

            const preserved = stage1Messages.filter((message) => {
              if (message.protected) {
                return true;
              }
              return !summaryCandidates.some((candidate) => candidate.messageId === message.messageId);
            });

            finalMessages = [...preserved, summaryMessage];
            usageAfterStage2Tokens = finalMessages.reduce((sum, message) => sum + message.estimatedTokens, 0);

            const record: CompactionRecord = {
              id: newId("compact"),
              sessionId: options.sessionId,
              taskId: options.taskId,
              stage: "summarize",
              sourceMessageIdsJson: JSON.stringify(summaryCandidates.map((message) => message.messageId)),
              summaryText: summaryMessage.content,
              summaryRef: summaryMessage.messageId,
              compactionReason: "context_overflow_stage2_summarize",
              overflowTriggered: 1,
              autoTriggered: 1,
              tokenReductionEstimate: Math.max(usageAfterStage1Tokens - usageAfterStage2Tokens, 0),
              createdAt: occurredAt,
            };
            this.store.session.insertCompactionRecord(record);
            persistedRecords.push(record);
          } else {
            fallbackToStage1 = true;
          }
        }
      }

      return {
        usageBeforeTokens,
        usageAfterStage1Tokens,
        usageAfterStage2Tokens,
        stage1Triggered,
        stage2Triggered,
        fallbackToStage1,
        contextMessages: finalMessages,
        persistedRecords,
        errorCode,
      };
    });
  }
}
