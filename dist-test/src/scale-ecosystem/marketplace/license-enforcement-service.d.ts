/**
 * @fileoverview License Enforcement Service
 *
 * Provides runtime license enforcement and metering:
 * - Validates feature access based on license tier
 * - Tracks usage metrics per tenant/workspace
 * - Enforces capability gates at runtime
 * - Logs license violations
 * - Supports usage-based billing tracking
 *
 * @see docs_zh/contracts/enterprise_secret_management_contract.md
 */
import type { LicenseTier } from "./enterprise-capability-matrix-service.js";
import type { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
export type EnforcementAction = "allow" | "deny" | "meter" | "warn";
export interface LicenseCheckResult {
    allowed: boolean;
    action: EnforcementAction;
    tierRequired: LicenseTier;
    currentTier: LicenseTier;
    reason: string;
    capability?: string;
    metadata?: Record<string, unknown>;
}
export interface UsageMeter {
    meterId: string;
    feature: string;
    accountId: string | null;
    workspaceId: string | null;
    tenantId: string | null;
    count: number;
    limit: number | null;
    windowStart: string;
    windowEnd: string | null;
    lastIncrementedAt: string;
}
export interface LicenseViolation {
    id: string;
    accountId: string | null;
    workspaceId: string | null;
    tenantId: string | null;
    capability: string;
    tierRequired: LicenseTier;
    tierActual: LicenseTier;
    action: EnforcementAction;
    occurredAt: string;
    metadata: Record<string, unknown>;
}
export interface FeatureGate {
    featureKey: string;
    requiredTier: LicenseTier;
    enabled: boolean;
    meterUsage: boolean;
    usageLimit: number | null;
    usageWindowMs: number | null;
    warnThreshold: number | null;
}
export interface LicenseEnforcementConfig {
    enabled: boolean;
    strictMode: boolean;
    logViolations: boolean;
    defaultTier: LicenseTier;
    enableUsageMetering: boolean;
}
export declare class LicenseEnforcementService {
    private readonly store;
    private readonly featureGates;
    private readonly usageMeters;
    private readonly violations;
    private readonly config;
    private readonly MAX_USAGE_METERS;
    private readonly METER_TTL_MS;
    private lastMeterEvictionTime;
    private readonly METER_EVICTION_INTERVAL_MS;
    constructor(store: AuthoritativeTaskStore, config?: Partial<LicenseEnforcementConfig>);
    /**
     * C-08: Evict stale usage meters to prevent memory leaks.
     * Removes meters not accessed within TTL and caps at max capacity.
     */
    private evictStaleMeters;
    /**
     * Check if a feature is allowed for the given tier
     */
    checkFeatureAccess(featureKey: string, tier: LicenseTier, context?: {
        accountId?: string | null;
        workspaceId?: string | null;
        tenantId?: string | null;
    }): LicenseCheckResult;
    /**
     * Record usage of a metered feature
     */
    recordFeatureUsage(featureKey: string, context?: {
        accountId?: string | null;
        workspaceId?: string | null;
        tenantId?: string | null;
    }): void;
    /**
     * Get current usage for a feature
     */
    getFeatureUsage(featureKey: string, context?: {
        accountId?: string | null;
        workspaceId?: string | null;
        tenantId?: string | null;
    }): {
        count: number;
        limit: number | null;
        usageRatio: number | null;
    } | null;
    private buildMeterKey;
    private recordViolation;
    getViolations(limit?: number): LicenseViolation[];
    registerFeatureGate(gate: FeatureGate): void;
    getFeatureGate(featureKey: string): FeatureGate | null;
    listFeatureGates(): FeatureGate[];
    enableFeatureGate(featureKey: string): boolean;
    disableFeatureGate(featureKey: string): boolean;
    updateFeatureLimit(featureKey: string, limit: number | null, windowMs: number | null): boolean;
    listActiveMeters(): UsageMeter[];
    resetMeter(featureKey: string, context?: {
        accountId?: string | null;
        workspaceId?: string | null;
        tenantId?: string | null;
    }): boolean;
    getConfig(): LicenseEnforcementConfig;
    isEnabled(): boolean;
    setEnabled(enabled: boolean): void;
    isStrictMode(): boolean;
    setStrictMode(strict: boolean): void;
}
