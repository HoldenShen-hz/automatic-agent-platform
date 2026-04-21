import type { BillingLimitType, BillingResetPolicy } from "../../contracts/types/domain.js";
import { type SandboxPolicy } from "../iam/sandbox-policy.js";
/**
 * Types of metrics that can be tracked and billed.
 * These represent the billable units in the system.
 */
export type BillingMetricType = "task_execution" | "token_usage" | "artifact_storage_bytes" | "premium_feature_activation";
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
/**
 * Bundled default billing plan catalog loaded at module import time.
 * Used as fallback when no custom catalog is provided.
 */
export declare const DEFAULT_BILLING_PLAN_CATALOG: BillingPlanCatalog;
/**
 * Loads the billing plan catalog from configuration.
 * First tries the bundled default, then checks for custom catalog at configRoot.
 * Validates paths against sandbox policy if provided.
 */
export declare function loadBillingPlanCatalog(options?: BillingPlanCatalogLoadOptions): BillingPlanCatalog;
