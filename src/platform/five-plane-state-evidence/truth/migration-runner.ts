/**
 * Runtime authoritative migration status/result facade.
 * Contract reference: docs_zh/contracts/runtime_repository_and_migration_contract.md
 */
import { createHash } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import { ValidationError } from "../../contracts/errors.js";
import type { AuthoritativeStorageBackendHandle } from "./storage-backend-factory.js";

export interface MigrationRunnerSchemaStatus {
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

export interface MigrationRunnerResult {
  action: "status" | "up" | "down";
  driver: "sqlite" | "postgres";
  status: MigrationRunnerSchemaStatus;
  rollbackSupported: boolean;
  rollbackReason: string | null;
  rollbackProcedure: readonly string[];
}

export class MigrationRunner {
  public constructor(private readonly storage: AuthoritativeStorageBackendHandle) {}

  public async status(): Promise<MigrationRunnerResult> {
    return this.buildResult("status");
  }

  public async up(): Promise<MigrationRunnerResult> {
    return this.withMigrationLock(async () => {
      await this.storage.migrate();
      return this.buildResult("up");
    });
  }

  public async down(): Promise<MigrationRunnerResult> {
    throw new ValidationError(
      "migration_runner.down_not_supported",
      "migration_runner.down_not_supported",
      {
        retryable: false,
        details: {
          rollbackProcedure: [
            "stop writers",
            "verify latest backup manifest",
            "restore backup into isolated database",
            "run schema status check",
            "promote restored database or apply forward fix",
          ],
        },
      },
    );
  }

  private async buildResult(action: MigrationRunnerResult["action"]): Promise<MigrationRunnerResult> {
    const status =
      this.storage.driver === "sqlite"
        ? this.storage.sql.getSchemaStatus()
        : await this.storage.postgres.getSchemaStatus();
    const rollbackSupported = false;
    const rollbackReason = action === "down"
      ? "authoritative storage down migrations are not supported and fail-closed; restore from a verified backup or promote a forward fix."
      : null;
    return {
      action,
      driver: this.storage.driver,
      status: {
        currentVersion: status.currentVersion,
        expectedVersion: status.expectedVersion,
        upToDate: status.upToDate,
        pendingVersions: [...status.pendingVersions],
        checksumMismatches: [...status.checksumMismatches],
      },
      rollbackSupported,
      rollbackReason,
      rollbackProcedure: action === "down"
        ? [
            "stop writers",
            "verify latest backup manifest",
            "restore backup into isolated database",
            "run schema status check",
            "promote restored database or apply forward fix",
          ]
        : [],
    };
  }

  private async withMigrationLock<T>(work: () => Promise<T>): Promise<T> {
    const lockPath = this.resolveLockPath();
    try {
      mkdirSync(lockPath);
    } catch (error) {
      const code = error instanceof Error && "code" in error ? String((error as NodeJS.ErrnoException).code ?? "") : "";
      if (code === "EEXIST") {
        throw new ValidationError(
          "migration_runner.lock_already_held",
          `migration_runner.lock_already_held:${lockPath}`,
          {
            retryable: true,
            details: { lockPath },
          },
        );
      }
      throw error;
    }
    try {
      return await work();
    } finally {
      rmSync(lockPath, { recursive: true, force: true });
    }
  }

  private resolveLockPath(): string {
    const storageRef = this.resolveLockStorageRef();
    const digest = createHash("sha256").update(storageRef).digest("hex");
    const parent = this.storage.driver === "sqlite" ? dirname(storageRef) : tmpdir();
    return join(parent, `.aa-schema-migration-lock-${digest}`);
  }

  private resolveLockStorageRef(): string {
    if (this.storage.driver === "sqlite") {
      return this.storage.sqlite.filePath;
    }
    return this.storage.postgres.filePath
      ?? this.storage.shadowSqlite?.filePath
      ?? this.storage.runtimeProfile.postgres?.database
      ?? JSON.stringify({
        driver: this.storage.driver,
        runtimeProfile: this.storage.runtimeProfile,
      });
  }
}
