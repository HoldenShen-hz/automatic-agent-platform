/**
 * Environment variable utility for tests.
 *
 * Provides a clean way to save/restore environment variables with proper
 * handling of undefined values (restoring undefined means deleting the key).
 */
export declare function withEnv(overrides: Record<string, string>, fn: () => Promise<void> | void): Promise<void>;
/**
 * Synchronous version of withEnv.
 */
export declare function withEnvSync(overrides: Record<string, string>, fn: () => void): void;
