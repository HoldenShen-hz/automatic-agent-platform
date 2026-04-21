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
}
export declare class MigrationRunner {
    private readonly storage;
    constructor(storage: AuthoritativeStorageBackendHandle);
    status(): Promise<MigrationRunnerResult>;
    up(): Promise<MigrationRunnerResult>;
    down(): Promise<MigrationRunnerResult>;
    private buildResult;
}
