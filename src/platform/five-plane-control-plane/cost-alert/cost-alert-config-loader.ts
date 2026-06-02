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
  warningThreshold: z.number().gt(0).max(1),
  actionsOnWarning: z.array(CostAlertActionSchema),
  actionsOnBreach: z.array(CostAlertActionSchema),
});

const CostAlertConfigSchema = z.object({
  enabled: z.boolean().default(true),
  platformBudgetPolicy: BudgetPolicySchema.nullable().default(null),
  tenantBudgetPolicies: z.record(z.string(), BudgetPolicySchema).default({}),
  packBudgetPolicies: z.record(z.string(), BudgetPolicySchema).default({}),
  stepBudgetPolicies: z.record(z.string(), BudgetPolicySchema).default({}),
  defaultWarningThreshold: z.number().min(0).max(1).default(0.8),
  minAlertIntervalMs: z.number().int().nonnegative().default(300_000),
});

const costAlertConfigLogger = new StructuredLogger({ retentionLimit: 100 });
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;

const cachedConfigs = new Map<string, { value: CostAlertConfig; cachedAt: number }>();

function buildDefaultCostAlertConfig(): CostAlertConfig {
  return {
    enabled: true,
    platformBudgetPolicy: null,
    tenantBudgetPolicies: {},
    packBudgetPolicies: {},
    stepBudgetPolicies: {},
    defaultWarningThreshold: 0.8,
    minAlertIntervalMs: 300_000,
  };
}

function resolveDefaultConfigPath(): string {
  return resolve(process.cwd(), "config/cost-alert/default.json");
}

function buildCacheKey(configPath: string, sandboxed: boolean): string {
  return `${sandboxed ? "sandbox" : "path"}:${configPath}`;
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
    stepBudgetPolicies: validated.stepBudgetPolicies,
    defaultWarningThreshold: validated.defaultWarningThreshold,
    minAlertIntervalMs: validated.minAlertIntervalMs,
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
  public loadDefault(configPath?: string, sandboxPolicy?: SandboxPolicy): CostAlertConfig {
    return loadCostAlertConfig(configPath, sandboxPolicy);
  }

  public validateBudgetPolicy(input: {
    scope: string;
    budgetLimitUsd: number;
    warningThreshold: number;
    criticalThreshold: number;
  }): boolean {
    const scopeAllowed = input.scope === "platform" || input.scope === "tenant" || input.scope === "pack" || input.scope === "step";
    return input.budgetLimitUsd > 0
      && scopeAllowed
      && input.warningThreshold > 0
      && input.warningThreshold <= 1
      && input.criticalThreshold > 0
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
  configPath?: string,
  sandboxPolicy?: SandboxPolicy,
): CostAlertConfig {
  const requestedPath = configPath ?? resolveDefaultConfigPath();
  const cacheKey = buildCacheKey(requestedPath, sandboxPolicy != null);
  const cachedConfig = cachedConfigs.get(cacheKey);
  if (cachedConfig && Date.now() - cachedConfig.cachedAt <= CONFIG_CACHE_TTL_MS) {
    return cachedConfig.value;
  }

  // Validate path before reading to prevent path traversal attacks
  if (sandboxPolicy != null) {
    const check = checkSandboxPath(sandboxPolicy, requestedPath);
    if (!check.allowed) {
      throw new PolicyDeniedError(
        check.reasonCode ?? "config.cost_alert_denied",
        check.reasonCode ?? "config.cost_alert_denied",
      );
    }
    // Use normalized path after validation
    const effectivePath = check.normalizedPath;
    const normalizedCacheKey = buildCacheKey(effectivePath, true);
    const normalizedCachedConfig = cachedConfigs.get(normalizedCacheKey);
    if (normalizedCachedConfig && Date.now() - normalizedCachedConfig.cachedAt <= CONFIG_CACHE_TTL_MS) {
      return normalizedCachedConfig.value;
    }
    try {
      const loaded = parseCostAlertConfigFile(effectivePath);
      cachedConfigs.set(normalizedCacheKey, { value: loaded, cachedAt: Date.now() });
      return loaded;
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
    const loaded = parseCostAlertConfigFile(requestedPath);
    cachedConfigs.set(cacheKey, { value: loaded, cachedAt: Date.now() });
    return loaded;
  } catch (error) {
    if (isMissingFileError(error)) {
      costAlertConfigLogger.warn("cost_alert.config_missing", {
        data: { configPath: requestedPath },
      });
      return buildDefaultCostAlertConfig();
    }
    costAlertConfigLogger.error("cost_alert.config_invalid", {
      data: {
        configPath: requestedPath,
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
  cachedConfigs.clear();
}
