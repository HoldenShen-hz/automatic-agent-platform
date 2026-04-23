/**
 * Cost Alert Configuration Loader
 * Loads cost alert configuration from config/cost-alert/default.json
 */
import type { CostAlertConfig } from "./cost-alert-types.js";
import { type SandboxPolicy } from "../iam/sandbox-policy.js";
/**
 * Loads the cost alert configuration from the JSON config file.
 *
 * @param configPath - Optional path to config file (defaults to config/cost-alert/default.json)
 * @param sandboxPolicy - Optional sandbox policy for path validation
 * @returns The parsed cost alert configuration
 */
export declare function loadCostAlertConfig(configPath?: string, sandboxPolicy?: SandboxPolicy): CostAlertConfig;
/**
 * Clears the cached configuration.
 * Useful for testing or when reloading config.
 */
export declare function clearCostAlertConfigCache(): void;
