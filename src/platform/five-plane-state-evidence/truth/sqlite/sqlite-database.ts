/**
 * SQLite authoritative storage backend.
 * Contract reference: docs_zh/contracts/runtime_repository_and_migration_contract.md
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { StorageError, ValidationError } from "../../../contracts/errors.js";
import {
  SQLITE_MIGRATIONS,
  SQLITE_MIGRATION_LEDGER_SQL,
  type SqliteMigrationDefinition,
} from "./sqlite-migration-plan.js";
import { queryAll } from "./query-helper.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";

const sqliteDbLogger = new StructuredLogger({ retentionLimit: 50 });

/**
 * Configuration options for SqliteDatabase.
 */
export interface SqliteDatabaseOptions {
  /** Custom migration plan (defaults to SQLITE_MIGRATIONS) */
  migrationPlan?: readonly SqliteMigrationDefinition[];
  /** Busy timeout in milliseconds (defaults to 5000) */
  busyTimeoutMs?: number;
}

/**
 * AuthoritativeSqlDatabase interface that defines the contract for
 * SQL database access used by AuthoritativeTaskStore and other components.
 */
export interface AuthoritativeSqlDatabase {
  readonly filePath: string;
  readonly backendType: "sqlite" | "postgres";
  readonly connection: Pick<DatabaseSync, "exec" | "prepare">;
  /** Runs pending migrations */
  migrate(): void;
  /** Gets current schema status */
  getSchemaStatus(): SqliteSchemaStatus;
  /** Asserts schema is current, throws if not */
  assertSchemaCurrent(): void;
  /** Runs integrity check */
  integrityCheck(): string[];
  /** Checks database writability */
  healthCheck(): Promise<boolean>;
  /** Closes the underlying database connection */
  close(): void;
  /** Executes work within a write transaction */
  transaction<T>(work: () => T): T;
  /** Executes work within a read transaction */
  readTransaction<T>(work: () => T): T;
}

/**
 * Error thrown when SQLite write operations encounter contention.
 * This happens when the database is locked by another writer.
 */
export class SqliteWriteContentionError extends StorageError {
  public readonly sqliteCode: string | null;

  public constructor(
    public readonly filePath: string,
    cause?: unknown,
  ) {
    super("sqlite.write_contention", `sqlite.write_contention:${filePath}`, {
      retryable: true,
      statusCode: 503,
      details: { filePath },
      ...(cause instanceof Error ? { cause } : {}),
    });
    this.name = "SqliteWriteContentionError";
    this.sqliteCode =
      cause != null && typeof cause === "object" && "code" in cause && typeof cause.code === "string"
        ? cause.code
        : null;
  }
}

/**
 * Type guard to check if an error is a SqliteWriteContentionError.
 */
export function isSqliteWriteContentionError(error: unknown): error is SqliteWriteContentionError {
  return error instanceof SqliteWriteContentionError;
}

/**
 * Record of an applied migration in the schema_migrations table.
 */
export interface AppliedSqliteMigrationRecord {
  version: number;
  name: string;
  checksum: string;
  appliedAt: string;
}

/**
 * Status of the SQLite schema including version info and any pending or mismatched migrations.
 */
export interface SqliteSchemaStatus {
  currentVersion: number;
  expectedVersion: number;
  upToDate: boolean;
  pendingVersions: number[];
  checksumMismatches: Array<{
    version: number;
    name: string;
    expectedChecksum: string;
    actualChecksum: string;
  }>;
}

/**
 * SQLite database wrapper that provides migration management and transaction support.
 *
 * This class:
 * - Manages SQLite database connections with WAL mode
 * - Handles schema migrations with checksum validation
 * - Provides transaction support with savepoints
 * - Detects and reports write contention errors
 */
export class SqliteDatabase implements AuthoritativeSqlDatabase {
  public readonly connection: DatabaseSync;
  private readonly migrationPlan: readonly SqliteMigrationDefinition[];
  private readonly busyTimeoutMs: number;
  private transactionDepth = 0;
  private migrationLedgerEnsured = false;

  public constructor(public readonly filePath: string, options: SqliteDatabaseOptions = {}) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.connection = new DatabaseSync(filePath);
    this.migrationPlan = options.migrationPlan ?? SQLITE_MIGRATIONS;
    this.busyTimeoutMs = Math.max(0, Math.trunc(options.busyTimeoutMs ?? 5000));
    // Enable foreign key enforcement
    this.connection.exec("PRAGMA foreign_keys = ON;");
    // Enable WAL mode for better concurrency
    this.connection.exec("PRAGMA journal_mode = WAL;");
    // Use NORMAL durability so WAL checkpoints remain crash-safe without the
    // inconsistency of backend-specific default synchronous policies.
    this.connection.exec("PRAGMA synchronous = NORMAL;");
    // Set busy timeout for write contention handling
    this.connection.exec(`PRAGMA busy_timeout = ${this.busyTimeoutMs};`);
  }

  /**
   * Runs all pending migrations to bring the schema up to date.
   * Checksums are validated to ensure migration integrity.
   * @throws Error if a checksum mismatch is detected
   */
  public migrate(): void {
    this.ensureMigrationLedgerTable();
    const applied = new Map(this.listAppliedMigrations().map((record) => [record.version, record]));

    for (const migration of this.migrationPlan) {
      const existing = applied.get(migration.version);
      if (!existing) {
        this.applyMigration(migration);
        continue;
      }

      if (!this.isMigrationChecksumCompatible(existing.checksum, migration)) {
        throw new StorageError(
          `sqlite.migration_checksum_mismatch:${migration.version}`,
          `sqlite.migration_checksum_mismatch:${migration.version}`,
          {
            retryable: false,
            details: { version: migration.version },
          },
        );
      }
    }
  }

  /**
   * Lists all applied migrations in version order.
   * @returns Array of applied migration records
   */
  public listAppliedMigrations(): AppliedSqliteMigrationRecord[] {
    this.ensureMigrationLedgerTable();

    return queryAll<AppliedSqliteMigrationRecord>(
      this.connection,
      `SELECT
        version,
        name,
        checksum,
        applied_at AS appliedAt
       FROM schema_migrations
       ORDER BY version ASC`,
    );
  }

  /**
   * Gets the current schema status including pending migrations and checksum mismatches.
   * @returns The schema status object
   */
  public getSchemaStatus(): SqliteSchemaStatus {
    const appliedRecords = this.listAppliedMigrations();
    const applied = new Map(appliedRecords.map((record) => [record.version, record]));
    const pendingVersions: number[] = [];
    const checksumMismatches: SqliteSchemaStatus["checksumMismatches"] = [];

    for (const migration of this.migrationPlan) {
      const existing = applied.get(migration.version);
      if (!existing) {
        pendingVersions.push(migration.version);
        continue;
      }

      if (!this.isMigrationChecksumCompatible(existing.checksum, migration)) {
        checksumMismatches.push({
          version: migration.version,
          name: migration.name,
          expectedChecksum: migration.checksum,
          actualChecksum: existing.checksum,
        });
      }
    }

    const currentVersion = Math.max(0, ...appliedRecords.map((record) => record.version));
    return {
      currentVersion,
      expectedVersion: this.migrationPlan.at(-1)?.version ?? 0,
      upToDate: pendingVersions.length === 0 && checksumMismatches.length === 0,
      pendingVersions,
      checksumMismatches,
    };
  }

  /**
   * Asserts that the schema is at the current version.
   * @throws Error if schema is outdated or has checksum mismatches
   */
  public assertSchemaCurrent(): void {
    const status = this.getSchemaStatus();
    if (status.upToDate) {
      return;
    }

    if (status.checksumMismatches.length > 0) {
      throw new StorageError(
        `sqlite.migration_checksum_mismatch:${status.checksumMismatches.map((item) => item.version).join(",")}`,
        `sqlite.migration_checksum_mismatch:${status.checksumMismatches.map((item) => item.version).join(",")}`,
        {
          retryable: false,
          details: { versions: status.checksumMismatches.map((item) => item.version) },
        },
      );
    }

    throw new StorageError(`sqlite.schema_outdated:${status.pendingVersions.join(",")}`, `sqlite.schema_outdated:${status.pendingVersions.join(",")}`, {
      retryable: false,
      details: { pendingVersions: status.pendingVersions },
    });
  }

  /**
   * Runs an integrity check on the SQLite database.
   * @returns Array of integrity check results (empty if healthy)
   */
  public integrityCheck(): string[] {
    return this.connection
      .prepare("PRAGMA integrity_check;")
      .all()
      .map((row) => String((row as Record<string, unknown>).integrity_check));
  }

  /**
   * Checkpoints the WAL (Write-Ahead Log) file, truncating it to zero.
   * This ensures all pending writes are flushed to the main database file.
   * @returns Object containing checkpoint results
   */
  public checkpointWal(): {
    mode: "TRUNCATE";
    busy: number;
    logFrames: number;
    checkpointedFrames: number;
  } {
    const row = this.connection.prepare("PRAGMA wal_checkpoint(TRUNCATE);").get() as
      | Record<string, unknown>
      | undefined;
    const values = Object.values(row ?? {});

    return {
      mode: "TRUNCATE",
      busy: Number(values[0] ?? 0),
      logFrames: Number(values[1] ?? 0),
      checkpointedFrames: Number(values[2] ?? 0),
    };
  }

  /**
   * Executes a function within a database transaction.
   * Automatically commits on success or rolls back on error.
   * @param work - The function to execute within the transaction
   * @returns The result of the work function
   */
  public transaction<T>(work: () => T): T {
    return this.runInTransaction("write", work);
  }

  /**
   * Executes a function within a consistent read transaction.
   * When already inside a write transaction, the current authoritative view is reused.
   * @param work - The function to execute within the read transaction
   * @returns The result of the work function
   */
  public readTransaction<T>(work: () => T): T {
    return this.runInTransaction("read", work);
  }

/**
   * Storage backend type identifier.
   * Used by HealthService to select the appropriate health probe.
   */
  public readonly backendType = "sqlite" as const;

  /**
   * Checks database writability by creating/deleting a probe table.
   * @returns true if the database is writable
   */
  public async healthCheck(): Promise<boolean> {
    try {
      this.transaction(() => {
        this.connection.exec("CREATE TEMP TABLE IF NOT EXISTS __health_probe (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL);");
        this.connection.exec("INSERT INTO __health_probe(created_at) VALUES (CURRENT_TIMESTAMP);");
        this.connection.exec("DELETE FROM __health_probe;");
        this.connection.exec("DROP TABLE IF EXISTS __health_probe;");
      });
      return true;
    } catch (error) {
      sqliteDbLogger.log({
        level: "warn",
        message: "SQLite health check failed",
        data: { filePath: this.filePath, error: error instanceof Error ? error.message : String(error) },
      });
      return false;
    }
  }

  /**
   * Closes the database connection.
   * Checkpoints the WAL before closing to ensure all pending writes are flushed
   * to the main database file and prevent FOREIGN KEY constraint failures.
   */
  public close(): void {
    this.checkpointWal();
    this.connection.close();
  }

  /**
   * Ensures the migration ledger table exists.
   */
  private ensureMigrationLedgerTable(): void {
    if (this.migrationLedgerEnsured) {
      return;
    }
    this.connection.exec(SQLITE_MIGRATION_LEDGER_SQL);
    this.migrationLedgerEnsured = true;
  }

  /**
   * Executes work within a transaction or savepoint.
   * @param mode - "read" or "write" transaction
   * @param work - Work to execute
   * @returns Result of work
   */
  private runInTransaction<T>(mode: "read" | "write", work: () => T): T {
    const isRootTransaction = this.transactionDepth === 0;
    const savepointName = this.quoteIdentifier(`aa_tx_${this.transactionDepth + 1}`);

    try {
      if (isRootTransaction) {
        this.connection.exec(mode === "write" ? "BEGIN IMMEDIATE" : "BEGIN");
      } else {
        this.connection.exec(`SAVEPOINT ${savepointName}`);
      }
    } catch (error) {
      throw this.normalizeTransactionError(mode, error);
    }

    this.transactionDepth += 1;

    let result: T;
    try {
      result = work();
    } catch (error) {
      this.transactionDepth -= 1;
      this.rollbackTransaction(isRootTransaction, savepointName);
      throw this.normalizeTransactionError(mode, error);
    }

    try {
      if (isRootTransaction) {
        this.connection.exec("COMMIT");
      } else {
        this.connection.exec(`RELEASE SAVEPOINT ${savepointName}`);
      }
      this.transactionDepth -= 1;
    } catch (error) {
      this.transactionDepth -= 1;
      this.rollbackTransaction(isRootTransaction, savepointName);
      throw this.normalizeTransactionError(mode, error);
    }

    return result;
  }

  /**
   * Rolls back a transaction or savepoint.
   * @param isRootTransaction - Whether this is a root transaction
   * @param savepointName - Name of the savepoint to rollback
   */
  private rollbackTransaction(isRootTransaction: boolean, savepointName: string): void {
    try {
      if (isRootTransaction) {
        this.connection.exec("ROLLBACK");
      } else {
        this.connection.exec(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        this.connection.exec(`RELEASE SAVEPOINT ${savepointName}`);
      }
    } catch (err) {
      // Best effort only: preserve the original transaction failure.
      sqliteDbLogger.log({ level: "warn", message: "Transaction rollback failed (best effort)", data: { isRootTransaction, savepointName, error: err instanceof Error ? err.message : String(err) } });
    }
  }

  /**
   * Normalizes a transaction error, converting SQLite BUSY errors to SqliteWriteContentionError.
   */
  private normalizeTransactionError(mode: "read" | "write", error: unknown): Error {
    if (mode === "write" && this.isBusySqliteError(error)) {
      return new SqliteWriteContentionError(this.filePath, error);
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  /**
   * Checks if an error indicates SQLite is busy/locked.
   */
  private isBusySqliteError(error: unknown): boolean {
    if (error == null || typeof error !== "object") {
      return false;
    }

    const candidate = error as { code?: unknown; message?: unknown };
    return candidate.code === "ERR_SQLITE_ERROR" && /database is (?:locked|busy)/i.test(String(candidate.message ?? ""));
  }

  /**
   * Applies a single migration and records it in the ledger.
   * @param migration - The migration definition to apply
   */
  private applyMigration(migration: SqliteMigrationDefinition): void {
    this.transaction(() => {
      if (this.applyCompatibleColumnMigrationIfKnown(migration)) {
        this.recordAppliedMigration(migration, migration.appliedChecksum);
        return;
      }

      this.connection.exec(migration.sql);
      this.recordAppliedMigration(migration, migration.checksum);
    });
  }

  /**
   * Applies known compatible column additions without running full migration SQL.
   * This optimizes common ALTER TABLE ADD COLUMN operations.
   */
  private applyCompatibleColumnMigrationIfKnown(migration: SqliteMigrationDefinition): boolean {
    switch (migration.version) {
      case 5:
        this.ensureColumn(
          "worker_snapshots",
          "placement",
          "ALTER TABLE worker_snapshots ADD COLUMN placement TEXT NOT NULL DEFAULT 'local';",
        );
        this.ensureColumn(
          "execution_tickets",
          "dispatch_target",
          "ALTER TABLE execution_tickets ADD COLUMN dispatch_target TEXT NOT NULL DEFAULT 'any';",
        );
        return true;
      case 6:
        this.ensureColumn(
          "worker_snapshots",
          "isolation_level",
          "ALTER TABLE worker_snapshots ADD COLUMN isolation_level TEXT NOT NULL DEFAULT 'standard';",
        );
        this.ensureColumn(
          "execution_tickets",
          "required_isolation_level",
          "ALTER TABLE execution_tickets ADD COLUMN required_isolation_level TEXT NOT NULL DEFAULT 'standard';",
        );
        return true;
      case 7:
        this.ensureColumn(
          "messages",
          "parts_json",
          "ALTER TABLE messages ADD COLUMN parts_json TEXT NULL;",
        );
        return true;
      case 8:
        this.ensureColumn(
          "worker_snapshots",
          "repo_version",
          "ALTER TABLE worker_snapshots ADD COLUMN repo_version TEXT NULL;",
        );
        this.ensureColumn(
          "execution_tickets",
          "required_repo_version",
          "ALTER TABLE execution_tickets ADD COLUMN required_repo_version TEXT NULL;",
        );
        return true;
      case 9:
        this.ensureColumn(
          "worker_snapshots",
          "remote_session_status",
          "ALTER TABLE worker_snapshots ADD COLUMN remote_session_status TEXT NULL;",
        );
        this.ensureColumn(
          "worker_snapshots",
          "last_acknowledged_stream_offset",
          "ALTER TABLE worker_snapshots ADD COLUMN last_acknowledged_stream_offset TEXT NULL;",
        );
        this.ensureColumn(
          "worker_snapshots",
          "stream_resume_success_rate",
          "ALTER TABLE worker_snapshots ADD COLUMN stream_resume_success_rate REAL NULL;",
        );
        this.ensureColumn(
          "worker_snapshots",
          "credential_refresh_success_rate",
          "ALTER TABLE worker_snapshots ADD COLUMN credential_refresh_success_rate REAL NULL;",
        );
        this.ensureColumn(
          "worker_snapshots",
          "session_consistency_check_status",
          "ALTER TABLE worker_snapshots ADD COLUMN session_consistency_check_status TEXT NULL;",
        );
        this.ensureColumn(
          "worker_snapshots",
          "session_consistency_checked_at",
          "ALTER TABLE worker_snapshots ADD COLUMN session_consistency_checked_at TEXT NULL;",
        );
        this.ensureColumn(
          "worker_snapshots",
          "saturation",
          "ALTER TABLE worker_snapshots ADD COLUMN saturation REAL NULL;",
        );
        this.ensureColumn(
          "worker_snapshots",
          "active_lease_count",
          "ALTER TABLE worker_snapshots ADD COLUMN active_lease_count INTEGER NOT NULL DEFAULT 0;",
        );
        this.ensureColumn(
          "worker_snapshots",
          "mean_startup_latency_ms",
          "ALTER TABLE worker_snapshots ADD COLUMN mean_startup_latency_ms INTEGER NULL;",
        );
        this.ensureColumn(
          "worker_snapshots",
          "sandbox_success_rate",
          "ALTER TABLE worker_snapshots ADD COLUMN sandbox_success_rate REAL NULL;",
        );
        this.ensureColumn(
          "worker_snapshots",
          "repo_cache_hit_rate",
          "ALTER TABLE worker_snapshots ADD COLUMN repo_cache_hit_rate REAL NULL;",
        );
        return true;
      case 11:
        this.ensureColumn(
          "worker_snapshots",
          "registration_verified_at",
          "ALTER TABLE worker_snapshots ADD COLUMN registration_verified_at TEXT NULL;",
        );
        this.ensureColumn(
          "worker_snapshots",
          "registration_challenge_id",
          "ALTER TABLE worker_snapshots ADD COLUMN registration_challenge_id TEXT NULL;",
        );
        this.connection.exec(`
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
`);
        return true;
      case 12:
        this.ensureColumn(
          "events",
          "session_id",
          "ALTER TABLE events ADD COLUMN session_id TEXT NULL;",
        );
        this.connection.exec(
          "CREATE INDEX IF NOT EXISTS idx_events_session_created_at ON events(session_id, created_at);",
        );
        return true;
      case 13:
        this.ensureColumn(
          "worker_snapshots",
          "workspace_sync_status",
          "ALTER TABLE worker_snapshots ADD COLUMN workspace_sync_status TEXT NULL;",
        );
        this.ensureColumn(
          "worker_snapshots",
          "workspace_sync_checked_at",
          "ALTER TABLE worker_snapshots ADD COLUMN workspace_sync_checked_at TEXT NULL;",
        );
        return true;
      case 15:
        this.ensureColumn(
          "memories",
          "session_id",
          "ALTER TABLE memories ADD COLUMN session_id TEXT NULL;",
        );
        this.ensureColumn(
          "memories",
          "agent_id",
          "ALTER TABLE memories ADD COLUMN agent_id TEXT NULL;",
        );
        this.ensureColumn(
          "memories",
          "execution_id",
          "ALTER TABLE memories ADD COLUMN execution_id TEXT NULL;",
        );
        this.ensureColumn(
          "memories",
          "memory_layer",
          "ALTER TABLE memories ADD COLUMN memory_layer TEXT NOT NULL DEFAULT 'layer_3';",
        );
        this.ensureColumn(
          "memories",
          "source_trust_level",
          "ALTER TABLE memories ADD COLUMN source_trust_level TEXT NOT NULL DEFAULT 'trusted';",
        );
        this.ensureColumn(
          "memories",
          "quality_score",
          "ALTER TABLE memories ADD COLUMN quality_score REAL NULL;",
        );
        this.ensureColumn(
          "memories",
          "hit_count",
          "ALTER TABLE memories ADD COLUMN hit_count INTEGER NOT NULL DEFAULT 0;",
        );
        this.ensureColumn(
          "memories",
          "last_accessed_at",
          "ALTER TABLE memories ADD COLUMN last_accessed_at TEXT NULL;",
        );
        this.ensureColumn(
          "memories",
          "expires_at",
          "ALTER TABLE memories ADD COLUMN expires_at TEXT NULL;",
        );
        this.ensureColumn(
          "memories",
          "revoked_at",
          "ALTER TABLE memories ADD COLUMN revoked_at TEXT NULL;",
        );
        this.ensureColumn(
          "memories",
          "revocation_reason",
          "ALTER TABLE memories ADD COLUMN revocation_reason TEXT NULL;",
        );
        this.connection.exec(`
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
`);
        return true;
      case 24:
        this.connection.exec(`
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
`);
        this.ensureColumn(
          "tenants",
          "organization_id",
          "ALTER TABLE tenants ADD COLUMN organization_id TEXT NULL;",
        );
        this.ensureColumn(
          "tenants",
          "storage_scope",
          "ALTER TABLE tenants ADD COLUMN storage_scope TEXT NOT NULL DEFAULT 'tenant';",
        );
        this.ensureColumn(
          "tenants",
          "identity_scope",
          "ALTER TABLE tenants ADD COLUMN identity_scope TEXT NOT NULL DEFAULT 'tenant';",
        );
        this.ensureColumn(
          "tenants",
          "policy_scope",
          "ALTER TABLE tenants ADD COLUMN policy_scope TEXT NOT NULL DEFAULT 'tenant';",
        );
        this.ensureColumn(
          "tenants",
          "artifact_scope",
          "ALTER TABLE tenants ADD COLUMN artifact_scope TEXT NOT NULL DEFAULT 'tenant';",
        );
        this.ensureColumn(
          "tenants",
          "isolation_mode",
          "ALTER TABLE tenants ADD COLUMN isolation_mode TEXT NOT NULL DEFAULT 'shared';",
        );
        this.ensureColumn(
          "tenants",
          "deployment_mode",
          "ALTER TABLE tenants ADD COLUMN deployment_mode TEXT NOT NULL DEFAULT 'single_region';",
        );
        this.connection.exec(`
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
`);
        return true;
      case 35:
        this.ensureColumn(
          "tasks",
          "tenant_id",
          "ALTER TABLE tasks ADD COLUMN tenant_id TEXT NULL;",
        );
        this.connection.exec(`
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status_updated_at
  ON tasks(tenant_id, status, updated_at DESC);
`);
        return true;
      case 37:
        this.ensureColumn(
          "extension_packages",
          "tenant_id",
          "ALTER TABLE extension_packages ADD COLUMN tenant_id TEXT NULL;",
        );
        this.ensureColumn(
          "marketplace_reviews",
          "tenant_id",
          "ALTER TABLE marketplace_reviews ADD COLUMN tenant_id TEXT NULL;",
        );
        this.ensureColumn(
          "marketplace_publications",
          "tenant_id",
          "ALTER TABLE marketplace_publications ADD COLUMN tenant_id TEXT NULL;",
        );
        this.ensureColumn(
          "marketplace_governance_reports",
          "tenant_id",
          "ALTER TABLE marketplace_governance_reports ADD COLUMN tenant_id TEXT NULL;",
        );
        this.ensureColumn(
          "perception_sources",
          "tenant_id",
          "ALTER TABLE perception_sources ADD COLUMN tenant_id TEXT NULL;",
        );
        this.ensureColumn(
          "intel_items",
          "tenant_id",
          "ALTER TABLE intel_items ADD COLUMN tenant_id TEXT NULL;",
        );
        this.ensureColumn(
          "intel_briefs",
          "tenant_id",
          "ALTER TABLE intel_briefs ADD COLUMN tenant_id TEXT NULL;",
        );
        this.ensureColumn(
          "action_proposals",
          "tenant_id",
          "ALTER TABLE action_proposals ADD COLUMN tenant_id TEXT NULL;",
        );
        this.connection.exec(`
DROP INDEX IF EXISTS idx_extension_packages_extension_version;
CREATE UNIQUE INDEX IF NOT EXISTS idx_extension_packages_tenant_extension_version
  ON extension_packages(COALESCE(tenant_id, ''), extension_id, version);
CREATE INDEX IF NOT EXISTS idx_extension_packages_tenant_updated_at
  ON extension_packages(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_tenant_submitted_at
  ON marketplace_reviews(tenant_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_publications_tenant_updated_at
  ON marketplace_publications(tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_governance_reports_tenant_generated_at
  ON marketplace_governance_reports(tenant_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_perception_sources_tenant_enabled_priority
  ON perception_sources(tenant_id, enabled, priority DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_items_tenant_captured_at
  ON intel_items(tenant_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_items_tenant_importance_relevance
  ON intel_items(tenant_id, importance DESC, relevance_score DESC, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_briefs_tenant_generated_at
  ON intel_briefs(tenant_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_proposals_tenant_brief_created_at
  ON action_proposals(tenant_id, brief_id, created_at DESC);
`);
        return true;
      case 44:
        this.connection.exec(migration.sql);
        this.ensureColumn(
          "harness_runs",
          "org_id",
          "ALTER TABLE harness_runs ADD COLUMN org_id TEXT NOT NULL DEFAULT '';",
        );
        this.ensureColumn(
          "harness_runs",
          "trace_id",
          "ALTER TABLE harness_runs ADD COLUMN trace_id TEXT NOT NULL DEFAULT '';",
        );
        this.ensureColumn(
          "harness_runs",
          "goal",
          "ALTER TABLE harness_runs ADD COLUMN goal TEXT NULL;",
        );
        this.ensureColumn(
          "harness_runs",
          "risk_level",
          "ALTER TABLE harness_runs ADD COLUMN risk_level TEXT NOT NULL DEFAULT 'medium';",
        );
        this.ensureColumn(
          "harness_runs",
          "domain_id",
          "ALTER TABLE harness_runs ADD COLUMN domain_id TEXT NOT NULL DEFAULT 'unassigned';",
        );
        this.ensureColumn(
          "harness_runs",
          "request_hash",
          "ALTER TABLE harness_runs ADD COLUMN request_hash TEXT NOT NULL DEFAULT '';",
        );
        this.ensureColumn(
          "harness_runs",
          "constraint_pack_ref",
          "ALTER TABLE harness_runs ADD COLUMN constraint_pack_ref TEXT NOT NULL DEFAULT '';",
        );
        this.ensureColumn(
          "harness_runs",
          "created_at",
          "ALTER TABLE harness_runs ADD COLUMN created_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';",
        );
        this.ensureColumn(
          "harness_runs",
          "fencing_token",
          "ALTER TABLE harness_runs ADD COLUMN fencing_token TEXT NOT NULL DEFAULT '';",
        );
        this.ensureColumn(
          "budget_reservations",
          "created_at",
          "ALTER TABLE budget_reservations ADD COLUMN created_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';",
        );
        return true;
      case 45:
        this.ensureColumn(
          "worker_snapshots",
          "version",
          "ALTER TABLE worker_snapshots ADD COLUMN version INTEGER NOT NULL DEFAULT 1;",
        );
        return true;
      default:
        return false;
    }
  }

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, "\"\"")}"`;
  }

  /**
   * Adds a column to a table if it doesn't already exist.
   * @param tableName - Name of the table
   * @param columnName - Name of the column to add
   * @param addColumnSql - SQL to add the column
   */
  private ensureColumn(tableName: string, columnName: string, addColumnSql: string): void {
    if (this.tableHasColumn(tableName, columnName)) {
      return;
    }
    this.connection.exec(addColumnSql);
  }

  /**
   * Checks if a table has a specific column.
   * @param tableName - Name of the table
   * @param columnName - Name of the column
   * @returns True if the column exists
   */
  private tableHasColumn(tableName: string, columnName: string): boolean {
    // S-01: Validate tableName to prevent SQL injection via identifier interpolation
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new ValidationError(`storage.invalid_table_name:${tableName}`, `storage.invalid_table_name:${tableName}`, {
        retryable: false,
        details: { tableName, columnName },
      });
    }
    return this.connection
      .prepare(`PRAGMA table_info("${tableName}");`)
      .all()
      .some((row) => {
        const record = row as Record<string, unknown>;
        return String(record.name ?? "") === columnName;
      });
  }

  /**
   * Records an applied migration in the schema_migrations table.
   */
  private recordAppliedMigration(migration: SqliteMigrationDefinition, checksum: string): void {
    this.connection
      .prepare(
        `INSERT INTO schema_migrations (version, name, checksum, applied_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(migration.version, migration.name, checksum, new Date().toISOString());
  }

  /**
   * Checks if an existing migration checksum is compatible with the expected one.
   */
  private isMigrationChecksumCompatible(existingChecksum: string, migration: SqliteMigrationDefinition): boolean {
    return existingChecksum === migration.checksum
      || existingChecksum === migration.appliedChecksum
      || (migration.compatibleChecksums ?? []).includes(existingChecksum);
  }
}
