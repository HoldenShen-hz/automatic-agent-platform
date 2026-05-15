import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import type { SqliteMigrationDefinition } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-plan.js";
import { SQLITE_MIGRATIONS } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-plan.js";
import { PHASE_1A_SCHEMA_SQL } from "../../../../../src/platform/five-plane-state-evidence/truth/sql/phase1a-schema.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("sqlite database records migration ledger entries and stays idempotent across repeated migrate calls", () => {
  const workspace = createTempWorkspace("aa-sqlite-migrations-");
  const dbPath = join(workspace, "migration-ledger.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.migrate();

    const applied = db.listAppliedMigrations();
    const schemaStatus = db.getSchemaStatus();
    db.close();

    assert.equal(applied.length, SQLITE_MIGRATIONS.length);
    assert.equal(applied[0]?.version, 1);
    assert.equal(applied[0]?.name, "0001_phase1a_init");
    assert.ok(applied[0]?.checksum.length === 64);
    assert.equal(applied[1]?.version, 2);
    assert.equal(applied[1]?.name, "0002_worker_telemetry_heartbeat");
    assert.equal(applied[2]?.version, 3);
    assert.equal(applied[2]?.name, "0003_worker_restart_semantics");
    assert.equal(applied[3]?.version, 4);
    assert.equal(applied[3]?.name, "0004_agent_execution_records");
    assert.equal(applied[4]?.version, 5);
    assert.equal(applied[4]?.name, "0005_remote_fallback_routing");
    assert.equal(applied[5]?.version, 6);
    assert.equal(applied[5]?.name, "0006_worker_isolation_routing");
    assert.equal(applied[6]?.version, 7);
    assert.equal(applied[6]?.name, "0007_message_parts");
    assert.equal(applied[7]?.version, 8);
    assert.equal(applied[7]?.name, "0008_remote_repo_version_routing");
    assert.equal(applied[8]?.version, 9);
    assert.equal(applied[8]?.name, "0009_remote_session_telemetry");
    assert.equal(applied[9]?.version, 10);
    assert.equal(applied[9]?.name, "0010_remote_log_aggregation");
    assert.equal(applied[10]?.version, 11);
    assert.equal(applied[10]?.name, "0011_trusted_remote_worker_registration");
    assert.equal(applied[11]?.version, 12);
    assert.equal(applied[11]?.name, "0012_event_session_id");
    assert.equal(applied[12]?.version, 13);
    assert.equal(applied[12]?.name, "0013_remote_workspace_sync_telemetry");
    assert.equal(applied[13]?.version, 14);
    assert.equal(applied[13]?.name, "0014_tier1_audit_event_integrity");
    assert.equal(applied[14]?.version, 15);
    assert.equal(applied[14]?.name, "0015_memory_scope_and_quality");
    assert.equal(applied[15]?.version, 16);
    assert.equal(applied[15]?.name, "0016_evolution_mvp");
    assert.equal(applied[16]?.version, 17);
    assert.equal(applied[16]?.name, "0017_experience_cache");
    assert.equal(applied[17]?.version, 18);
    assert.equal(applied[17]?.name, "0018_pmf_validation_reports");
    assert.equal(applied[18]?.version, 19);
    assert.equal(applied[18]?.name, "0019_billing_foundation");
    assert.equal(applied[19]?.version, 20);
    assert.equal(applied[19]?.name, "0020_perception_mvp");
    assert.equal(applied[20]?.version, 21);
    assert.equal(applied[20]?.name, "0021_gateway_target_directory");
    assert.equal(applied[21]?.version, 22);
    assert.equal(applied[21]?.name, "0022_enterprise_foundation");
    assert.equal(applied[22]?.version, 23);
    assert.equal(applied[22]?.name, "0023_marketplace_governance");
    assert.equal(applied[23]?.version, 24);
    assert.equal(applied[23]?.name, "0024_tenant_data_namespace_foundation");
    assert.equal(applied[24]?.version, 25);
    assert.equal(applied[24]?.name, "0025_data_plane_flow_foundation");
    assert.equal(applied[25]?.version, 26);
    assert.equal(applied[25]?.name, "0026_secret_management_foundation");
    assert.equal(applied[26]?.version, 27);
    assert.equal(applied[26]?.name, "0027_release_deployment_ledger");
    assert.equal(applied[27]?.version, 28);
    assert.equal(applied[27]?.name, "0028_secret_leases");
    assert.equal(applied[28]?.version, 29);
    assert.equal(applied[28]?.name, "0029_release_execution_reports");
    assert.equal(applied[29]?.version, 30);
    assert.equal(applied[29]?.name, "0030_workflow_dispatch_receipt_audit");
    assert.equal(applied[30]?.version, 31);
    assert.equal(applied[30]?.name, "0031_llm_eval_and_governance_foundation");
    assert.equal(applied[31]?.version, 32);
    assert.equal(applied[31]?.name, "0032_enterprise_governance_foundation");
    assert.equal(applied[32]?.version, 33);
    assert.equal(applied[32]?.name, "0033_control_plane_load_balancing_foundation");
    assert.equal(applied[33]?.version, 34);
    assert.equal(applied[33]?.name, "0034_skill_governance_foundation");
    assert.equal(applied[34]?.version, 35);
    assert.equal(applied[34]?.name, "0035_task_tenant_scope");
    assert.equal(applied[35]?.version, 36);
    assert.equal(applied[35]?.name, "0036_billing_collection_foundation");
    assert.equal(applied[36]?.version, 37);
    assert.equal(applied[36]?.name, "0037_product_governance_tenant_scope");
    assert.ok(SQLITE_MIGRATIONS.every((migration) => typeof migration.downSql === "string" && migration.downSql.length > 0));
    assert.equal(schemaStatus.currentVersion, SQLITE_MIGRATIONS.at(-1)?.version ?? 0);
    assert.equal(schemaStatus.expectedVersion, SQLITE_MIGRATIONS.at(-1)?.version ?? 0);
    assert.equal(schemaStatus.upToDate, true);
    assert.deepEqual(schemaStatus.pendingVersions, []);
    assert.deepEqual(schemaStatus.checksumMismatches, []);
  } finally {
    cleanupPath(workspace);
  }
});

test("sqlite database reports missing migration ledger entries as schema lag", () => {
  const workspace = createTempWorkspace("aa-sqlite-migrations-");
  const dbPath = join(workspace, "migration-lag.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.connection.prepare(`DELETE FROM schema_migrations WHERE version = ?`).run(1);

    const schemaStatus = db.getSchemaStatus();

    assert.equal(schemaStatus.upToDate, false);
    assert.deepEqual(schemaStatus.pendingVersions, [1]);
    assert.throws(() => db.assertSchemaCurrent(), /sqlite\.schema_outdated:1/);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("sqlite database can reconcile column migrations when columns already exist but the ledger row is missing", () => {
  const workspace = createTempWorkspace("aa-sqlite-migrations-");
  const dbPath = join(workspace, "migration-column-compat.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    db.connection.prepare(`DELETE FROM schema_migrations WHERE version IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15);

    db.migrate();

    const schemaStatus = db.getSchemaStatus();
    const applied = db.listAppliedMigrations();
    db.close();

    assert.equal(schemaStatus.upToDate, true);
    assert.equal(applied.length, SQLITE_MIGRATIONS.length);
    // Verify migrations 5-15 are present after reconciliation
    const appliedVersions = new Set(applied.map((m) => m.version));
    for (let v = 5; v <= 15; v++) {
      assert.ok(appliedVersions.has(v), `Migration ${v} should be present after reconciliation`);
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("sqlite database accepts the legacy phase1a checksum after runtime PRAGMAs move out of migration SQL", () => {
  const workspace = createTempWorkspace("aa-sqlite-migrations-");
  const dbPath = join(workspace, "migration-legacy-checksum.db");

  try {
    const legacyPlan: readonly SqliteMigrationDefinition[] = [
      {
        ...SQLITE_MIGRATIONS[0]!,
        sql: `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

${PHASE_1A_SCHEMA_SQL}`.trim() + "\n",
      },
      ...SQLITE_MIGRATIONS.slice(1),
    ].map((migration, index) =>
      index === 0
        ? {
            ...migration,
            checksum: SQLITE_MIGRATIONS[0]!.compatibleChecksums?.[0] ?? migration.checksum,
          }
        : migration,
    );

    const legacyDb = new SqliteDatabase(dbPath, {
      migrationPlan: legacyPlan,
    });
    legacyDb.migrate();
    legacyDb.close();

    const currentDb = new SqliteDatabase(dbPath);
    currentDb.migrate();

    const schemaStatus = currentDb.getSchemaStatus();
    const applied = currentDb.listAppliedMigrations();
    currentDb.close();

    assert.equal(schemaStatus.upToDate, true);
    assert.equal(schemaStatus.checksumMismatches.length, 0);
    assert.equal(applied[0]?.version, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("sqlite database automatically upgrades a legacy schema to the latest migration plan", () => {
  const workspace = createTempWorkspace("aa-sqlite-migrations-");
  const dbPath = join(workspace, "migration-auto-upgrade.db");

  try {
    const legacyPlan = SQLITE_MIGRATIONS.slice(0, 4);
    const legacyDb = new SqliteDatabase(dbPath, {
      migrationPlan: legacyPlan,
    });
    legacyDb.migrate();
    legacyDb.close();

    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const applied = db.listAppliedMigrations();
    const schemaStatus = db.getSchemaStatus();
    db.close();

    assert.equal(applied.length, SQLITE_MIGRATIONS.length);
    assert.equal(schemaStatus.currentVersion, SQLITE_MIGRATIONS.at(-1)?.version ?? 0);
    assert.equal(schemaStatus.expectedVersion, SQLITE_MIGRATIONS.at(-1)?.version ?? 0);
    assert.equal(schemaStatus.upToDate, true);
  } finally {
    cleanupPath(workspace);
  }
});

test("sqlite database rolls back a failed migration without recording partial ledger state and can recover on the next run", () => {
  const workspace = createTempWorkspace("aa-sqlite-migrations-");
  const dbPath = join(workspace, "migration-rollback.db");

  try {
    const badMigrationPlan: readonly SqliteMigrationDefinition[] = [
      {
        version: 1,
        name: "0001_create_runtime_state",
        sql: `
CREATE TABLE runtime_state (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
`,
        checksum: "test-checksum-1",
      },
      {
        version: 2,
        name: "0002_partial_failure",
        sql: `
ALTER TABLE runtime_state ADD COLUMN started_at TEXT NULL;
ALTER TABLE missing_runtime_state ADD COLUMN impossible TEXT NULL;
`,
        checksum: "test-checksum-2-bad",
      },
    ];
    const repairedMigrationPlan: readonly SqliteMigrationDefinition[] = [
      badMigrationPlan[0]!,
      {
        version: 2,
        name: "0002_partial_failure",
        sql: `
ALTER TABLE runtime_state ADD COLUMN started_at TEXT NULL;
`,
        checksum: "test-checksum-2-good",
      },
    ];

    const failingDb = new SqliteDatabase(dbPath, {
      migrationPlan: badMigrationPlan,
    });

    assert.throws(() => failingDb.migrate(), /missing_runtime_state|no such table/i);
    assert.deepEqual(failingDb.listAppliedMigrations().map((record) => record.version), [1]);
    const rollbackColumns = failingDb.connection.prepare("PRAGMA table_info(runtime_state);").all() as Array<Record<string, unknown>>;
    assert.equal(rollbackColumns.some((column) => String(column.name) === "started_at"), false);
    failingDb.close();

    const recoveredDb = new SqliteDatabase(dbPath, {
      migrationPlan: repairedMigrationPlan,
    });
    recoveredDb.migrate();

    assert.deepEqual(recoveredDb.listAppliedMigrations().map((record) => record.version), [1, 2]);
    const recoveredColumns = recoveredDb.connection.prepare("PRAGMA table_info(runtime_state);").all() as Array<Record<string, unknown>>;
    assert.equal(recoveredColumns.some((column) => String(column.name) === "started_at"), true);
    assert.equal(recoveredDb.getSchemaStatus().upToDate, true);
    recoveredDb.close();
  } finally {
    cleanupPath(workspace);
  }
});
