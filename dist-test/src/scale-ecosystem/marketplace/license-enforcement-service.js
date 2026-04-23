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
import { BoundedCache } from "../../platform/shared/utils/bounded-cache.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
// ── Feature Gates ─────────────────────────────────────────────────────
const DEFAULT_FEATURE_GATES = [
    {
        featureKey: "admin_console",
        requiredTier: "professional",
        enabled: true,
        meterUsage: false,
        usageLimit: null,
        usageWindowMs: null,
        warnThreshold: null,
    },
    {
        featureKey: "audit_export",
        requiredTier: "enterprise",
        enabled: true,
        meterUsage: true,
        usageLimit: 1000,
        usageWindowMs: 24 * 60 * 60 * 1000, // daily
        warnThreshold: 0.8,
    },
    {
        featureKey: "sso",
        requiredTier: "enterprise",
        enabled: true,
        meterUsage: false,
        usageLimit: null,
        usageWindowMs: null,
        warnThreshold: null,
    },
    {
        featureKey: "scim",
        requiredTier: "enterprise",
        enabled: true,
        meterUsage: true,
        usageLimit: 5000,
        usageWindowMs: 24 * 60 * 60 * 1000,
        warnThreshold: 0.8,
    },
    {
        featureKey: "tenant_isolation",
        requiredTier: "enterprise",
        enabled: true,
        meterUsage: false,
        usageLimit: null,
        usageWindowMs: null,
        warnThreshold: null,
    },
    {
        featureKey: "private_model",
        requiredTier: "enterprise",
        enabled: true,
        meterUsage: true,
        usageLimit: 10000,
        usageWindowMs: 60 * 60 * 1000, // hourly
        warnThreshold: 0.8,
    },
    {
        featureKey: "private_network_deployment",
        requiredTier: "enterprise",
        enabled: true,
        meterUsage: false,
        usageLimit: null,
        usageWindowMs: null,
        warnThreshold: null,
    },
    {
        featureKey: "rollout_and_rollback",
        requiredTier: "enterprise",
        enabled: true,
        meterUsage: false,
        usageLimit: null,
        usageWindowMs: null,
        warnThreshold: null,
    },
    {
        featureKey: "incident_console",
        requiredTier: "enterprise",
        enabled: true,
        meterUsage: true,
        usageLimit: 500,
        usageWindowMs: 60 * 60 * 1000, // hourly
        warnThreshold: 0.8,
    },
    {
        featureKey: "data_residency_controls",
        requiredTier: "enterprise",
        enabled: true,
        meterUsage: false,
        usageLimit: null,
        usageWindowMs: null,
        warnThreshold: null,
    },
    {
        featureKey: "cross_region_failover",
        requiredTier: "enterprise",
        enabled: true,
        meterUsage: true,
        usageLimit: 50,
        usageWindowMs: 24 * 60 * 60 * 1000, // daily
        warnThreshold: 0.8,
    },
    {
        featureKey: "hot_upgrade",
        requiredTier: "enterprise",
        enabled: true,
        meterUsage: true,
        usageLimit: 100,
        usageWindowMs: 24 * 60 * 60 * 1000,
        warnThreshold: 0.8,
    },
];
// ── Tier Comparison ────────────────────────────────────────────────────
const TIER_ORDER = {
    community: 0,
    professional: 1,
    enterprise: 2,
};
function compareTier(left, right) {
    return TIER_ORDER[left] - TIER_ORDER[right];
}
// ── Service ────────────────────────────────────────────────────────────
export class LicenseEnforcementService {
    store;
    featureGates = new BoundedCache(100);
    usageMeters = new BoundedCache(200);
    violations = [];
    config;
    // C-08: TTL-based eviction for usage meters
    MAX_USAGE_METERS = 10000;
    METER_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
    lastMeterEvictionTime = 0;
    METER_EVICTION_INTERVAL_MS = 60 * 60 * 1000; // Once per hour
    constructor(store, config) {
        this.store = store;
        this.config = {
            enabled: config?.enabled ?? true,
            strictMode: config?.strictMode ?? false,
            logViolations: config?.logViolations ?? true,
            defaultTier: config?.defaultTier ?? "community",
            enableUsageMetering: config?.enableUsageMetering ?? true,
        };
        // Initialize default feature gates
        for (const gate of DEFAULT_FEATURE_GATES) {
            this.featureGates.set(gate.featureKey, { ...gate });
        }
    }
    /**
     * C-08: Evict stale usage meters to prevent memory leaks.
     * Removes meters not accessed within TTL and caps at max capacity.
     */
    evictStaleMeters() {
        const now = Date.now();
        if (now - this.lastMeterEvictionTime < this.METER_EVICTION_INTERVAL_MS) {
            return;
        }
        this.lastMeterEvictionTime = now;
        const staleThreshold = now - this.METER_TTL_MS;
        let evicted = 0;
        for (const [key, meter] of this.usageMeters) {
            const lastAccess = new Date(meter.lastIncrementedAt).getTime();
            if (lastAccess < staleThreshold) {
                this.usageMeters.delete(key);
                evicted++;
            }
        }
        // If still over capacity after TTL eviction, remove oldest entries
        if (this.usageMeters.size > this.MAX_USAGE_METERS) {
            const sortedEntries = [...this.usageMeters.entries()].sort((a, b) => {
                const aTime = new Date(a[1].lastIncrementedAt).getTime();
                const bTime = new Date(b[1].lastIncrementedAt).getTime();
                return aTime - bTime; // Oldest first
            });
            const toRemove = this.usageMeters.size - this.MAX_USAGE_METERS;
            for (let i = 0; i < toRemove; i++) {
                this.usageMeters.delete(sortedEntries[i][0]);
            }
        }
    }
    // ── Core Enforcement ────────────────────────────────────────────────
    /**
     * Check if a feature is allowed for the given tier
     */
    checkFeatureAccess(featureKey, tier, context) {
        if (!this.config.enabled) {
            return {
                allowed: true,
                action: "allow",
                tierRequired: "community",
                currentTier: tier,
                reason: "enforcement_disabled",
            };
        }
        const gate = this.featureGates.get(featureKey);
        if (!gate || !gate.enabled) {
            return {
                allowed: false,
                action: "deny",
                tierRequired: "enterprise",
                currentTier: tier,
                reason: "feature_not_found_or_disabled",
                capability: featureKey,
            };
        }
        const tierComparison = compareTier(tier, gate.requiredTier);
        if (tierComparison < 0) {
            const result = {
                allowed: false,
                action: this.config.strictMode ? "deny" : "warn",
                tierRequired: gate.requiredTier,
                currentTier: tier,
                reason: `tier_insufficient:${gate.requiredTier}_required`,
                capability: featureKey,
            };
            this.recordViolation(featureKey, tier, gate.requiredTier, result.action, context);
            return result;
        }
        // Check usage metering if enabled
        if (this.config.enableUsageMetering && gate.meterUsage) {
            const meterKey = this.buildMeterKey(featureKey, context);
            const meter = this.usageMeters.get(meterKey);
            if (meter && meter.limit != null) {
                const usageRatio = meter.count / meter.limit;
                if (meter.count >= meter.limit) {
                    const result = {
                        allowed: false,
                        action: "deny",
                        tierRequired: gate.requiredTier,
                        currentTier: tier,
                        reason: `usage_limit_exceeded:${meter.count}/${meter.limit}`,
                        capability: featureKey,
                    };
                    this.recordViolation(featureKey, tier, gate.requiredTier, "deny", context);
                    return result;
                }
                if (gate.warnThreshold != null && usageRatio >= gate.warnThreshold) {
                    return {
                        allowed: true,
                        action: "warn",
                        tierRequired: gate.requiredTier,
                        currentTier: tier,
                        reason: `usage_threshold_warning:${usageRatio.toFixed(2)}`,
                        capability: featureKey,
                        metadata: { usageRatio, meterCount: meter.count, meterLimit: meter.limit },
                    };
                }
            }
        }
        return {
            allowed: true,
            action: "meter",
            tierRequired: gate.requiredTier,
            currentTier: tier,
            reason: "access_granted",
            capability: featureKey,
        };
    }
    /**
     * Record usage of a metered feature
     */
    recordFeatureUsage(featureKey, context) {
        if (!this.config.enableUsageMetering)
            return;
        const gate = this.featureGates.get(featureKey);
        if (!gate || !gate.meterUsage)
            return;
        const meterKey = this.buildMeterKey(featureKey, context);
        let meter = this.usageMeters.get(meterKey);
        const now = nowIso();
        if (!meter) {
            const windowEnd = gate.usageWindowMs
                ? new Date(Date.now() + gate.usageWindowMs).toISOString()
                : null;
            meter = {
                meterId: newId("meter"),
                feature: featureKey,
                accountId: context?.accountId ?? null,
                workspaceId: context?.workspaceId ?? null,
                tenantId: context?.tenantId ?? null,
                count: 0,
                limit: gate.usageLimit,
                windowStart: now,
                windowEnd,
                lastIncrementedAt: now,
            };
        }
        // Check if window has expired and reset if needed
        if (meter.windowEnd && new Date(meter.windowEnd) <= new Date(now)) {
            meter.count = 0;
            meter.windowStart = now;
            meter.windowEnd = gate.usageWindowMs
                ? new Date(Date.now() + gate.usageWindowMs).toISOString()
                : null;
        }
        meter.count += 1;
        meter.lastIncrementedAt = now;
        // C-08: Evict stale meters before writing to prevent unbounded growth
        this.evictStaleMeters();
        this.usageMeters.set(meterKey, meter);
    }
    /**
     * Get current usage for a feature
     */
    getFeatureUsage(featureKey, context) {
        const meterKey = this.buildMeterKey(featureKey, context);
        const meter = this.usageMeters.get(meterKey);
        if (!meter) {
            const gate = this.featureGates.get(featureKey);
            if (!gate || !gate.meterUsage)
                return null;
            return { count: 0, limit: gate.usageLimit, usageRatio: null };
        }
        return {
            count: meter.count,
            limit: meter.limit,
            usageRatio: meter.limit != null ? meter.count / meter.limit : null,
        };
    }
    buildMeterKey(featureKey, context) {
        return [
            featureKey,
            context?.accountId ?? "global",
            context?.workspaceId ?? "global",
            context?.tenantId ?? "global",
        ].join(":");
    }
    recordViolation(featureKey, actualTier, requiredTier, action, context) {
        if (!this.config.logViolations)
            return;
        const violation = {
            id: newId("lv"),
            accountId: context?.accountId ?? null,
            workspaceId: context?.workspaceId ?? null,
            tenantId: context?.tenantId ?? null,
            capability: featureKey,
            tierRequired: requiredTier,
            tierActual: actualTier,
            action,
            occurredAt: nowIso(),
            metadata: {},
        };
        this.violations.push(violation);
        // Keep bounded
        if (this.violations.length > 1000) {
            this.violations.splice(0, this.violations.length - 1000);
        }
    }
    getViolations(limit = 100) {
        return this.violations.slice(-limit);
    }
    // ── Feature Gate Management ────────────────────────────────────────
    registerFeatureGate(gate) {
        this.featureGates.set(gate.featureKey, { ...gate });
    }
    getFeatureGate(featureKey) {
        return this.featureGates.get(featureKey) ?? null;
    }
    listFeatureGates() {
        return [...this.featureGates.values()];
    }
    enableFeatureGate(featureKey) {
        const gate = this.featureGates.get(featureKey);
        if (gate) {
            gate.enabled = true;
            return true;
        }
        return false;
    }
    disableFeatureGate(featureKey) {
        const gate = this.featureGates.get(featureKey);
        if (gate) {
            gate.enabled = false;
            return true;
        }
        return false;
    }
    updateFeatureLimit(featureKey, limit, windowMs) {
        const gate = this.featureGates.get(featureKey);
        if (gate) {
            gate.usageLimit = limit;
            gate.usageWindowMs = windowMs;
            return true;
        }
        return false;
    }
    // ── Usage Meters ───────────────────────────────────────────────────
    listActiveMeters() {
        return [...this.usageMeters.values()];
    }
    resetMeter(featureKey, context) {
        const meterKey = this.buildMeterKey(featureKey, context);
        if (this.usageMeters.has(meterKey)) {
            this.usageMeters.delete(meterKey);
            return true;
        }
        return false;
    }
    // ── Configuration ─────────────────────────────────────────────────
    getConfig() {
        return { ...this.config };
    }
    isEnabled() {
        return this.config.enabled;
    }
    setEnabled(enabled) {
        this.config.enabled = enabled;
    }
    isStrictMode() {
        return this.config.strictMode;
    }
    setStrictMode(strict) {
        this.config.strictMode = strict;
    }
}
//# sourceMappingURL=license-enforcement-service.js.map