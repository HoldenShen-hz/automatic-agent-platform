import { createHash } from "node:crypto";

import {
  LLM_EVAL_DDL,
  PROMPT_MODEL_POLICY_GOVERNANCE_DDL,
} from "../../../prompt-engine/eval/prompt-model-policy-governance-schema.js";
import { RUNTIME_PHYSICAL_SCHEMA_SQL } from "../runtime-physical-schema.js";
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
} from "./sqlite-migration-runtime-part3.js";
import { ENTERPRISE_GOVERNANCE_DDL } from "../../../five-plane-control-plane/incident-control/enterprise-governance-schema.js";
import { CONTROL_PLANE_LOAD_BALANCING_DDL } from "../sql/control-plane-load-balancing-ddl.js";
import { AUTHORITATIVE_SCHEMA_SQL } from "../sql/authoritative-schema.js";
import { OUTBOX_SCHEMA_SQL } from "../sql/outbox-schema.js";
import {
  CONFIG_ROLLOUT_PERSISTENCE_SQL,
  WORKER_SNAPSHOT_VERSION_SQL,
} from "./sqlite-migration-runtime-part4.js";

/**
 * Defines a SQLite database migration with version, name, SQL, and checksum.
 */
export interface SqliteMigrationDefinition {
  version: number;
  name: string;
  sql: string;
  checksum: string;
  appliedChecksum: string;
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

function normalizeSqlForCompatibility(sql: string): string {
  return `${sql
    .trim()
    .split("\n")
    .map((line) => line.trim().replace(/[ \t]+/g, " "))
    .filter((line) => line.length > 0)
    .join("\n")}\n`;
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
    appliedSql?: string;
    compatibleSql?: readonly string[];
    downSql?: string;
  } = {},
): SqliteMigrationDefinition {
  const normalizedSql = normalizeSql(sql);
  const checksum = checksumSql(normalizedSql);
  const appliedChecksum = checksumSql(options.appliedSql ?? normalizedSql);
  const downSql = normalizeSql(
    options.downSql
      ?? `-- down migration placeholder for ${name}\nSELECT 'manual rollback required for ${name}' AS rollback_notice;`,
  );
  const compatibleChecksums = Array.from(
    new Set(
      [
        normalizeSqlForCompatibility(sql),
        ...(options.appliedSql == null ? [] : [normalizeSqlForCompatibility(options.appliedSql)]),
        ...(options.compatibleSql ?? []),
      ]
        .map((candidate) => checksumSql(candidate))
        .filter((candidateChecksum) => candidateChecksum !== checksum),
    ),
  );
  return {
    version,
    name,
    sql: normalizedSql,
    checksum,
    appliedChecksum,
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

const MIGRATION_0005_APPLIED_SQL = `
ALTER TABLE worker_snapshots ADD COLUMN placement TEXT NOT NULL DEFAULT 'local';
ALTER TABLE execution_tickets ADD COLUMN dispatch_target TEXT NOT NULL DEFAULT 'any';
`;

const MIGRATION_0006_APPLIED_SQL = `
ALTER TABLE worker_snapshots ADD COLUMN isolation_level TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE execution_tickets ADD COLUMN required_isolation_level TEXT NOT NULL DEFAULT 'standard';
`;

const MIGRATION_0007_APPLIED_SQL = `
ALTER TABLE messages ADD COLUMN parts_json TEXT NULL;
`;

const MIGRATION_0008_APPLIED_SQL = `
ALTER TABLE worker_snapshots ADD COLUMN repo_version TEXT NULL;
ALTER TABLE execution_tickets ADD COLUMN required_repo_version TEXT NULL;
`;

const MIGRATION_0009_APPLIED_SQL = `
ALTER TABLE worker_snapshots ADD COLUMN remote_session_status TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN last_acknowledged_stream_offset TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN stream_resume_success_rate REAL NULL;
ALTER TABLE worker_snapshots ADD COLUMN credential_refresh_success_rate REAL NULL;
ALTER TABLE worker_snapshots ADD COLUMN session_consistency_check_status TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN session_consistency_checked_at TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN saturation REAL NULL;
ALTER TABLE worker_snapshots ADD COLUMN active_lease_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE worker_snapshots ADD COLUMN mean_startup_latency_ms INTEGER NULL;
ALTER TABLE worker_snapshots ADD COLUMN sandbox_success_rate REAL NULL;
ALTER TABLE worker_snapshots ADD COLUMN repo_cache_hit_rate REAL NULL;
`;

const MIGRATION_0011_APPLIED_SQL = `
ALTER TABLE worker_snapshots ADD COLUMN registration_verified_at TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN registration_challenge_id TEXT NULL;
CREATE TABLE IF NOT EXISTS worker_registration_challenges (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  challenge_token_hash TEXT NOT NULL,
  allowed_capabilities_json TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_worker_registration_challenges_worker_created_at
  ON worker_registration_challenges(worker_id, created_at DESC);
`;

const MIGRATION_0012_APPLIED_SQL = `
ALTER TABLE events ADD COLUMN session_id TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_events_session_created_at ON events(session_id, created_at);
`;

const MIGRATION_0013_APPLIED_SQL = `
ALTER TABLE worker_snapshots ADD COLUMN workspace_sync_status TEXT NULL;
ALTER TABLE worker_snapshots ADD COLUMN workspace_sync_checked_at TEXT NULL;
`;

const MIGRATION_0015_APPLIED_SQL = `
ALTER TABLE memories ADD COLUMN session_id TEXT NULL;
ALTER TABLE memories ADD COLUMN agent_id TEXT NULL;
ALTER TABLE memories ADD COLUMN execution_id TEXT NULL;
ALTER TABLE memories ADD COLUMN memory_layer TEXT NOT NULL DEFAULT 'layer_3';
ALTER TABLE memories ADD COLUMN source_trust_level TEXT NOT NULL DEFAULT 'trusted';
ALTER TABLE memories ADD COLUMN quality_score REAL NULL;
ALTER TABLE memories ADD COLUMN hit_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE memories ADD COLUMN last_accessed_at TEXT NULL;
ALTER TABLE memories ADD COLUMN expires_at TEXT NULL;
ALTER TABLE memories ADD COLUMN revoked_at TEXT NULL;
ALTER TABLE memories ADD COLUMN revocation_reason TEXT NULL;
CREATE INDEX IF NOT EXISTS idx_memories_scope_created_at
  ON memories(scope, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_task_created_at
  ON memories(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_session_created_at
  ON memories(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_execution_created_at
  ON memories(execution_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_layer_scope_created_at
  ON memories(memory_layer, scope, created_at DESC);
`;

const MIGRATION_0024_APPLIED_SQL = `
CREATE TABLE IF NOT EXISTS organizations (
  organization_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  billing_account_id TEXT NULL,
  default_tenant_id TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(billing_account_id) REFERENCES billing_accounts(account_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_organizations_billing_account_updated_at
  ON organizations(billing_account_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS workspaces (
  workspace_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  default_policy_set TEXT NOT NULL,
  organization_id TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(organization_id) REFERENCES organizations(organization_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_updated_at
  ON workspaces(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspaces_organization_updated_at
  ON workspaces(organization_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS workspace_memberships (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY(workspace_id) REFERENCES workspaces(workspace_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user_workspace
  ON workspace_memberships(user_id, workspace_id);

CREATE TABLE IF NOT EXISTS organization_memberships (
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (organization_id, user_id),
  FOREIGN KEY(organization_id) REFERENCES organizations(organization_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_user_organization
  ON organization_memberships(user_id, organization_id);

ALTER TABLE tenants ADD COLUMN organization_id TEXT NULL;
ALTER TABLE tenants ADD COLUMN storage_scope TEXT NOT NULL DEFAULT 'tenant';
ALTER TABLE tenants ADD COLUMN identity_scope TEXT NOT NULL DEFAULT 'tenant';
ALTER TABLE tenants ADD COLUMN policy_scope TEXT NOT NULL DEFAULT 'tenant';
ALTER TABLE tenants ADD COLUMN artifact_scope TEXT NOT NULL DEFAULT 'tenant';
ALTER TABLE tenants ADD COLUMN isolation_mode TEXT NOT NULL DEFAULT 'shared';
ALTER TABLE tenants ADD COLUMN deployment_mode TEXT NOT NULL DEFAULT 'single_region';
CREATE INDEX IF NOT EXISTS idx_tenants_organization_updated_at
  ON tenants(organization_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS deployment_bindings (
  binding_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  deployment_mode TEXT NOT NULL,
  region TEXT NOT NULL,
  network_boundary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deployment_bindings_tenant_environment
  ON deployment_bindings(tenant_id, environment_id);

CREATE TABLE IF NOT EXISTS data_namespaces (
  namespace_id TEXT PRIMARY KEY,
  plane TEXT NOT NULL,
  tenant_id TEXT NULL,
  organization_id TEXT NULL,
  workspace_id TEXT NULL,
  retention_policy TEXT NOT NULL,
  encryption_policy TEXT NOT NULL,
  residency_policy TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id) REFERENCES organizations(organization_id) ON DELETE SET NULL,
  FOREIGN KEY(workspace_id) REFERENCES workspaces(workspace_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_data_namespaces_plane_updated_at
  ON data_namespaces(plane, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_namespaces_tenant_plane
  ON data_namespaces(tenant_id, plane, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_namespaces_workspace_plane
  ON data_namespaces(workspace_id, plane, updated_at DESC);
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
 * Migration 43: Adds harness_runs table for tracking task execution runs.
 */
export const HARNESS_RUNS_SQL = `
CREATE TABLE IF NOT EXISTS harness_runs (
  harness_run_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  confirmed_task_spec_id TEXT NOT NULL,
  request_envelope_id TEXT NOT NULL,
  status TEXT NOT NULL,
  version_lock_id TEXT NOT NULL,
  budget_ledger_id TEXT NOT NULL,
  current_seq INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
`;

/**
 * Migration 44: Adds the full runtime physical schema and extends harness_runs
 * with the durable harness execution columns used by the execution engine.
 */
export const RUNTIME_PHYSICAL_SCHEMA_FOUNDATION_SQL = RUNTIME_PHYSICAL_SCHEMA_SQL;

const MIGRATION_0044_APPLIED_SQL = `
${RUNTIME_PHYSICAL_SCHEMA_FOUNDATION_SQL.trim()}
ALTER TABLE harness_runs ADD COLUMN org_id TEXT NOT NULL DEFAULT '';
ALTER TABLE harness_runs ADD COLUMN trace_id TEXT NOT NULL DEFAULT '';
ALTER TABLE harness_runs ADD COLUMN goal TEXT NULL;
ALTER TABLE harness_runs ADD COLUMN risk_level TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE harness_runs ADD COLUMN domain_id TEXT NOT NULL DEFAULT 'unassigned';
ALTER TABLE harness_runs ADD COLUMN request_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE harness_runs ADD COLUMN constraint_pack_ref TEXT NOT NULL DEFAULT '';
ALTER TABLE harness_runs ADD COLUMN created_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
ALTER TABLE harness_runs ADD COLUMN fencing_token TEXT NOT NULL DEFAULT '';
ALTER TABLE budget_reservations ADD COLUMN created_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
`;

const MIGRATION_0045_APPLIED_SQL = `
ALTER TABLE worker_snapshots ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
`;

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
  defineMigration(5, "0005_remote_fallback_routing", REMOTE_FALLBACK_ROUTING_SQL, { appliedSql: MIGRATION_0005_APPLIED_SQL }),
  defineMigration(6, "0006_worker_isolation_routing", WORKER_ISOLATION_ROUTING_SQL, { appliedSql: MIGRATION_0006_APPLIED_SQL }),
  defineMigration(7, "0007_message_parts", MESSAGE_PARTS_SQL, { appliedSql: MIGRATION_0007_APPLIED_SQL }),
  defineMigration(8, "0008_remote_repo_version_routing", REMOTE_REPO_VERSION_ROUTING_SQL, { appliedSql: MIGRATION_0008_APPLIED_SQL }),
  defineMigration(9, "0009_remote_session_telemetry", REMOTE_SESSION_TELEMETRY_SQL, { appliedSql: MIGRATION_0009_APPLIED_SQL }),
  defineMigration(10, "0010_remote_log_aggregation", REMOTE_LOG_AGGREGATION_SQL),
  defineMigration(11, "0011_trusted_remote_worker_registration", TRUSTED_REMOTE_WORKER_REGISTRATION_SQL, { appliedSql: MIGRATION_0011_APPLIED_SQL }),
  defineMigration(12, "0012_event_session_id", EVENT_SESSION_ID_SQL, { appliedSql: MIGRATION_0012_APPLIED_SQL }),
  defineMigration(13, "0013_remote_workspace_sync_telemetry", REMOTE_WORKSPACE_SYNC_TELEMETRY_SQL, { appliedSql: MIGRATION_0013_APPLIED_SQL }),
  defineMigration(14, "0014_tier1_audit_event_integrity", TIER1_AUDIT_EVENT_INTEGRITY_SQL),
  defineMigration(15, "0015_memory_scope_and_quality", MEMORY_SCOPE_AND_QUALITY_SQL, { appliedSql: MIGRATION_0015_APPLIED_SQL }),
  defineMigration(16, "0016_evolution_mvp", EVOLUTION_MVP_SQL),
  defineMigration(17, "0017_experience_cache", EXPERIENCE_CACHE_SQL),
  defineMigration(18, "0018_pmf_validation_reports", PMF_VALIDATION_REPORTS_SQL),
  defineMigration(19, "0019_billing_foundation", BILLING_FOUNDATION_SQL),
  defineMigration(20, "0020_perception_mvp", PERCEPTION_MVP_SQL),
  defineMigration(21, "0021_gateway_target_directory", GATEWAY_TARGET_DIRECTORY_SQL),
  defineMigration(22, "0022_enterprise_foundation", ENTERPRISE_FOUNDATION_SQL),
  defineMigration(23, "0023_marketplace_governance", MARKETPLACE_GOVERNANCE_SQL),
  defineMigration(24, "0024_tenant_data_namespace_foundation", TENANT_DATA_NAMESPACE_FOUNDATION_SQL, { appliedSql: MIGRATION_0024_APPLIED_SQL }),
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
  defineMigration(43, "0043_harness_runs", HARNESS_RUNS_SQL),
  defineMigration(44, "0044_runtime_physical_schema_foundation", RUNTIME_PHYSICAL_SCHEMA_FOUNDATION_SQL, { appliedSql: MIGRATION_0044_APPLIED_SQL }),
  defineMigration(45, "0045_worker_snapshot_version", WORKER_SNAPSHOT_VERSION_SQL, { appliedSql: MIGRATION_0045_APPLIED_SQL }),
  defineMigration(46, "0046_config_rollout_persistence", CONFIG_ROLLOUT_PERSISTENCE_SQL),
] as const;

/**
 * Gets the latest migration version number.
 * @returns The latest version, or 0 if no migrations exist
 */
export function getLatestSqliteMigrationVersion(): number {
  return SQLITE_MIGRATIONS.at(-1)?.version ?? 0;
}
