/**
 * Cost Alert Configuration Loader
 * Loads cost alert configuration from config/cost-alert/default.json
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { CostAlertConfig } from "./cost-alert-types.js";

// Zod schema for cost alert configuration validation
const CostAlertActionSchema = z.enum([
  "sev1_alert",
  "sev2_alert",
  "sev3_alert",
  "queue_slowdown",
  "workflow_pause",
  "workflow_degrade",
  "step_abort",
]);

const BudgetPolicySchema = z.object({
  scope: z.enum(["platform", "tenant", "pack", "step"]),
  scopeId: z.string(),
  period: z.enum(["monthly", "weekly", "per_run"]),
  limitTokens: z.number().int().positive().optional(),
  limitCostUsd: z.number().positive().optional(),
  warningThreshold: z.number().min(0).max(1),
  actionsOnWarning: z.array(CostAlertActionSchema),
  actionsOnBreach: z.array(CostAlertActionSchema),
});

const CostAlertConfigSchema = z.object({
  enabled: z.boolean().default(true),
  platformBudgetPolicy: BudgetPolicySchema.nullable().default(null),
  tenantBudgetPolicies: z.record(z.string(), BudgetPolicySchema).default({}),
  packBudgetPolicies: z.record(z.string(), BudgetPolicySchema).default({}),
  defaultWarningThreshold: z.number().min(0).max(1).default(0.8),
});

const DEFAULT_CONFIG_PATH = resolve(process.cwd(), "config/cost-alert/default.json");

let cachedConfig: CostAlertConfig | null = null;

/**
 * Loads the cost alert configuration from the JSON config file.
 *
 * @param configPath - Optional path to config file (defaults to config/cost-alert/default.json)
 * @returns The parsed cost alert configuration
 */
export function loadCostAlertConfig(configPath: string = DEFAULT_CONFIG_PATH): CostAlertConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);

    // Validate parsed config against Zod schema
    const validated = CostAlertConfigSchema.parse(parsed);

    cachedConfig = {
      enabled: validated.enabled,
      platformBudgetPolicy: validated.platformBudgetPolicy,
      tenantBudgetPolicies: validated.tenantBudgetPolicies,
      packBudgetPolicies: validated.packBudgetPolicies,
      defaultWarningThreshold: validated.defaultWarningThreshold,
    };

    return cachedConfig;
  } catch {
    // Return default config if file doesn't exist or validation fails
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
export function clearCostAlertConfigCache(): void {
  cachedConfig = null;
}
