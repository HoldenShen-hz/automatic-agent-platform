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
import { createHash } from "node:crypto";
import { nowIso } from "../../contracts/types/ids.js";
/**
 * Default constraint rules for each layer.
 * These define the baseline governance policy.
 */
export const DEFAULT_CONSTRAINT_RULES = [
    {
        layer: "global",
        allowedPaths: ["*"],
        deniedPaths: [],
        highRiskObjectsAllowed: [],
        requireAudit: false,
        failOnUnknownSource: false,
    },
    {
        layer: "environment",
        allowedPaths: ["runtime.*", "security.sandboxMode", "providers.defaultProvider"],
        deniedPaths: ["security.allowDestructiveActions"],
        highRiskObjectsAllowed: [],
        requireAudit: true,
        failOnUnknownSource: false,
    },
    {
        layer: "tenant",
        allowedPaths: ["runtime.*", "security.*", "workflows.*"],
        deniedPaths: ["providers.defaultProvider", "providers.defaultModelProfile"],
        highRiskObjectsAllowed: ["feature_flag"],
        requireAudit: true,
        failOnUnknownSource: true,
    },
    {
        layer: "rollout",
        allowedPaths: ["feature_flag.*", "workflows.*"],
        deniedPaths: ["security.allowDestructiveActions", "security.sandboxMode"],
        highRiskObjectsAllowed: ["feature_flag"],
        requireAudit: true,
        failOnUnknownSource: true,
    },
    {
        layer: "break_glass",
        allowedPaths: ["*"],
        deniedPaths: [],
        highRiskObjectsAllowed: ["provider_profile", "prompt_bundle", "policy_rule", "feature_flag"],
        requireAudit: true,
        failOnUnknownSource: false,
    },
];
/**
 * In-memory audit log implementation.
 */
export class InMemoryOverrideAuditLog {
    records = [];
    record(override) {
        this.records.push(override);
    }
    query(filter) {
        return this.records.filter((record) => {
            if (filter?.layer != null && record.layer !== filter.layer) {
                return false;
            }
            if (filter?.source != null && record.source !== filter.source) {
                return false;
            }
            if (filter?.path != null && !record.path.startsWith(filter.path)) {
                return false;
            }
            if (filter?.startTime != null && record.timestamp < filter.startTime) {
                return false;
            }
            if (filter?.endTime != null && record.timestamp > filter.endTime) {
                return false;
            }
            return true;
        });
    }
    clear() {
        this.records = [];
    }
    size() {
        return this.records.length;
    }
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
export class ConfigOverrideGovernanceService {
    rules;
    auditLog;
    constructor(options = {}) {
        this.rules = new Map();
        for (const rule of options.rules ?? DEFAULT_CONSTRAINT_RULES) {
            this.rules.set(rule.layer, rule);
        }
        this.auditLog = options.auditLog ?? new InMemoryOverrideAuditLog();
    }
    /**
     * Validates whether a configuration override is allowed.
     *
     * @param attempt - The override attempt to validate
     * @returns Validation result indicating if override is allowed
     */
    validateOverride(attempt) {
        const rule = this.rules.get(attempt.layer);
        if (rule == null) {
            return {
                allowed: false,
                reason: `config_override.unknown_layer:${attempt.layer}`,
            };
        }
        if (rule.failOnUnknownSource && !attempt.source) {
            return {
                allowed: false,
                reason: `config_override.missing_source:${attempt.layer}`,
            };
        }
        const pathAllowed = this.isPathAllowed(attempt.path, rule);
        const highRiskObject = this.detectHighRiskObject(attempt.path);
        if (!pathAllowed) {
            if (highRiskObject != null && rule.highRiskObjectsAllowed.includes(highRiskObject)) {
                return {
                    allowed: true,
                    highRiskObject,
                };
            }
            const result = {
                allowed: false,
                reason: `config_override.path_not_allowed:${attempt.path}:${attempt.layer}`,
            };
            if (highRiskObject != null) {
                result.highRiskObject = highRiskObject;
            }
            return result;
        }
        if (highRiskObject != null && !rule.highRiskObjectsAllowed.includes(highRiskObject)) {
            return {
                allowed: false,
                reason: `config_override.high_risk_not_allowed:${highRiskObject}:${attempt.layer}`,
                highRiskObject,
            };
        }
        const allowedResult = { allowed: true };
        if (highRiskObject != null) {
            allowedResult.highRiskObject = highRiskObject;
        }
        return allowedResult;
    }
    /**
     * Records and validates a configuration override attempt.
     *
     * @param attempt - The override attempt to validate
     * @returns The override record with audit information
     */
    recordOverride(attempt) {
        const validation = this.validateOverride(attempt);
        const highRiskObject = this.detectHighRiskObject(attempt.path);
        const baseRecord = {
            id: generateOverrideId(attempt),
            path: attempt.path,
            layer: attempt.layer,
            source: attempt.source,
            value: attempt.value,
            timestamp: attempt.timestamp,
            allowed: validation.allowed,
        };
        if (validation.reason !== undefined) {
            baseRecord.reason = validation.reason;
        }
        if (highRiskObject !== undefined) {
            baseRecord.highRiskObject = highRiskObject;
        }
        this.auditLog.record(baseRecord);
        if (!validation.allowed) {
            return baseRecord;
        }
        const rule = this.rules.get(attempt.layer);
        if (rule?.requireAudit && !validation.allowed) {
            baseRecord.allowed = false;
            baseRecord.reason = `config_override.audit_required:${attempt.path}`;
        }
        return baseRecord;
    }
    /**
     * Checks if a path matches any of the allowed patterns for a rule.
     */
    isPathAllowed(path, rule) {
        if (rule.allowedPaths.includes("*")) {
            return !rule.deniedPaths.some((denied) => this.pathMatches(path, denied));
        }
        const allowed = rule.allowedPaths.some((pattern) => this.pathMatches(path, pattern));
        if (!allowed) {
            return false;
        }
        return !rule.deniedPaths.some((denied) => this.pathMatches(path, denied));
    }
    /**
     * Matches a path against a glob pattern.
     * Supports simple patterns like "runtime.*" and "security.sandboxMode".
     */
    pathMatches(path, pattern) {
        if (pattern === "*") {
            return true;
        }
        if (pattern.endsWith(".*")) {
            const prefix = pattern.slice(0, -2);
            return path === prefix || path.startsWith(prefix + ".");
        }
        return path === pattern;
    }
    /**
     * Detects if a configuration path refers to a high-risk object.
     */
    detectHighRiskObject(path) {
        const lowerPath = path.toLowerCase();
        if (lowerPath.includes("provider") && lowerPath.includes("profile")) {
            return "provider_profile";
        }
        if (lowerPath.includes("prompt") && lowerPath.includes("bundle")) {
            return "prompt_bundle";
        }
        if (lowerPath.includes("policy") && lowerPath.includes("rule")) {
            return "policy_rule";
        }
        if (lowerPath.includes("feature") && lowerPath.includes("flag")) {
            return "feature_flag";
        }
        return undefined;
    }
    /**
     * Gets the audit log for querying override history.
     */
    getAuditLog() {
        return this.auditLog;
    }
    /**
     * Gets the constraint rule for a specific layer.
     */
    getRule(layer) {
        return this.rules.get(layer);
    }
    /**
     * Updates the constraint rule for a specific layer.
     */
    setRule(layer, rule) {
        this.rules.set(layer, rule);
    }
}
/**
 * Generates a unique ID for an override record.
 */
function generateOverrideId(attempt) {
    const content = `${attempt.path}:${attempt.layer}:${attempt.source}:${attempt.timestamp}`;
    return createHash("sha256").update(content).digest("hex").slice(0, 16);
}
/**
 * Helper function to create a break-glass override record.
 * Break-glass overrides are high-risk emergency overrides that require strong audit.
 */
export function createBreakGlassOverride(path, value, reason) {
    return {
        path,
        layer: "break_glass",
        source: reason,
        value,
        timestamp: nowIso(),
    };
}
/**
 * Helper function to create a tenant override record.
 */
export function createTenantOverride(path, value, tenantId) {
    return {
        path,
        layer: "tenant",
        source: `tenant:${tenantId}`,
        value,
        timestamp: nowIso(),
    };
}
/**
 * Helper function to create an environment override record.
 */
export function createEnvironmentOverride(path, value, environment) {
    return {
        path,
        layer: "environment",
        source: `env:${environment}`,
        value,
        timestamp: nowIso(),
    };
}
//# sourceMappingURL=config-override-governance.js.map