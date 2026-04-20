/**
 * Stable backup/restore rehearsal: validates SQLite backup/restore roundtrip integrity.
 *
 * @documentation
 * - Architecture: docs_zh/automatic_agent_patform_arthitecture_design.md
 * - Disaster recovery: docs_zh/contracts/remote_coordination_and_disaster_recovery_contract.md
 * - Startup & recovery drills: docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md
 * - Terminology: docs_zh/governance/glossary_and_terminology.md
 */

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { buildRuntimeVersionSnapshot, type RuntimeVersionSnapshot } from "../../control-plane/incident-control/runtime-version-snapshot.js";
import { runSingleTaskExecution } from "../../execution/execution-engine/single-task-execution.js";
import { SqliteDatabase } from "../../state-evidence/truth/sqlite-database.js";
import {
  SqliteReliabilityService,
  type SqliteBackupReport,
  type SqliteRestoreReport,
} from "../../state-evidence/truth/sqlite/sqlite-reliability-service.js";

export interface StableBackupRestoreRehearsalOptions {
  outputDir: string;
}

export interface StableBackupRestoreScenarioResult {
  scenarioId: "sqlite_backup_restore_roundtrip";
  passed: boolean;
  durationMs: number;
  summary: string;
  details: Record<string, unknown>;
}

export interface StableDisasterRecoveryTarget {
  targetId: "runtime_sqlite" | "runtime_backup" | "restored_runtime";
  description: string;
  validationChecks: string[];
}

export interface StableDisasterRecoveryPlaybook {
  generatedAt: string;
  recoveryOwner: string;
  reportPath: string;
  playbookPath: string;
  targetRpo: string;
  targetRto: string;
  runtimeVersionSnapshot: RuntimeVersionSnapshot;
  prechecks: string[];
  restoreProcedure: string[];
  healthValidation: string[];
  auditRequirements: string[];
  targets: StableDisasterRecoveryTarget[];
}

export interface StableBackupRestoreRehearsalReport {
  startedAt: string;
  finishedAt: string;
  outputDir: string;
  artifacts: {
    reportPath: string;
    playbookPath: string;
  };
  playbook: StableDisasterRecoveryPlaybook;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  scenarios: StableBackupRestoreScenarioResult[];
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function buildBackupRestoreRuntimeVersionSnapshot(outputDir: string): RuntimeVersionSnapshot {
  const dbPath = join(outputDir, "stable-disaster-recovery-playbook.db");
  rmSync(dbPath, { force: true });
  rmSync(`${dbPath}-wal`, { force: true });
  rmSync(`${dbPath}-shm`, { force: true });

  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const snapshot = buildRuntimeVersionSnapshot(db.getSchemaStatus());
  db.close();

  rmSync(dbPath, { force: true });
  rmSync(`${dbPath}-wal`, { force: true });
  rmSync(`${dbPath}-shm`, { force: true });
  return snapshot;
}

export function buildStableDisasterRecoveryPlaybook(input: {
  outputDir: string;
  reportPath: string;
  playbookPath: string;
}): StableDisasterRecoveryPlaybook {
  const runtimeVersionSnapshot = buildBackupRestoreRuntimeVersionSnapshot(input.outputDir);

  return {
    generatedAt: new Date().toISOString(),
    recoveryOwner: "runtime_reliability_oncall",
    reportPath: input.reportPath,
    playbookPath: input.playbookPath,
    targetRpo: "15m",
    targetRto: "30m",
    runtimeVersionSnapshot,
    prechecks: [
      "confirm the source backup artifact is present and integrity check passed",
      "capture the current application, config, prompt, and schema snapshot before restoring",
      "freeze new writes to the affected runtime while the restore window is active",
      "confirm a clean restore target path is available before copying the backup",
    ],
    restoreProcedure: [
      "checkpoint the active SQLite WAL and create a validated backup artifact",
      "copy the backup into the restore target and reopen the restored runtime",
      "verify integrity, schema status, and table counts before resuming traffic",
      "promote the restored runtime only after health and operator validation complete",
    ],
    healthValidation: [
      "confirm source and restored integrity checks both report ok",
      "confirm schema version is current on the restored runtime",
      "confirm task, workflow, execution, session, and event table counts match the source snapshot",
      "confirm the restored runtime can reopen under the current application and config version snapshot",
    ],
    auditRequirements: [
      "record incident id, backup path, restore path, and operator identity",
      "persist the disaster recovery report and playbook artifacts",
      "capture before and after runtime version snapshots and schema status",
      "retain integrity check output and count-comparison evidence for the restored runtime",
    ],
    targets: [
      {
        targetId: "runtime_sqlite",
        description: "authoritative runtime SQLite database before backup",
        validationChecks: ["integrity_ok", "schema_current", "checkpoint_completed"],
      },
      {
        targetId: "runtime_backup",
        description: "backup artifact produced from the authoritative runtime database",
        validationChecks: ["backup_integrity_ok", "backup_size_recorded"],
      },
      {
        targetId: "restored_runtime",
        description: "restored runtime promoted from the validated backup artifact",
        validationChecks: ["restore_integrity_ok", "table_counts_match", "runtime_reopenable"],
      },
    ],
  };
}

function loadTableCounts(db: SqliteDatabase): Record<string, number> {
  const tables = ["tasks", "workflow_state", "executions", "sessions", "workflow_step_outputs", "events", "event_consumer_acks"];
  return Object.fromEntries(
    tables.map((table) => {
      const row = db.connection.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count?: number } | undefined;
      return [table, Number(row?.count ?? 0)];
    }),
  );
}

async function measureScenario(
  run: () => Promise<Omit<StableBackupRestoreScenarioResult, "scenarioId" | "durationMs">>,
): Promise<StableBackupRestoreScenarioResult> {
  const started = performance.now();
  const result = await run();
  return {
    scenarioId: "sqlite_backup_restore_roundtrip",
    durationMs: Math.round((performance.now() - started) * 100) / 100,
    ...result,
  };
}

async function runSqliteBackupRestoreRoundtrip(
  outputDir: string,
): Promise<StableBackupRestoreScenarioResult> {
  return measureScenario(async () => {
    const sourcePath = join(outputDir, "runtime.db");
    const backupPath = join(outputDir, "backup", "runtime.backup.db");
    const restorePath = join(outputDir, "restore", "runtime.restored.db");
    rmSync(sourcePath, { force: true });
    rmSync(backupPath, { force: true });
    rmSync(restorePath, { force: true });

    await runSingleTaskExecution({
      dbPath: sourcePath,
      title: "Stable backup restore rehearsal",
      request: "Validate backup and restore roundtrip.",
    });

    const sourceDb = new SqliteDatabase(sourcePath);
    const reliability = new SqliteReliabilityService(sourceDb);
    const backup: SqliteBackupReport = reliability.createBackup(backupPath);
    const sourceCounts = loadTableCounts(sourceDb);
    sourceDb.close();

    const restore: SqliteRestoreReport = reliability.restoreBackup(backupPath, restorePath);
    const restoreDb = new SqliteDatabase(restorePath);
    const restoreCounts = loadTableCounts(restoreDb);
    restoreDb.close();

    const countsMatch = JSON.stringify(sourceCounts) === JSON.stringify(restoreCounts);

    return {
      passed: backup.valid && restore.valid && countsMatch,
      summary: "sqlite backup can be restored into a structurally identical runtime snapshot",
      details: {
        backup,
        restore,
        sourceCounts,
        restoreCounts,
        countsMatch,
      },
    };
  });
}

export async function runStableBackupRestoreRehearsal(
  options: StableBackupRestoreRehearsalOptions,
): Promise<StableBackupRestoreRehearsalReport> {
  mkdirSync(options.outputDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const reportPath = join(options.outputDir, "stable-backup-restore-report.json");
  const playbookPath = join(options.outputDir, "stable-disaster-recovery-playbook.json");
  const scenarios = [await runSqliteBackupRestoreRoundtrip(options.outputDir)];
  const playbook = buildStableDisasterRecoveryPlaybook({
    outputDir: options.outputDir,
    reportPath,
    playbookPath,
  });
  writeJson(playbookPath, playbook);

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    outputDir: options.outputDir,
    artifacts: {
      reportPath,
      playbookPath,
    },
    playbook,
    totalScenarios: scenarios.length,
    passedScenarios: scenarios.filter((scenario) => scenario.passed).length,
    failedScenarios: scenarios.filter((scenario) => !scenario.passed).length,
    scenarios,
  };
}

export function writeStableBackupRestoreRehearsalReport(
  outputFile: string,
  report: StableBackupRestoreRehearsalReport,
): void {
  writeJson(outputFile, report);
}
