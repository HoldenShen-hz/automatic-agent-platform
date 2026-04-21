import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PolicyDeniedError, ValidationError } from "../../contracts/errors.js";
import { checkSandboxPath } from "../iam/sandbox-policy.js";
import { resolveConfigRoot } from "./runtime-env.js";
/** Valid metric types supported in plan definitions */
const BILLING_PLAN_METRIC_TYPES = [
    "task_execution",
    "token_usage",
    "artifact_storage_bytes",
    "premium_feature_activation",
];
/** Valid limit types for quota definitions */
const BILLING_LIMIT_TYPES = ["hard", "soft", "burst"];
/** Valid reset policies for quotas */
const BILLING_RESET_POLICIES = ["calendar_month"];
/**
 * Type guard to check if a value is a plain object (not null, not array).
 */
function isStringRecord(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
}
/**
 * Resolves the path to the bundled default billing plan catalog.
 * Searches multiple candidate locations to find the bundled file.
 * Throws if no bundled catalog is found.
 */
function resolveBundledBillingPlanCatalogPath() {
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
function validateQuota(value, quotaId, planId) {
    const issues = [];
    if (!isStringRecord(value)) {
        return {
            quota: null,
            issues: [`billing.plan_catalog.invalid_quota:${planId}:${quotaId}:not_an_object`],
        };
    }
    if (typeof value.metricType !== "string" || !BILLING_PLAN_METRIC_TYPES.includes(value.metricType)) {
        issues.push(`billing.plan_catalog.invalid_quota:${planId}:${quotaId}:metric_type_invalid`);
    }
    if (typeof value.limitType !== "string" || !BILLING_LIMIT_TYPES.includes(value.limitType)) {
        issues.push(`billing.plan_catalog.invalid_quota:${planId}:${quotaId}:limit_type_invalid`);
    }
    if (typeof value.limitValue !== "number" || !Number.isFinite(value.limitValue) || value.limitValue <= 0) {
        issues.push(`billing.plan_catalog.invalid_quota:${planId}:${quotaId}:limit_value_invalid`);
    }
    if (typeof value.resetPolicy !== "string"
        || !BILLING_RESET_POLICIES.includes(value.resetPolicy)) {
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
            metricType: value.metricType,
            limitType: value.limitType,
            limitValue: value.limitValue,
            resetPolicy: value.resetPolicy,
            unitPriceUsd: value.unitPriceUsd,
        },
        issues,
    };
}
/**
 * Validates a complete plan entry from the catalog.
 * Checks plan ID, display name, features array, and quotas object.
 * Returns the normalized plan or null if invalid, plus validation issues.
 */
function validatePlanEntry(value, planKey) {
    const issues = [];
    if (!isStringRecord(value)) {
        return {
            plan: null,
            issues: [`billing.plan_catalog.invalid_plan:${planKey}:not_an_object`],
        };
    }
    if (typeof value.planId !== "string" || value.planId.trim().length === 0) {
        issues.push(`billing.plan_catalog.invalid_plan:${planKey}:plan_id_invalid`);
    }
    else if (value.planId !== planKey) {
        issues.push(`billing.plan_catalog.invalid_plan:${planKey}:plan_id_mismatch`);
    }
    if (typeof value.displayName !== "string" || value.displayName.trim().length === 0) {
        issues.push(`billing.plan_catalog.invalid_plan:${planKey}:display_name_invalid`);
    }
    if (!Array.isArray(value.features)
        || value.features.some((feature) => typeof feature !== "string" || feature.trim().length === 0)) {
        issues.push(`billing.plan_catalog.invalid_plan:${planKey}:features_invalid`);
    }
    if (!isStringRecord(value.quotas)) {
        issues.push(`billing.plan_catalog.invalid_plan:${planKey}:quotas_invalid`);
    }
    const normalizedQuotas = {};
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
            planId: value.planId,
            displayName: value.displayName,
            features: [...value.features],
            quotas: normalizedQuotas,
        },
        issues,
    };
}
/**
 * Parses and validates a complete billing plan catalog JSON file.
 * Validates the structure and each plan entry, throwing if invalid.
 */
function parseBillingPlanCatalog(raw, filePath) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (error) {
        throw new ValidationError(`billing.plan_catalog_invalid_json:${filePath}:${error instanceof Error ? error.message : String(error)}`, `billing.plan_catalog_invalid_json:${filePath}:${error instanceof Error ? error.message : String(error)}`);
    }
    if (!isStringRecord(parsed) || !isStringRecord(parsed.billingPlans)) {
        throw new ValidationError(`billing.plan_catalog_invalid_shape:${filePath}`, `billing.plan_catalog_invalid_shape:${filePath}`);
    }
    const plans = {};
    const issues = [];
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
export const DEFAULT_BILLING_PLAN_CATALOG = parseBillingPlanCatalog(readFileSync(resolveBundledBillingPlanCatalogPath(), "utf8"), resolveBundledBillingPlanCatalogPath());
/**
 * Loads the billing plan catalog from configuration.
 * First tries the bundled default, then checks for custom catalog at configRoot.
 * Validates paths against sandbox policy if provided.
 */
export function loadBillingPlanCatalog(options = {}) {
    const resolveOptions = {};
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
            throw new PolicyDeniedError(check.reasonCode ?? "billing.plan_catalog_denied", check.reasonCode ?? "billing.plan_catalog_denied");
        }
        return parseBillingPlanCatalog(readFileSync(check.normalizedPath, "utf8"), catalogPath);
    }
    return parseBillingPlanCatalog(readFileSync(catalogPath, "utf8"), catalogPath);
}
//# sourceMappingURL=billing-plan-catalog.js.map