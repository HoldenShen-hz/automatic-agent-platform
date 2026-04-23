/**
 * Defines a SQLite database migration with version, name, SQL, and checksum.
 */
export interface SqliteMigrationDefinition {
    version: number;
    name: string;
    sql: string;
    checksum: string;
    downSql?: string;
    compatibleChecksums?: readonly string[];
}
/**
 * SQL to create the schema migrations ledger table for tracking applied migrations.
 */
export declare const SQLITE_MIGRATION_LEDGER_SQL = "\nCREATE TABLE IF NOT EXISTS schema_migrations (\n  version INTEGER PRIMARY KEY,\n  name TEXT NOT NULL,\n  checksum TEXT NOT NULL,\n  applied_at TEXT NOT NULL\n);\n";
/**
 * Migration 2: Adds worker telemetry and heartbeat columns to worker_snapshots table.
 */
/**
 * Migration 3: Adds worker runtime instance and restart chain metadata.
 */
/**
 * Migration 4: Adds per-execution agent runtime evidence records.
 */
/**
 * Migration 5: Adds worker placement and dispatch target metadata for remote fallback routing.
 */
/**
 * Migration 6: Adds worker isolation metadata and required isolation routing constraints.
 */
/**
 * Migration 7: Adds structured message parts storage for replay and compaction.
 */
/**
 * Migration 8: Adds repo version consistency metadata for remote dispatch fail-closed routing.
 */
/**
 * Migration 9: Adds remote session telemetry and stream resume observability columns.
 */
/**
 * Migration 10: Adds persisted remote worker log entries for task-level aggregation.
 */
/**
 * Migration 11: Adds trusted remote worker registration metadata and challenge records.
 */
/**
 * Migration 12: Adds session_id column to events table for session-level event tracking.
 */
/**
 * Migration 13: Adds remote workspace sync conflict telemetry for fail-closed ownership.
 */
/**
 * Migration 26: Adds secret registry, usage audit, and rotation persistence.
 */
/**
 * Migration 14: Adds tamper-evident integrity chain records for Tier 1 audit events.
 */
/**
 * Migration 15: Expands the memories table with scope references, quality, and lifecycle metadata.
 */
/**
 * Migration 16: Adds evolution proposal, policy, and audit log tables.
 */
/**
 * Migration 17: Adds experience cache table for few-shot and evolution evidence reuse.
 */
/**
 * Migration 18: Adds persisted PMF validation reports for Phase 3 product evidence.
 */
/**
 * Migration 19: Adds billing accounts, usage events, quota counters, ledger entries, and entitlement decisions.
 */
/**
 * Migration 20: Adds perception sources, intel items, briefs, and action proposals.
 */
/**
 * Migration 21: Adds gateway target directory for canonical target resolution.
 */
/**
 * Migration 22: Adds enterprise environment readiness registry and capability reports.
 */
/**
 * Migration 23: Adds marketplace governance registry, reviews, publications and reports.
 */
/**
 * Migration 24: Adds tenant, organization, deployment binding, and data namespace foundation tables.
 */
/**
 * Migration 25: Adds analytics, archive, replay, and movement-job tables for tenant-aware data plane flows.
 */
/**
 * Migration 27: Adds persisted release bundle, deployment execution, and promotion history ledgers.
 */
/**
 * Migration 28: Adds short-lived secret lease issuance ledger.
 */
/**
 * Migration 29: Adds release execution report ledger.
 */
/**
 * Migration 30: Adds workflow dispatch receipt audit columns.
 */
/**
 * Migration 31: Adds LLM eval and prompt/model/policy governance tables.
 */
/**
 * Migration 32: Adds enterprise governance evidence and incident handoff persistence.
 */
/**
 * Migration 33: Adds control-plane coordinator load-balancing persistence.
 */
/**
 * Migration 34: Adds skill governance registry and execution policy persistence.
 */
/**
 * Migration 35: Adds tenant scope to task records for tenant-aware query isolation.
 */
/**
 * Migration 36: Adds billing invoices and payment session records for collection workflows.
 */
/**
 * Migration 37: Adds tenant scope columns and indexes for remaining product/governance tables.
 */
/**
 * Registry of all SQLite migrations in order.
 * Each migration is self-contained and can be applied independently.
 */
export declare const SQLITE_MIGRATIONS: readonly SqliteMigrationDefinition[];
/**
 * Gets the latest migration version number.
 * @returns The latest version, or 0 if no migrations exist
 */
export declare function getLatestSqliteMigrationVersion(): number;
