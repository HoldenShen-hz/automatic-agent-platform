/**
 * Cost Alert Configuration Loader
 * Loads cost alert configuration from config/cost-alert/default.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const DEFAULT_CONFIG_PATH = resolve(process.cwd(), "config/cost-alert/default.json");
let cachedConfig = null;
/**
 * Loads the cost alert configuration from the JSON config file.
 *
 * @param configPath - Optional path to config file (defaults to config/cost-alert/default.json)
 * @returns The parsed cost alert configuration
 */
export function loadCostAlertConfig(configPath = DEFAULT_CONFIG_PATH) {
    if (cachedConfig) {
        return cachedConfig;
    }
    try {
        const raw = readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(raw);
        cachedConfig = {
            enabled: parsed.enabled ?? true,
            platformBudgetPolicy: parsed.platformBudgetPolicy ?? null,
            tenantBudgetPolicies: parsed.tenantBudgetPolicies ?? {},
            packBudgetPolicies: parsed.packBudgetPolicies ?? {},
            defaultWarningThreshold: parsed.defaultWarningThreshold ?? 0.8,
        };
        return cachedConfig;
    }
    catch {
        // Return default config if file doesn't exist
        return {
            enabled: true,
            platformBudgetPolicy: null,
            tenantBudgetPolicies: {},
            packBudgetPolicies: {},
            defaultWarningThreshold: 0.8,
        };
    }
}
/**
 * Clears the cached configuration.
 * Useful for testing or when reloading config.
 */
export function clearCostAlertConfigCache() {
    cachedConfig = null;
}
//# sourceMappingURL=cost-alert-config-loader.js.map