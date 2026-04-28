import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PolicyDeniedError, ValidationError } from "../../contracts/errors.js";
import type { BillingLimitType, BillingResetPolicy } from "../../contracts/types/domain.js";
import { checkSandboxPath, type SandboxPolicy } from "../iam/sandbox-policy.js";
import { resolveConfigRoot } from "./runtime-env.js";

/**
 * Types of metrics that can be tracked and billed.
 * These represent the billable units in the system.
 */
export type BillingMetricType =
  | "task_execution"
  | "token_usage"
  | "artifact_storage_bytes"
  | "premium_feature_activation";

/**
 * Defines a specific quota limit for a billing metric.
 * Includes the limit type, value, reset policy, and unit pricing.
 */
export interface PlanQuotaDefinition {
  /** The type of metric this quota governs */
  metricType: BillingMetricType;
  /** How the limit is enforced (hard blocks, soft warns, burst allows temporary overage) */
  limitType: BillingLimitType;
  /** The numeric limit value */
  limitValue: number;
  /** When the quota resets (e.g., calendar month) */
  resetPolicy: BillingResetPolicy;
  /** Price per unit in USD at this tier */
  unitPriceUsd: number;
}

/**
 * A billing plan entry containing display information,
 * enabled features, and quota definitions.
 */
export interface PlanCatalogEntry {
  /** Unique identifier for the plan */
  planId: string;
  /** Human-readable plan name */
  displayName: string;
  /** List of feature flags enabled by this plan */
  features: readonly string[];
  /** Quota definitions keyed by metric type */
  quotas: Partial<Record<BillingMetricType, PlanQuotaDefinition>>;
}

/**
 * Complete billing plan catalog mapping plan IDs to their definitions.
 * Loaded from JSON configuration files with validation.
 */
export type BillingPlanCatalog = Record<string, PlanCatalogEntry>;

/**
 * Options for loading the billing plan catalog.
 * Allows overriding config root, environment, and sandbox policy.
 */
export interface BillingPlanCatalogLoadOptions {
  /** Override the default configuration root directory */
  configRoot?: string | undefined;
  /** Override the process environment */
  env?: NodeJS.ProcessEnv | undefined;
  /** Override the sandbox policy for path validation */
  sandboxPolicy?: SandboxPolicy | undefined;
}

/** Valid metric types supported in plan definitions */
const BILLING_PLAN_METRIC_TYPES: BillingMetricType[] = [
  "task_execution",
  "token_usage",
  "artifact_storage_bytes",
  "premium_feature_activation",
];
/** Valid limit types for quota definitions */
const BILLING_LIMIT_TYPES: BillingLimitType[] = ["hard", "soft", "burst"];
/** Valid reset policies for quotas */
const BILLING_RESET_POLICIES: BillingResetPolicy[] = ["calendar_month"];

/**
 * Type guard to check if a value is a plain object (not null, not array).
 */
function isStringRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Resolves the path to the bundled default billing plan catalog.
 * Searches multiple candidate locations to find the bundled file.
 * Throws if no bundled catalog is found.
 */
function resolveBundledBillingPlanCatalogPath(): string {
  const startDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(startDir, "../../../config/product/default.json"),
    join(startDir, "../../../../config/product/default.json"),
    join(process.cwd(), "config", "product", "default.json"),
  ];
  const bundledPath = candidates.find((candidate) => existsSync(candidate));
  if (bundledPath == null) {
    throw new ValidationError("billing.plan_catalog_bundled_missing", "billing.plan_catalog_bundled_missing");
  }
  return bundledPath;
}

/**
 * Validates a single quota definition object.
 * Checks metric type, limit type, limit value, reset policy, and unit price.
 * Returns the normalized quota or null if invalid, plus any validation issues.
 */
function validateQuota(
  value: unknown,
  quotaId: string,
  planId: string,
): { quota: PlanQuotaDefinition | null; issues: string[] } {
  const issues: string[] = [];
  if (!isStringRecord(value)) {
    return {
      quota: null,
      issues: [`billing.plan_catalog.invalid_quota:${planId}:${quotaId}:not_an_object`],
    };
  }

  if (typeof value.metricType !== "string" || !BILLING_PLAN_METRIC_TYPES.includes(value.metricType as BillingMetricType)) {
    issues.push(`billing.plan_catalog.invalid_quota:${planId}:${quotaId}:metric_type_invalid`);
  }
  if (typeof value.limitType !== "string" || !BILLING_LIMIT_TYPES.includes(value.limitType as BillingLimitType)) {
    issues.push(`billing.plan_catalog.invalid_quota:${planId}:${quotaId}:limit_type_invalid`);
  }
  if (typeof value.limitValue !== "number" || !Number.isFinite(value.limitValue) || value.limitValue <= 0) {
    issues.push(`billing.plan_catalog.invalid_quota:${planId}:${quotaId}:limit_value_invalid`);
  }
  if (
    typeof value.resetPolicy !== "string"
    || !BILLING_RESET_POLICIES.includes(value.resetPolicy as BillingResetPolicy)
  ) {
    issues.push(`billing.plan_catalog.invalid_quota:${planId}:${quotaId}:reset_policy_invalid`);
  }
  if (typeof value.unitPriceUsd !== "number" || !Number.isFinite(value.unitPriceUsd) || value.unitPriceUsd < 0) {
    issues.push(`billing.plan_catalog.invalid_quota:${planId}:${quotaId}:unit_price_invalid`);
  }

  if (issues.length > 0) {
    return { quota: null, issues };
  }

  return {
    quota: {
      metricType: value.metricType as BillingMetricType,
      limitType: value.limitType as BillingLimitType,
      limitValue: value.limitValue as number,
      resetPolicy: value.resetPolicy as BillingResetPolicy,
      unitPriceUsd: value.unitPriceUsd as number,
    },
    issues,
  };
}

/**
 * Validates a complete plan entry from the catalog.
 * Checks plan ID, display name, features array, and quotas object.
 * Returns the normalized plan or null if invalid, plus validation issues.
 */
function validatePlanEntry(
  value: unknown,
  planKey: string,
): { plan: PlanCatalogEntry | null; issues: string[] } {
  const issues: string[] = [];
  if (!isStringRecord(value)) {
    return {
      plan: null,
      issues: [`billing.plan_catalog.invalid_plan:${planKey}:not_an_object`],
    };
  }

  if (typeof value.planId !== "string" || value.planId.trim().length === 0) {
    issues.push(`billing.plan_catalog.invalid_plan:${planKey}:plan_id_invalid`);
  } else if (value.planId !== planKey) {
    issues.push(`billing.plan_catalog.invalid_plan:${planKey}:plan_id_mismatch`);
  }
  if (typeof value.displayName !== "string" || value.displayName.trim().length === 0) {
    issues.push(`billing.plan_catalog.invalid_plan:${planKey}:display_name_invalid`);
  }
  if (
    !Array.isArray(value.features)
    || value.features.some((feature) => typeof feature !== "string" || feature.trim().length === 0)
  ) {
    issues.push(`billing.plan_catalog.invalid_plan:${planKey}:features_invalid`);
  }
  if (!isStringRecord(value.quotas)) {
    issues.push(`billing.plan_catalog.invalid_plan:${planKey}:quotas_invalid`);
  }

  const normalizedQuotas: Partial<Record<BillingMetricType, PlanQuotaDefinition>> = {};
  if (isStringRecord(value.quotas)) {
    for (const [quotaId, quotaValue] of Object.entries(value.quotas)) {
      const { quota, issues: quotaIssues } = validateQuota(quotaValue, quotaId, planKey);
      issues.push(...quotaIssues);
      if (quota != null) {
        normalizedQuotas[quota.metricType] = quota;
      }
    }
  }

  if (issues.length > 0) {
    return { plan: null, issues };
  }

  return {
    plan: {
      planId: value.planId as string,
      displayName: value.displayName as string,
      features: [...(value.features as string[])],
      quotas: normalizedQuotas,
    },
    issues,
  };
}

/**
 * Parses and validates a complete billing plan catalog JSON file.
 * Validates the structure and each plan entry, throwing if invalid.
 */
function parseBillingPlanCatalog(raw: string, filePath: string): BillingPlanCatalog {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ValidationError(
      `billing.plan_catalog_invalid_json:${filePath}:${error instanceof Error ? error.message : String(error)}`,
      `billing.plan_catalog_invalid_json:${filePath}:${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!isStringRecord(parsed) || !isStringRecord(parsed.billingPlans)) {
    throw new ValidationError(
      `billing.plan_catalog_invalid_shape:${filePath}`,
      `billing.plan_catalog_invalid_shape:${filePath}`,
    );
  }

  const plans: BillingPlanCatalog = {};
  const issues: string[] = [];
  for (const [planKey, planValue] of Object.entries(parsed.billingPlans)) {
    const { plan, issues: planIssues } = validatePlanEntry(planValue, planKey);
    issues.push(...planIssues);
    if (plan != null) {
      plans[planKey] = plan;
    }
  }

  if (Object.keys(plans).length === 0) {
    issues.push(`billing.plan_catalog_empty:${filePath}`);
  }

  if (issues.length > 0) {
    throw new ValidationError(issues.join(";"), issues.join(";"));
  }

  return plans;
}

/**
 * Bundled default billing plan catalog loaded at module import time.
 * Used as fallback when no custom catalog is provided.
 */
export const DEFAULT_BILLING_PLAN_CATALOG: BillingPlanCatalog = parseBillingPlanCatalog(
  readFileSync(resolveBundledBillingPlanCatalogPath(), "utf8"),
  resolveBundledBillingPlanCatalogPath(),
);

/**
 * Loads the billing plan catalog from configuration.
 * First tries the bundled default, then checks for custom catalog at configRoot.
 * Validates paths against sandbox policy if provided.
 */
export function loadBillingPlanCatalog(options: BillingPlanCatalogLoadOptions = {}): BillingPlanCatalog {
  const resolveOptions: { configRoot?: string; env?: NodeJS.ProcessEnv } = {};
  if (options.configRoot != null) {
    resolveOptions.configRoot = options.configRoot;
  }
  if (options.env != null) {
    resolveOptions.env = options.env;
  }
  const configRoot = resolveConfigRoot(resolveOptions);
  const catalogPath = join(configRoot, "product", "default.json");
  if (!existsSync(catalogPath)) {
    return DEFAULT_BILLING_PLAN_CATALOG;
  }

  if (options.sandboxPolicy != null) {
    const check = checkSandboxPath(options.sandboxPolicy, catalogPath);
    if (!check.allowed) {
      throw new PolicyDeniedError(
        check.reasonCode ?? "billing.plan_catalog_denied",
        check.reasonCode ?? "billing.plan_catalog_denied",
      );
    }
    return parseBillingPlanCatalog(readFileSync(check.normalizedPath, "utf8"), catalogPath);
  }

  return parseBillingPlanCatalog(readFileSync(catalogPath, "utf8"), catalogPath);
}
