/**
 * Cost Alert Configuration Loader
 * Loads cost alert configuration from config/cost-alert/default.json
 */
import type { CostAlertConfig } from "./cost-alert-types.js";
/**
 * Loads the cost alert configuration from the JSON config file.
 *
 * @param configPath - Optional path to config file (defaults to config/cost-alert/default.json)
 * @returns The parsed cost alert configuration
 */
export declare function loadCostAlertConfig(configPath?: string): CostAlertConfig;
/**
 * Clears the cached configuration.
 * Useful for testing or when reloading config.
 */
export declare function clearCostAlertConfigCache(): void;
