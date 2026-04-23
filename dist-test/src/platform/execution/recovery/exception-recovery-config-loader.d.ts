/**
 * Exception Recovery Configuration Loader
 * Loads exception recovery strategy from config/exception-recovery/default.json
 */
import { type SandboxPolicy } from "../../control-plane/iam/sandbox-policy.js";
import type { ExceptionRecoveryConfig } from "./exception-recovery-types.js";
export type { ExceptionRecoveryConfig } from "./exception-recovery-types.js";
/**
 * Loads the exception recovery configuration from the JSON config file.
 *
 * @param configPath - Optional path to config file (defaults to config/exception-recovery/default.json)
 * @param sandboxPolicy - Optional sandbox policy for path validation
 * @returns The parsed exception recovery configuration
 */
export declare function loadExceptionRecoveryConfig(configPath?: string, sandboxPolicy?: SandboxPolicy): ExceptionRecoveryConfig;
/**
 * Clears the cached configuration.
 * Useful for testing or when reloading config.
 */
export declare function clearExceptionRecoveryConfigCache(): void;
