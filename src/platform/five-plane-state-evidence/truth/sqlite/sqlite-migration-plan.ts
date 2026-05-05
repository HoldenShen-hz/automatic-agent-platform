import { createHash } from "node:crypto";

import {
  LLM_EVAL_DDL,
  PROMPT_MODEL_POLICY_GOVERNANCE_DDL,
} from "../../../prompt-engine/eval/prompt-model-policy-governance-schema.js";
import {
  WORKER_TELEMETRY_HEARTBEAT_SQL,
  WORKER_RESTART_SEMANTICS_SQL,
  AGENT_EXECUTION_RECORD_SQL,
  REMOTE_FALLBACK_ROUTING_SQL,
  WORKER_ISOLATION_ROUTING_SQL,
  MESSAGE_PARTS_SQL,
  REMOTE_REPO_VERSION_ROUTING_SQL,
  REMOTE_SESSION_TELEMETRY_SQL,
  REMOTE_LOG_AGGREGATION_SQL,
  TRUSTED_REMOTE_WORKER_REGISTRATION_SQL,
  EVENT_SESSION_ID_SQL,
  // R4-30 (INV-FENCING): Add lease_id and fencing_token columns for fencing token enforcement
  HARNESS_RUN_LEASE_FENCING_MIGRATION_SQL,
  SIDE_EFFECT_LEASE_FENCING_MIGRATION_SQL,
  BUDGET_LEDGER_LEASE_FENCING_MIGRATION_SQL,
  WORKER_IDENTITY_AND_CAPACITY_SQL,
  EXECUTION_TICKET_GRAPH_SCHEDULING_SQL,
} from "./sqlite-migration-runtime-part1.js";
import {
  REMOTE_WORKSPACE_SYNC_TELEMETRY_SQL,
  SECRET_MANAGEMENT_FOUNDATION_SQL,
  TIER1_AUDIT_EVENT_INTEGRITY_SQL,
  MEMORY_SCOPE_AND_QUALITY_SQL,
  EVOLUTION_MVP_SQL,
  EXPERIENCE_CACHE_SQL,
  PMF_VALIDATION_REPORTS_SQL,
  BILLING_FOUNDATION_SQL,
  PERCEPTION_MVP_SQL,
  GATEWAY_TARGET_DIRECTORY_SQL,
  ENTERPRISE_FOUNDATION_SQL,
  MARKETPLACE_GOVERNANCE_SQL,
} from "./sqlite-migration-runtime-part2.js";
import {
  TENANT_DATA_NAMESPACE_FOUNDATION_SQL,
  DATA_PLANE_FLOW_FOUNDATION_SQL,
  RELEASE_DEPLOYMENT_LEDGER_SQL,
  SECRET_LEASES_SQL,
  RELEASE_EXECUTION_REPORTS_SQL,
  WORKFLOW_DISPATCH_RECEIPT_AUDIT_SQL,
  LLM_EVAL_AND_GOVERNANCE_FOUNDATION_SQL,
  ENTERPRISE_GOVERNANCE_FOUNDATION_SQL,
  CONTROL_PLANE_LOAD_BALANCING_FOUNDATION_SQL,
  SKILL_GOVERNANCE_FOUNDATION_SQL,
  TASK_TENANT_SCOPE_SQL,
  BILLING_COLLECTION_FOUNDATION_SQL,
  PRODUCT_GOVERNANCE_TENANT_SCOPE_SQL,
  MEMORY_ENHANCEMENT_SQL,
  EVENT_DEAD_LETTERS_SQL,
  SESSION_EVENTS_SQL,
  DLQ_RECORDS_SQL,
  BILLING_USAGE_EVENT_CANONICAL_ATTRIBUTION_SQL,
  CONFIG_VERSIONING_AND_ROLLOUT_SQL,
  EXTENDED_DLQ_RECORDS_SQL,
} from "./sqlite-migration-runtime-part3.js";
import { ENTERPRISE_GOVERNANCE_DDL } from "../../../control-plane/incident-control/enterprise-governance-schema.js";
import { CONTROL_PLANE_LOAD_BALANCING_DDL } from "../sql/control-plane-load-balancing-ddl.js";
import { AUTHORITATIVE_SCHEMA_SQL } from "../sql/authoritative-schema.js";
import { OUTBOX_SCHEMA_SQL } from "../sql/outbox-schema.js";
import { RUNTIME_PHYSICAL_SCHEMA_SQL } from "../../../five-plane-state-evidence/truth/runtime-physical-schema.js";
import { CAS_RECORDS_SQL } from "./sqlite-migration-runtime-part4.js";

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
 * Normalizes SQL by trimming whitespace and adding a trailing newline.
 * @param sql - The SQL string to normalize
 * @returns The normalized SQL string
 */
function normalizeSql(sql: string): string {
  return `${sql.trim()}\n`;
}

/**
 * Computes a SHA256 checksum of the SQL for integrity verification.
 * @param sql - The SQL string to checksum
 * @returns The hex-encoded SHA256 checksum
 */
function checksumSql(sql: string): string {
  return createHash("sha256").update(normalizeSql(sql), "utf8").digest("hex");
}

/**
 * Creates a migration definition with normalized SQL and computed checksum.
 * @param version - The migration version number
 * @param name - The migration name
 * @param sql - The SQL to execute for this migration
 * @param options - Optional configuration including compatible checksums
 * @returns The migration definition
 */
function defineMigration(
  version: number,
  name: string,
  sql: string,
  options: {
    compatibleSql?: readonly string[];
    downSql?: string;
  } = {},
): SqliteMigrationDefinition {
  const normalizedSql = normalizeSql(sql);
  const checksum = checksumSql(normalizedSql);
  const downSql = normalizeSql(
    options.downSql
      ?? `-- down migration placeholder for ${name}\nSELECT 'manual rollback required for ${name}' AS rollback_notice;`,
  );
  const compatibleChecksums = Array.from(
    new Set(
      (options.compatibleSql ?? [])
        .map((candidate) => checksumSql(candidate))
        .filter((candidateChecksum) => candidateChecksum !== checksum),
    ),
  );
  return {
    version,
    name,
    sql: normalizedSql,
    checksum,
    downSql,
    compatibleChecksums,
  };
}

/**
 * SQL to create the schema migrations ledger table for tracking applied migrations.
 */
export const SQLITE_MIGRATION_LEDGER_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
`;

/**
 * Runtime pragmas that are applied at connection time, not during migration.
 */
const PHASE_1A_RUNTIME_PRAGMAS_SQL = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
`;

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
export const SQLITE_MIGRATIONS: readonly SqliteMigrationDefinition[] = [
  defineMigration(1, "0001_phase1a_init", AUTHORITATIVE_SCHEMA_SQL, {
    compatibleSql: [`${PHASE_1A_RUNTIME_PRAGMAS_SQL}\n${AUTHORITATIVE_SCHEMA_SQL}`],
  }),
  defineMigration(2, "0002_worker_telemetry_heartbeat", WORKER_TELEMETRY_HEARTBEAT_SQL),
  defineMigration(3, "0003_worker_restart_semantics", WORKER_RESTART_SEMANTICS_SQL),
  defineMigration(4, "0004_agent_execution_records", AGENT_EXECUTION_RECORD_SQL),
  defineMigration(5, "0005_remote_fallback_routing", REMOTE_FALLBACK_ROUTING_SQL),
  defineMigration(6, "0006_worker_isolation_routing", WORKER_ISOLATION_ROUTING_SQL),
  defineMigration(7, "0007_message_parts", MESSAGE_PARTS_SQL),
  defineMigration(8, "0008_remote_repo_version_routing", REMOTE_REPO_VERSION_ROUTING_SQL),
  defineMigration(9, "0009_remote_session_telemetry", REMOTE_SESSION_TELEMETRY_SQL),
  defineMigration(10, "0010_remote_log_aggregation", REMOTE_LOG_AGGREGATION_SQL),
  defineMigration(11, "0011_trusted_remote_worker_registration", TRUSTED_REMOTE_WORKER_REGISTRATION_SQL),
  defineMigration(12, "0012_event_session_id", EVENT_SESSION_ID_SQL),
  defineMigration(13, "0013_remote_workspace_sync_telemetry", REMOTE_WORKSPACE_SYNC_TELEMETRY_SQL),
  defineMigration(14, "0014_tier1_audit_event_integrity", TIER1_AUDIT_EVENT_INTEGRITY_SQL),
  defineMigration(15, "0015_memory_scope_and_quality", MEMORY_SCOPE_AND_QUALITY_SQL),
  defineMigration(16, "0016_evolution_mvp", EVOLUTION_MVP_SQL),
  defineMigration(17, "0017_experience_cache", EXPERIENCE_CACHE_SQL),
  defineMigration(18, "0018_pmf_validation_reports", PMF_VALIDATION_REPORTS_SQL),
  defineMigration(19, "0019_billing_foundation", BILLING_FOUNDATION_SQL),
  defineMigration(20, "0020_perception_mvp", PERCEPTION_MVP_SQL),
  defineMigration(21, "0021_gateway_target_directory", GATEWAY_TARGET_DIRECTORY_SQL),
  defineMigration(22, "0022_enterprise_foundation", ENTERPRISE_FOUNDATION_SQL),
  defineMigration(23, "0023_marketplace_governance", MARKETPLACE_GOVERNANCE_SQL),
  defineMigration(24, "0024_tenant_data_namespace_foundation", TENANT_DATA_NAMESPACE_FOUNDATION_SQL),
  defineMigration(25, "0025_data_plane_flow_foundation", DATA_PLANE_FLOW_FOUNDATION_SQL),
  defineMigration(26, "0026_secret_management_foundation", SECRET_MANAGEMENT_FOUNDATION_SQL),
  defineMigration(27, "0027_release_deployment_ledger", RELEASE_DEPLOYMENT_LEDGER_SQL),
  defineMigration(28, "0028_secret_leases", SECRET_LEASES_SQL),
  defineMigration(29, "0029_release_execution_reports", RELEASE_EXECUTION_REPORTS_SQL),
  defineMigration(30, "0030_workflow_dispatch_receipt_audit", WORKFLOW_DISPATCH_RECEIPT_AUDIT_SQL),
  defineMigration(31, "0031_llm_eval_and_governance_foundation", LLM_EVAL_AND_GOVERNANCE_FOUNDATION_SQL),
  defineMigration(32, "0032_enterprise_governance_foundation", ENTERPRISE_GOVERNANCE_FOUNDATION_SQL),
  defineMigration(33, "0033_control_plane_load_balancing_foundation", CONTROL_PLANE_LOAD_BALANCING_FOUNDATION_SQL),
  defineMigration(34, "0034_skill_governance_foundation", SKILL_GOVERNANCE_FOUNDATION_SQL),
  defineMigration(35, "0035_task_tenant_scope", TASK_TENANT_SCOPE_SQL),
  defineMigration(36, "0036_billing_collection_foundation", BILLING_COLLECTION_FOUNDATION_SQL),
  defineMigration(37, "0037_product_governance_tenant_scope", PRODUCT_GOVERNANCE_TENANT_SCOPE_SQL),
  defineMigration(38, "0038_memory_enhancement", MEMORY_ENHANCEMENT_SQL),
  defineMigration(39, "0039_event_dead_letters", EVENT_DEAD_LETTERS_SQL),
  defineMigration(40, "0040_session_events", SESSION_EVENTS_SQL),
  defineMigration(41, "0041_dlq_records_persistence", DLQ_RECORDS_SQL),
  defineMigration(42, "0042_outbox_schema", OUTBOX_SCHEMA_SQL),
  defineMigration(43, "0043_billing_usage_event_canonical_attribution", BILLING_USAGE_EVENT_CANONICAL_ATTRIBUTION_SQL),
  // R4-30 (INV-FENCING): Add lease_id and fencing_token columns to harness_runs for single-leader enforcement
  defineMigration(44, "0044_harness_run_lease_fencing", HARNESS_RUN_LEASE_FENCING_MIGRATION_SQL),
  // R4-30 (INV-FENCING): Add lease_id and fencing_token columns to side_effect_records for fencing enforcement
  defineMigration(45, "0045_side_effect_lease_fencing", SIDE_EFFECT_LEASE_FENCING_MIGRATION_SQL),
  // R4-30 (INV-FENCING): Add lease_id and fencing_token columns to budget_ledgers for fencing enforcement
  defineMigration(46, "0046_budget_ledger_lease_fencing", BUDGET_LEDGER_LEASE_FENCING_MIGRATION_SQL),
  // Bridge legacy authoritative storage with the canonical five-plane runtime schema.
  defineMigration(47, "0047_runtime_physical_schema_foundation", RUNTIME_PHYSICAL_SCHEMA_SQL),
  defineMigration(48, "0048_worker_identity_and_capacity", WORKER_IDENTITY_AND_CAPACITY_SQL),
  defineMigration(49, "0049_execution_ticket_graph_scheduling", EXECUTION_TICKET_GRAPH_SCHEDULING_SQL),
  // R15-78/R15-79: Persist config version snapshots and active rollouts to SQLite
  defineMigration(50, "0050_config_versioning_and_rollout", CONFIG_VERSIONING_AND_ROLLOUT_SQL),
  // R16-35: Persist CAS records to SQLite instead of in-memory Map
  defineMigration(51, "0051_cas_records_persistence", CAS_RECORDS_SQL),
  // R16-37: Add extended DLQ columns for DlqService persistence
  defineMigration(52, "0052_extended_dlq_records", EXTENDED_DLQ_RECORDS_SQL),
] as const;

/**
 * Gets the latest migration version number.
 * @returns The latest version, or 0 if no migrations exist
 */
export function getLatestSqliteMigrationVersion(): number {
  return SQLITE_MIGRATIONS.at(-1)?.version ?? 0;
}
