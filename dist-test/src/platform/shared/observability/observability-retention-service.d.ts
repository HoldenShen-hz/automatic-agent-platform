/**
 * Observability Retention Service
 *
 * Manages data retention policies for observability data including events and messages.
 * Provides both preview (dry run) and enforced deletion modes for managing storage.
 *
 * The service enforces different retention periods for each event tier:
 * - Tier 1: Critical events with optional (null) retention (never auto-deleted)
 * - Tier 2: Standard retention period (default 14 days)
 * - Tier 3: Short retention period (default 3 days)
 *
 * Additionally manages message retention, preserving messages associated with
 * active sessions and specific message types like summaries and compactions.
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/observability_contract.md | Observability Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary - retention, compaction}
 */
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { EventTier } from "../../contracts/types/domain.js";
/**
 * Configurable retention policy for observability data.
 */
export interface ObservabilityRetentionPolicy {
    eventRetentionDays: {
        tier1: number | null;
        tier2: number;
        tier3: number;
    };
    terminalMessageRetentionDays: number;
    preservedMessageTypes: string[];
}
/**
 * Summary of retention status for a specific event tier.
 */
export interface ObservabilityRetentionTierSummary {
    retentionDays: number | null;
    totalCount: number;
    eligibleCount: number;
    deletedCount: number;
    oldestEligibleCreatedAt: string | null;
}
/**
 * Summary of message retention status.
 */
export interface ObservabilityRetentionMessageSummary {
    retentionDays: number;
    totalCount: number;
    eligibleCount: number;
    deletedCount: number;
    preservedSummaryCount: number;
    preservedActiveSessionCount: number;
    preservedMessageTypes: string[];
}
/**
 * Summary of compaction record preservation.
 */
export interface ObservabilityRetentionCompactionSummary {
    totalCount: number;
    preservedCount: number;
}
/**
 * Complete retention report showing status of all observability data.
 */
export interface ObservabilityRetentionReport {
    mode: "dry_run" | "enforced";
    evaluatedAt: string;
    policy: ObservabilityRetentionPolicy;
    events: Record<EventTier, ObservabilityRetentionTierSummary>;
    messages: ObservabilityRetentionMessageSummary;
    compactions: ObservabilityRetentionCompactionSummary;
}
/**
 * Configuration options for the retention service.
 */
export interface ObservabilityRetentionServiceOptions {
    eventRetentionDays?: Partial<{
        tier1: number | null;
        tier2: number;
        tier3: number;
    }>;
    terminalMessageRetentionDays?: number;
    preservedMessageTypes?: string[];
}
/**
 * ObservabilityRetentionService enforces retention policies on observability data.
 * Supports both dry-run previews and enforced deletion of old data.
 */
export declare class ObservabilityRetentionService {
    private readonly db;
    private readonly policy;
    constructor(db: AuthoritativeSqlDatabase, options?: ObservabilityRetentionServiceOptions);
    /**
     * Preview retention operations without actually deleting any data.
     * Returns a report showing what would be deleted and why.
     */
    preview(evaluatedAt?: string): ObservabilityRetentionReport;
    /**
     * Enforce retention policy by actually deleting eligible data.
     * Returns a report showing what was deleted and why.
     */
    enforce(evaluatedAt?: string): ObservabilityRetentionReport;
    /**
     * Builds a retention report for both dry run and enforced modes.
     */
    private buildReport;
    /**
     * Builds retention summary for a specific event tier.
     * Events are only eligible for deletion if they belong to terminal tasks
     * (or the task no longer exists) and have passed the retention period.
     */
    private buildEventTierSummary;
    /**
     * Builds retention summary for messages.
     * Messages are eligible for deletion if they are old, not of a preserved type,
     * and belong to terminal sessions/tasks.
     */
    private buildMessageSummary;
    /**
     * Builds compaction record preservation summary.
     * Compaction records are currently preserved and not subject to retention.
     */
    private buildCompactionSummary;
    /**
     * Executes a count query and returns the count value.
     */
    private selectCount;
    /**
     * Executes a query and returns a string value from a 'value' column.
     */
    private selectString;
}
