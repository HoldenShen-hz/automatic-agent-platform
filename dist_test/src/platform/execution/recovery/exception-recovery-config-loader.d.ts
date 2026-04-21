/**
 * Exception Recovery Configuration Loader
 * Loads exception recovery strategy from config/exception-recovery/default.json
 */
import type { ExceptionRecoveryConfig } from "./exception-recovery-types.js";
export type { ExceptionRecoveryConfig } from "./exception-recovery-types.js";
/**
 * Loads the exception recovery configuration from the JSON config file.
 *
 * @param configPath - Optional path to config file (defaults to config/exception-recovery/default.json)
 * @returns The parsed exception recovery configuration
 */
export declare function loadExceptionRecoveryConfig(configPath?: string): ExceptionRecoveryConfig;
/**
 * Clears the cached configuration.
 * Useful for testing or when reloading config.
 */
export declare function clearExceptionRecoveryConfigCache(): void;
