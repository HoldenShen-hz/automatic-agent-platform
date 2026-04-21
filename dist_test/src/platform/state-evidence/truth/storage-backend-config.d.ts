import { type SandboxPolicy } from "../../control-plane/iam/sandbox-policy.js";
/**
 * Supported storage drivers.
 */
export type StorageDriver = "sqlite" | "postgres";
/**
 * Options for validating storage backend configuration.
 */
export interface StorageBackendConfigValidationOptions {
    environment: string;
    env?: NodeJS.ProcessEnv;
    sandboxPolicy?: SandboxPolicy;
}
/**
 * PostgreSQL-specific runtime profile information.
 */
export interface PostgresStorageBackendRuntimeProfile {
    dsnConfigured: boolean;
    dsnSource: string | null;
    dsnValue?: string | null;
    host: string | null;
    database: string | null;
    sslmode: string | null;
    poolMin: number | null;
    poolMax: number | null;
    dualRun: boolean;
    shadowSqlitePath: string | null;
    schema: string | null;
}
/**
 * Runtime profile for a storage backend including driver and configuration.
 */
export interface StorageBackendRuntimeProfile {
    environment: string;
    driver: StorageDriver;
    /** List of configuration issues (empty if valid) */
    issues: string[];
    /** PostgreSQL-specific profile if driver is postgres */
    postgres: PostgresStorageBackendRuntimeProfile | null;
}
/**
 * Resolves the storage driver from environment variables.
 * Defaults to SQLite if not explicitly configured.
 * @param env - Process environment variables
 * @returns The configured storage driver
 */
export declare function resolveStorageDriver(env?: NodeJS.ProcessEnv): StorageDriver;
/**
 * Builds a list of configuration issues for a storage backend.
 * @param options - Validation options
 * @returns Array of issue descriptions
 */
export declare function buildStorageBackendConfigIssues(options: StorageBackendConfigValidationOptions): string[];
/**
 * Inspects storage backend configuration and returns a runtime profile.
 *
 * This function validates the configuration and returns detailed information
 * about the storage backend including driver, PostgreSQL settings, and any issues.
 *
 * @param options - Validation options including environment and environment variables
 * @returns A runtime profile with configuration details and issues
 */
export declare function inspectStorageBackendConfig(options: StorageBackendConfigValidationOptions): StorageBackendRuntimeProfile;
