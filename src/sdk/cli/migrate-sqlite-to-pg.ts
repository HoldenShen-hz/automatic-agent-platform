import { basename } from "node:path";

import { ValidationError } from "../../platform/contracts/errors.js";
import { SqliteDatabase } from "../../platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { PgDatabase } from "../../platform/five-plane-state-evidence/truth/postgres/pg-database.js";

const TABLES = [
  "action_proposals",
  "agent_execution_records",
  "analytics_facts",
  "approvals",
  "artifacts",
  "archive_bundles",
  "artifact_version_lock_sets",
  "billing_accounts",
  "billing_invoices",
  "billing_payment_sessions",
  "budget_alerts",
  "budget_ledgers",
  "budget_reservations",
  "budget_settlements",
  "compaction_records",
  "config_rollback_points",
  "config_rollouts",
  "config_version_snapshots",
  "confirmed_task_specs",
  "coordinator_instance_snapshots",
  "cost_event_wal",
  "cost_events",
  "cost_reports",
  "data_namespaces",
  "data_movement_jobs",
  "dead_letters",
  "decision_input_bundles",
  "delegation_events",
  "delegations",
  "deployment_bindings",
  "deployment_execution_reports",
  "dlq_records",
  "enterprise_capability_reports",
  "enterprise_governance_reports",
  "entitlement_decisions",
  "environment_promotion_history",
  "environment_readiness_records",
  "eval_case_results",
  "eval_runs",
  "eval_suites",
  "event_consumer_acks",
  "event_dead_letters",
  "events",
  "evolution_logs",
  "evolution_policies",
  "evolution_proposals",
  "execution_leases",
  "executions",
  "execution_prechecks",
  "execution_tickets",
  "experience_cache",
  "extension_packages",
  "file_locks",
  "gateway_targets",
  "governance_gate_events",
  "governance_releases",
  "graph_patches",
  "harness_runs",
  "harness_decisions",
  "heartbeat_snapshots",
  "human_responsibility_records",
  "incident_handoff_records",
  "intel_briefs",
  "intel_items",
  "lease_audits",
  "ledger_entries",
  "marketplace_governance_reports",
  "marketplace_listings",
  "marketplace_publications",
  "marketplace_reviews",
  "memories",
  "messages",
  "mission_context_snapshots",
  "mission_event_sequences",
  "mission_memberships",
  "mission_records",
  "node_attempt_receipts",
  "node_attempts",
  "node_runs",
  "operator_actions",
  "organization_memberships",
  "organizations",
  "outbox",
  "pack_downloads",
  "pack_reviews",
  "perception_sources",
  "plan_graph_bundles",
  "pmf_validation_reports",
  "prompt_ab_tests",
  "prompt_bundles",
  "prompt_versions",
  "quota_counters",
  "release_bundles",
  "release_execution_reports",
  "remote_log_entries",
  "replay_datasets",
  "request_envelopes",
  "run_version_locks",
  "runtime_audit_refs",
  "runtime_event_log",
  "runtime_outbox",
  "schema_migrations",
  "secret_leases",
  "secret_registry",
  "secret_rotation_events",
  "secret_usage_audits",
  "secret_versions",
  "sessions",
  "session_events",
  "session_summaries",
  "side_effect_records",
  "skill_execution_policies",
  "skill_registry",
  "tasks",
  "takeover_sessions",
  "task_drafts",
  "tenants",
  "tenant_billing",
  "tenant_quotas",
  "token_usage_daily",
  "tool_result_files",
  "usage_events",
  "worker_registration_challenges",
  "worker_snapshots",
  "workflow_state",
  "workflow_step_outputs",
  "workspace_memberships",
  "workspaces",
] as const;

export interface MigrateSqliteToPgOptions {
  sqlitePath: string;
  pgDsn: string;
  dryRun: boolean;
}

const MIGRATE_SQLITE_TO_PG_USAGE = "usage: migrate-sqlite-to-pg --sqlite <path>|--sqlite-path <path> --pg-dsn <dsn> [--dry-run] [--help]";

export function buildMigrateSqliteToPgUsage(): string {
  return MIGRATE_SQLITE_TO_PG_USAGE;
}

export function parseMigrateSqliteToPgArgs(argv: string[]): MigrateSqliteToPgOptions {
  if (argv.includes("--help") || argv.includes("-h")) {
    throw new ValidationError("migrate_sqlite_to_pg.usage", buildMigrateSqliteToPgUsage());
  }
  let sqlitePath = "";
  let pgDsn = "";
  let dryRun = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--sqlite" || arg === "--sqlite-path") {
      sqlitePath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--pg-dsn") {
      pgDsn = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
    }
  }
  if (!sqlitePath || !pgDsn) {
    throw new ValidationError(
      "migrate_sqlite_to_pg.usage",
      buildMigrateSqliteToPgUsage(),
    );
  }
  return { sqlitePath, pgDsn, dryRun };
}

const VALID_TABLES = new Set(TABLES);

export function validateTableName(table: string): void {
  if (!VALID_TABLES.has(table as (typeof TABLES)[number])) {
    throw new ValidationError("migrate_sqlite_to_pg.invalid_table", `Invalid table name: ${table}`);
  }
}

export function redactDsnCredentials(dsn: string): string {
  return dsn.replace(/\/\/([^@/]+)@/u, "//****:****@");
}

export function planSqliteToPgMigration(sqlite: SqliteDatabase): Array<{ table: string; rowCount: number }> {
  return TABLES.map((table) => {
    validateTableName(table);
    const schemaRow = sqlite.connection.prepare(
      "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = ?",
    ).get(table) as { count?: number } | undefined;
    if ((schemaRow?.count ?? 0) === 0) {
      throw new ValidationError(
        "migrate_sqlite_to_pg.missing_source_table",
        `migrate_sqlite_to_pg.missing_source_table:${table}`,
      );
    }
    const row = sqlite.connection.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count?: number } | undefined;
    return { table, rowCount: row?.count ?? 0 };
  });
}

export async function migrateSqliteToPg(options: MigrateSqliteToPgOptions): Promise<Array<{ table: string; migrated: number }>> {
  const sqlite = new SqliteDatabase(options.sqlitePath);
  const plan = planSqliteToPgMigration(sqlite);
  if (options.dryRun) {
    sqlite.close();
    return plan.map(({ table, rowCount }) => ({ table, migrated: rowCount }));
  }

  const pg = await PgDatabase.open({ dsn: options.pgDsn });
  try {
    await pg.migrate();
    const migrated: Array<{ table: string; migrated: number }> = [];
    for (const { table, rowCount } of plan) {
      validateTableName(table);
      if (rowCount === 0) {
        migrated.push({ table, migrated: 0 });
        continue;
      }
      const rows = sqlite.connection.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, unknown>>;
      if (rows.length === 0) {
        migrated.push({ table, migrated: 0 });
        continue;
      }
      const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].sort();
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
      const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
      let count = 0;
      await pg.transaction(async (conn) => {
        for (const row of rows) {
          await conn.execute(sql, ...columns.map((column) => row[column]));
          count += 1;
        }
      });
      migrated.push({ table, migrated: count });
    }
    return migrated;
  } finally {
    sqlite.close();
    await pg.close();
  }
}

async function main(): Promise<void> {
  const options = parseMigrateSqliteToPgArgs(process.argv.slice(2));
  const result = await migrateSqliteToPg(options);
  // R31-33 FIX: Mask PG DSN in output to prevent credential leakage
  const maskedDsn = redactDsnCredentials(options.pgDsn);
  process.stdout.write(`${JSON.stringify({
    sqlite: basename(options.sqlitePath),
    pgDsn: maskedDsn,
    dryRun: options.dryRun,
    tables: result,
  }, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
