/**
 * @fileoverview Configuration Override Governance Service
 *
 * Manages dynamic configuration constraint overrides across different trust levels
 * and contexts (env, tenant, rollout, break-glass).
 *
 * Key concepts:
 * - Constraint layers: global, environment, tenant/workspace, rollout/cohort, break-glass
 * - Overrideable scope: explicit declaration of what can be overridden at each layer
 * - High-risk objects: provider profile, prompt bundle, policy rule, feature flag
 * - Audit trail: all overrides produce logs and evidence
 *
 * @see {@link https://github.com/anomalyco/automatic_agent/blob/main/docs_zh/contracts/environment_and_configuration_governance_contract.md}
 *
 * @packageDocumentation
 */
/**
 * Constraint layer levels ordered from lowest to highest trust.
 * Higher layers can override lower layers but with more restrictions.
 */
export type ConfigConstraintLayer = "global" | "environment" | "tenant" | "rollout" | "break_glass";
/**
 * High-risk configuration objects that should not be silently overridden
 * by low-trust sources.
 */
export type HighRiskConfigObject = "provider_profile" | "prompt_bundle" | "policy_rule" | "feature_flag";
/**
 * Represents a single configuration override attempt.
 */
export interface ConfigOverrideAttempt {
    path: string;
    layer: ConfigConstraintLayer;
    source: string;
    value: unknown;
    timestamp: string;
}
/**
 * Represents a recorded configuration override with audit information.
 */
export interface ConfigOverrideRecord extends ConfigOverrideAttempt {
    id: string;
    allowed: boolean;
    reason?: string;
    highRiskObject?: HighRiskConfigObject;
}
/**
 * Constraint rule defining what can be overridden at a specific layer.
 */
export interface OverrideConstraintRule {
    layer: ConfigConstraintLayer;
    allowedPaths: readonly string[];
    deniedPaths: readonly string[];
    highRiskObjectsAllowed: readonly HighRiskConfigObject[];
    requireAudit: boolean;
    failOnUnknownSource: boolean;
}
/**
 * Result of validating an override attempt.
 */
export interface OverrideValidationResult {
    allowed: boolean;
    reason?: string;
    conflictingLayer?: ConfigConstraintLayer;
    highRiskObject?: HighRiskConfigObject;
}
/**
 * Configuration override governance service options.
 */
export interface ConfigOverrideGovernanceOptions {
    rules?: readonly OverrideConstraintRule[];
    auditLog?: ConfigOverrideAuditLog;
}
/**
 * Audit log interface for recording override events.
 */
export interface ConfigOverrideAuditLog {
    record(override: ConfigOverrideRecord): void;
    query(filter?: {
        layer?: ConfigConstraintLayer;
        source?: string;
        path?: string;
        startTime?: string;
        endTime?: string;
    }): ConfigOverrideRecord[];
}
/**
 * Default constraint rules for each layer.
 * These define the baseline governance policy.
 */
export declare const DEFAULT_CONSTRAINT_RULES: readonly OverrideConstraintRule[];
/**
 * In-memory audit log implementation.
 */
export declare class InMemoryOverrideAuditLog implements ConfigOverrideAuditLog {
    private records;
    record(override: ConfigOverrideRecord): void;
    query(filter?: {
        layer?: ConfigConstraintLayer;
        source?: string;
        path?: string;
        startTime?: string;
        endTime?: string;
    }): ConfigOverrideRecord[];
    clear(): void;
    size(): number;
}
/**
 * Service for governing configuration overrides across different constraint layers.
 *
 * This service ensures that:
 * - Configuration overrides are explicitly declared and constrained
 * - High-risk objects cannot be silently overridden by low-trust sources
 * - All override attempts are audited
 * - Unknown sources or illegal constraint combinations fail-close
 */
export declare class ConfigOverrideGovernanceService {
    private readonly rules;
    private readonly auditLog;
    constructor(options?: ConfigOverrideGovernanceOptions);
    /**
     * Validates whether a configuration override is allowed.
     *
     * @param attempt - The override attempt to validate
     * @returns Validation result indicating if override is allowed
     */
    validateOverride(attempt: ConfigOverrideAttempt): OverrideValidationResult;
    /**
     * Records and validates a configuration override attempt.
     *
     * @param attempt - The override attempt to validate
     * @returns The override record with audit information
     */
    recordOverride(attempt: ConfigOverrideAttempt): ConfigOverrideRecord;
    /**
     * Checks if a path matches any of the allowed patterns for a rule.
     */
    private isPathAllowed;
    /**
     * Matches a path against a glob pattern.
     * Supports simple patterns like "runtime.*" and "security.sandboxMode".
     */
    private pathMatches;
    /**
     * Detects if a configuration path refers to a high-risk object.
     */
    private detectHighRiskObject;
    /**
     * Gets the audit log for querying override history.
     */
    getAuditLog(): ConfigOverrideAuditLog;
    /**
     * Gets the constraint rule for a specific layer.
     */
    getRule(layer: ConfigConstraintLayer): OverrideConstraintRule | undefined;
    /**
     * Updates the constraint rule for a specific layer.
     */
    setRule(layer: ConfigConstraintLayer, rule: OverrideConstraintRule): void;
}
/**
 * Helper function to create a break-glass override record.
 * Break-glass overrides are high-risk emergency overrides that require strong audit.
 */
export declare function createBreakGlassOverride(path: string, value: unknown, reason: string): ConfigOverrideAttempt;
/**
 * Helper function to create a tenant override record.
 */
export declare function createTenantOverride(path: string, value: unknown, tenantId: string): ConfigOverrideAttempt;
/**
 * Helper function to create an environment override record.
 */
export declare function createEnvironmentOverride(path: string, value: unknown, environment: string): ConfigOverrideAttempt;
