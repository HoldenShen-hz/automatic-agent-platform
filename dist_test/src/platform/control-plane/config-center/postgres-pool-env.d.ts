/**
 * PostgreSQL connection pool configuration including DSN and pool settings.
 */
export interface PostgresPoolEnvConfig {
    dsn: string | null;
    poolMin: number;
    poolMax: number;
    idleTimeoutSeconds: number;
    connectTimeoutSeconds: number;
    ssl: false | {
        rejectUnauthorized: true;
    };
}
/**
 * Options for loading PostgreSQL pool configuration with customizable env var keys.
 */
export interface LoadPostgresPoolEnvOptions {
    dsnKeys?: string[];
    poolMinKeys?: string[];
    poolMaxKeys?: string[];
    idleTimeoutKeys?: string[];
    connectTimeoutKeys?: string[];
    sslModeKeys?: string[];
    defaultPoolMin?: number;
    defaultPoolMax?: number;
    defaultIdleTimeoutSeconds?: number;
    defaultConnectTimeoutSeconds?: number;
}
/**
 * Loads PostgreSQL pool configuration from environment variables.
 * Supports multiple DSN keys for compatibility with different deployment configurations.
 * Validates that poolMin does not exceed poolMax.
 */
export declare function loadPostgresPoolEnv(env?: NodeJS.ProcessEnv, options?: LoadPostgresPoolEnvOptions): PostgresPoolEnvConfig;
