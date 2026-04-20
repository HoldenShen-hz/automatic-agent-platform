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
import { nowIso } from "../../contracts/types/ids.js";
import type { EventTier } from "../../contracts/types/domain.js";

const TERMINAL_TASK_STATUSES = ["done", "failed", "cancelled"] as const;
const TERMINAL_SESSION_STATUSES = ["completed", "failed"] as const;
type SqlParam = string | number | bigint | Uint8Array | null;

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
export class ObservabilityRetentionService {
  private readonly policy: ObservabilityRetentionPolicy;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    options: ObservabilityRetentionServiceOptions = {},
  ) {
    this.policy = {
      eventRetentionDays: {
        tier1: options.eventRetentionDays?.tier1 ?? null,
        tier2: options.eventRetentionDays?.tier2 ?? 14,
        tier3: options.eventRetentionDays?.tier3 ?? 3,
      },
      terminalMessageRetentionDays: options.terminalMessageRetentionDays ?? 30,
      preservedMessageTypes: [...new Set(options.preservedMessageTypes ?? ["summary", "compaction_summary"])].sort(),
    };
  }

  /**
   * Preview retention operations without actually deleting any data.
   * Returns a report showing what would be deleted and why.
   */
  public preview(evaluatedAt: string = nowIso()): ObservabilityRetentionReport {
    return this.buildReport("dry_run", evaluatedAt);
  }

  /**
   * Enforce retention policy by actually deleting eligible data.
   * Returns a report showing what was deleted and why.
   */
  public enforce(evaluatedAt: string = nowIso()): ObservabilityRetentionReport {
    return this.db.transaction(() => this.buildReport("enforced", evaluatedAt));
  }

  /**
   * Builds a retention report for both dry run and enforced modes.
   */
  private buildReport(mode: "dry_run" | "enforced", evaluatedAt: string): ObservabilityRetentionReport {
    return {
      mode,
      evaluatedAt,
      policy: this.policy,
      events: {
        tier_1: this.buildEventTierSummary("tier_1", this.policy.eventRetentionDays.tier1, mode, evaluatedAt),
        tier_2: this.buildEventTierSummary("tier_2", this.policy.eventRetentionDays.tier2, mode, evaluatedAt),
        tier_3: this.buildEventTierSummary("tier_3", this.policy.eventRetentionDays.tier3, mode, evaluatedAt),
      },
      messages: this.buildMessageSummary(mode, evaluatedAt),
      compactions: this.buildCompactionSummary(),
    };
  }

  /**
   * Builds retention summary for a specific event tier.
   * Events are only eligible for deletion if they belong to terminal tasks
   * (or the task no longer exists) and have passed the retention period.
   */
  private buildEventTierSummary(
    eventTier: EventTier,
    retentionDays: number | null,
    mode: "dry_run" | "enforced",
    evaluatedAt: string,
  ): ObservabilityRetentionTierSummary {
    const totalCount = this.selectCount("SELECT COUNT(*) AS count FROM events WHERE event_tier = ?", [eventTier]);

    // Null retention means never auto-delete (e.g., tier-1 critical events)
    if (retentionDays == null) {
      return {
        retentionDays,
        totalCount,
        eligibleCount: 0,
        deletedCount: 0,
        oldestEligibleCreatedAt: null,
      };
    }

    const cutoff = subtractDays(evaluatedAt, retentionDays);
    const eligibleParams: SqlParam[] = [eventTier, cutoff, ...TERMINAL_TASK_STATUSES];

    // Count events eligible for deletion: old events on terminal tasks
    const eligibleCount = this.selectCount(
      `SELECT COUNT(*) AS count
       FROM events e
       LEFT JOIN tasks t ON t.id = e.task_id
       WHERE e.event_tier = ?
         AND e.created_at < ?
         AND (t.id IS NULL OR t.status IN (${toPlaceholders(TERMINAL_TASK_STATUSES.length)}))`,
      eligibleParams,
    );

    // Find oldest eligible event for reporting
    const oldestEligibleCreatedAt = this.selectString(
      `SELECT MIN(e.created_at) AS value
       FROM events e
       LEFT JOIN tasks t ON t.id = e.task_id
       WHERE e.event_tier = ?
         AND e.created_at < ?
         AND (t.id IS NULL OR t.status IN (${toPlaceholders(TERMINAL_TASK_STATUSES.length)}))`,
      eligibleParams,
    );

    // Perform actual deletion in enforced mode
    const deletedCount =
      mode === "enforced" && eligibleCount > 0
        ? this.db.connection
            .prepare(
              `DELETE FROM events
               WHERE id IN (
                 SELECT e.id
                 FROM events e
                 LEFT JOIN tasks t ON t.id = e.task_id
                 WHERE e.event_tier = ?
                   AND e.created_at < ?
                   AND (t.id IS NULL OR t.status IN (${toPlaceholders(TERMINAL_TASK_STATUSES.length)}))
                )`,
            )
            .run(...eligibleParams)
        : null;
    const deletedCountValue = deletedCount ? Number(deletedCount.changes) : 0;

    return {
      retentionDays,
      totalCount,
      eligibleCount,
      deletedCount: deletedCountValue,
      oldestEligibleCreatedAt,
    };
  }

  /**
   * Builds retention summary for messages.
   * Messages are eligible for deletion if they are old, not of a preserved type,
   * and belong to terminal sessions/tasks.
   */
  private buildMessageSummary(
    mode: "dry_run" | "enforced",
    evaluatedAt: string,
  ): ObservabilityRetentionMessageSummary {
    const totalCount = this.selectCount("SELECT COUNT(*) AS count FROM messages");
    const cutoff = subtractDays(evaluatedAt, this.policy.terminalMessageRetentionDays);
    const preservedTypes = this.policy.preservedMessageTypes;

    // Build SQL conditions for terminal status checks
    const terminalCondition = [
      "(",
      `s.status IN (${toPlaceholders(TERMINAL_SESSION_STATUSES.length)})`,
      `OR t.status IN (${toPlaceholders(TERMINAL_TASK_STATUSES.length)})`,
      ")",
    ].join(" ");
    const deletableClause = `m.message_type NOT IN (${toPlaceholders(preservedTypes.length)})`;
    const preservedClause = `m.message_type IN (${toPlaceholders(preservedTypes.length)})`;
    const eligibilityParams: SqlParam[] = [cutoff, ...preservedTypes, ...TERMINAL_SESSION_STATUSES, ...TERMINAL_TASK_STATUSES];

    // Count messages eligible for deletion
    const eligibleCount = this.selectCount(
      `SELECT COUNT(*) AS count
       FROM messages m
       JOIN sessions s ON s.id = m.session_id
       JOIN tasks t ON t.id = s.task_id
       WHERE m.created_at < ?
         AND ${deletableClause}
         AND ${terminalCondition}`,
      eligibilityParams,
    );

    // Count preserved summary messages
    const preservedSummaryCount = this.selectCount(
      `SELECT COUNT(*) AS count
       FROM messages m
       WHERE m.created_at < ?
         AND ${preservedClause}`,
      [cutoff, ...preservedTypes],
    );

    // Count preserved messages from active sessions
    const preservedActiveSessionCount = this.selectCount(
      `SELECT COUNT(*) AS count
       FROM messages m
       JOIN sessions s ON s.id = m.session_id
       JOIN tasks t ON t.id = s.task_id
       WHERE m.created_at < ?
         AND ${deletableClause}
         AND NOT ${terminalCondition}`,
      eligibilityParams,
    );

    // Perform actual deletion in enforced mode
    const deletedCount =
      mode === "enforced" && eligibleCount > 0
        ? this.db.connection
            .prepare(
              `DELETE FROM messages
               WHERE id IN (
                 SELECT m.id
                 FROM messages m
                 JOIN sessions s ON s.id = m.session_id
                 JOIN tasks t ON t.id = s.task_id
                 WHERE m.created_at < ?
                   AND ${deletableClause}
                   AND ${terminalCondition}
                )`,
            )
            .run(...eligibilityParams)
        : null;
    const deletedCountValue = deletedCount ? Number(deletedCount.changes) : 0;

    return {
      retentionDays: this.policy.terminalMessageRetentionDays,
      totalCount,
      eligibleCount,
      deletedCount: deletedCountValue,
      preservedSummaryCount,
      preservedActiveSessionCount,
      preservedMessageTypes: preservedTypes,
    };
  }

  /**
   * Builds compaction record preservation summary.
   * Compaction records are currently preserved and not subject to retention.
   */
  private buildCompactionSummary(): ObservabilityRetentionCompactionSummary {
    const totalCount = this.selectCount("SELECT COUNT(*) AS count FROM compaction_records");
    return {
      totalCount,
      preservedCount: totalCount,
    };
  }

  /**
   * Executes a count query and returns the count value.
   */
  private selectCount(sql: string, params: SqlParam[] = []): number {
    const row = this.db.connection.prepare(sql).get(...params) as { count?: number } | undefined;
    return Number(row?.count ?? 0);
  }

  /**
   * Executes a query and returns a string value from a 'value' column.
   */
  private selectString(sql: string, params: SqlParam[] = []): string | null {
    const row = this.db.connection.prepare(sql).get(...params) as { value?: string | null } | undefined;
    return typeof row?.value === "string" ? row.value : null;
  }
}

/**
 * Subtracts a number of days from an ISO timestamp string.
 */
function subtractDays(value: string, days: number): string {
  return new Date(Date.parse(value) - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Generates a comma-separated list of SQL placeholders.
 */
function toPlaceholders(count: number): string {
  return new Array(count).fill("?").join(", ");
}
