/**
 * Runtime authoritative migration status/result facade.
 * Contract reference: docs_zh/contracts/runtime_repository_and_migration_contract.md
 */
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
    await this.storage.migrate();
    return this.buildResult("up");
  }

  public async down(): Promise<MigrationRunnerResult> {
    return this.buildResult("down");
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
}
