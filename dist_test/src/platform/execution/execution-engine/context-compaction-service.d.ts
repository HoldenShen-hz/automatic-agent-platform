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
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { KvCachePrefixConfig } from "./kv-cache-prefix-config.js";
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
export declare class ContextCompactionService {
    private readonly db;
    private readonly store;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore);
    compactContext(options: ContextCompactionOptions): ContextCompactionResult;
}
