/**
 * Options for resolving runtime configuration from environment variables.
 */
export interface RuntimeConfigEnvOptions {
    env?: NodeJS.ProcessEnv | undefined;
    environment?: string | undefined;
    configRoot?: string | undefined;
    cwd?: string | undefined;
}
/**
 * Resource ceiling limits for agent execution.
 * Used to cap resource usage during task execution.
 */
export interface ExecutionResourceCeilingEnvConfig {
    maxToolCalls: number | null;
    maxMemoryMb: number | null;
    maxElapsedMs: number | null;
}
/**
 * Reads an environment variable and trims whitespace.
 * Returns null if the variable is not set or empty after trimming.
 */
export declare function readTrimmedEnv(env: NodeJS.ProcessEnv, name: string): string | null;
/**
 * Resolves the environment name from options or AA_CONFIG_ENV variable.
 * Defaults to "prod" (fail-closed) if not specified — never fall back to
 * a permissive environment when AA_CONFIG_ENV is missing.
 */
export declare function resolveConfigEnvironment(options?: RuntimeConfigEnvOptions): string;
/**
 * Resolves the configuration root directory from options or AA_CONFIG_ROOT variable.
 * Defaults to {cwd}/config if not specified.
 */
export declare function resolveConfigRoot(options?: RuntimeConfigEnvOptions): string;
/**
 * Resolves the workspace root directory (parent of config root).
 */
export declare function resolveConfigWorkspaceRoot(options?: RuntimeConfigEnvOptions): string;
/**
 * Resolves the expected protected governance version from environment.
 * Used for tamper detection validation.
 */
export declare function resolveExpectedProtectedGovernanceVersion(env?: NodeJS.ProcessEnv): string | null;
/**
 * Loads execution resource ceiling configuration from environment variables.
 * Used to limit agent tool calls, memory usage, and elapsed time.
 */
export declare function loadExecutionResourceCeilingEnv(env?: NodeJS.ProcessEnv): ExecutionResourceCeilingEnvConfig;
