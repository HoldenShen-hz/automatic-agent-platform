/**
 * Cost Alert Configuration Loader
 * Loads cost alert configuration from config/cost-alert/default.json
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { CostAlertConfig } from "./cost-alert-types.js";
import { PolicyDeniedError, ValidationError } from "../../contracts/errors.js";
import { checkSandboxPath, createConfigReadPolicy, type SandboxPolicy } from "../iam/sandbox-policy.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

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
const costAlertConfigLogger = new StructuredLogger({ retentionLimit: 100 });

let cachedConfig: CostAlertConfig | null = null;

function buildDefaultCostAlertConfig(): CostAlertConfig {
  return {
    enabled: true,
    platformBudgetPolicy: null,
    tenantBudgetPolicies: {},
    packBudgetPolicies: {},
    defaultWarningThreshold: 0.8,
  };
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object"
    && error != null
    && "code" in error
    && String(error.code) === "ENOENT";
}

function normalizeValidatedConfig(validated: z.infer<typeof CostAlertConfigSchema>): CostAlertConfig {
  return {
    enabled: validated.enabled,
    platformBudgetPolicy: validated.platformBudgetPolicy,
    tenantBudgetPolicies: validated.tenantBudgetPolicies,
    packBudgetPolicies: validated.packBudgetPolicies,
    defaultWarningThreshold: validated.defaultWarningThreshold,
  };
}

function parseCostAlertConfigFile(configPath: string): CostAlertConfig {
  const raw = readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw);
  const validated = CostAlertConfigSchema.parse(parsed);
  return normalizeValidatedConfig(validated);
}

function createCostAlertConfigValidationError(error: unknown): ValidationError {
  return error instanceof Error
    ? new ValidationError("cost_alert.config_invalid", "cost_alert.config_invalid", { cause: error })
    : new ValidationError("cost_alert.config_invalid", "cost_alert.config_invalid");
}

export class CostAlertConfigLoader {
  public loadDefault(configPath: string = DEFAULT_CONFIG_PATH, sandboxPolicy?: SandboxPolicy): CostAlertConfig {
    return loadCostAlertConfig(configPath, sandboxPolicy);
  }

  public validateBudgetPolicy(input: {
    scope: string;
    budgetLimitUsd: number;
    warningThreshold: number;
    criticalThreshold: number;
  }): boolean {
    return input.budgetLimitUsd > 0
      && input.warningThreshold >= 0
      && input.warningThreshold < input.criticalThreshold
      && input.criticalThreshold <= 1;
  }
}

/**
 * Loads the cost alert configuration from the JSON config file.
 *
 * @param configPath - Optional path to config file (defaults to config/cost-alert/default.json)
 * @param sandboxPolicy - Optional sandbox policy for path validation
 * @returns The parsed cost alert configuration
 */
export function loadCostAlertConfig(
  configPath: string = DEFAULT_CONFIG_PATH,
  sandboxPolicy?: SandboxPolicy,
): CostAlertConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Validate path before reading to prevent path traversal attacks
  if (sandboxPolicy != null) {
    const check = checkSandboxPath(sandboxPolicy, configPath);
    if (!check.allowed) {
      throw new PolicyDeniedError(
        check.reasonCode ?? "config.cost_alert_denied",
        check.reasonCode ?? "config.cost_alert_denied",
      );
    }
    // Use normalized path after validation
    const effectivePath = check.normalizedPath;
    try {
      cachedConfig = parseCostAlertConfigFile(effectivePath);
      return cachedConfig!;
    } catch (error) {
      if (isMissingFileError(error)) {
        costAlertConfigLogger.warn("cost_alert.config_missing", {
          data: { configPath: effectivePath },
        });
        return buildDefaultCostAlertConfig();
      }
      costAlertConfigLogger.error("cost_alert.config_invalid", {
        data: {
          configPath: effectivePath,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw createCostAlertConfigValidationError(error);
    }
  }

  try {
    cachedConfig = parseCostAlertConfigFile(configPath);
    return cachedConfig!;
  } catch (error) {
    if (isMissingFileError(error)) {
      costAlertConfigLogger.warn("cost_alert.config_missing", {
        data: { configPath },
      });
      return buildDefaultCostAlertConfig();
    }
    costAlertConfigLogger.error("cost_alert.config_invalid", {
      data: {
        configPath,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw createCostAlertConfigValidationError(error);
  }
}

/**
 * Clears the cached configuration.
 * Useful for testing or when reloading config.
 */
export function clearCostAlertConfigCache(): void {
  cachedConfig = null;
}
