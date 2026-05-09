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
 * Constraint layer levels ordered from lowest to highest trust.
 * Higher layers can override lower layers but with more restrictions.
 */
export type ConfigConstraintLayer =
  | "global"
  | "environment"
  | "tenant"
  | "rollout"
  | "break_glass";

/**
 * High-risk configuration objects that should not be silently overridden
 * by low-trust sources.
 */
export type HighRiskConfigObject =
  | "provider_profile"
  | "prompt_bundle"
  | "policy_rule"
  | "feature_flag";

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
  auditRequired?: boolean;
  auditedAt?: string;
  auditDigest?: string;
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
export const DEFAULT_CONSTRAINT_RULES: readonly OverrideConstraintRule[] = [
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
export class InMemoryOverrideAuditLog implements ConfigOverrideAuditLog {
  private records: ConfigOverrideRecord[] = [];

  public record(override: ConfigOverrideRecord): void {
    this.records.push(override);
  }

  public query(filter?: {
    layer?: ConfigConstraintLayer;
    source?: string;
    path?: string;
    startTime?: string;
    endTime?: string;
  }): ConfigOverrideRecord[] {
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

  public clear(): void {
    this.records = [];
  }

  public size(): number {
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
  private readonly rules: Map<ConfigConstraintLayer, OverrideConstraintRule>;
  private readonly auditLog: ConfigOverrideAuditLog;

  constructor(options: ConfigOverrideGovernanceOptions = {}) {
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
  public validateOverride(attempt: ConfigOverrideAttempt): OverrideValidationResult {
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

      const result: OverrideValidationResult = {
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

    const allowedResult: OverrideValidationResult = { allowed: true };
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
  public recordOverride(attempt: ConfigOverrideAttempt): ConfigOverrideRecord {
    const validation = this.validateOverride(attempt);
    const highRiskObject = this.detectHighRiskObject(attempt.path);
    const auditRequired = this.rules.get(attempt.layer)?.requireAudit ?? false;

    const baseRecord: ConfigOverrideRecord = {
      id: generateOverrideId(attempt),
      path: attempt.path,
      layer: attempt.layer,
      source: attempt.source,
      value: attempt.value,
      timestamp: attempt.timestamp,
      allowed: validation.allowed,
      auditRequired,
      auditedAt: nowIso(),
    };

    if (validation.reason !== undefined) {
      baseRecord.reason = validation.reason;
    }

    if (highRiskObject !== undefined) {
      baseRecord.highRiskObject = highRiskObject;
    }
    baseRecord.auditDigest = generateOverrideAuditDigest(baseRecord);

    this.auditLog.record(baseRecord);

    if (!validation.allowed) {
      return baseRecord;
    }

    return baseRecord;
  }

  /**
   * Checks if a path matches any of the allowed patterns for a rule.
   */
  private isPathAllowed(path: string, rule: OverrideConstraintRule): boolean {
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
  private pathMatches(path: string, pattern: string): boolean {
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
  private detectHighRiskObject(path: string): HighRiskConfigObject | undefined {
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
  public getAuditLog(): ConfigOverrideAuditLog {
    return this.auditLog;
  }

  /**
   * Gets the constraint rule for a specific layer.
   */
  public getRule(layer: ConfigConstraintLayer): OverrideConstraintRule | undefined {
    return this.rules.get(layer);
  }

  /**
   * Updates the constraint rule for a specific layer.
   */
  public setRule(layer: ConfigConstraintLayer, rule: OverrideConstraintRule): void {
    this.rules.set(layer, rule);
  }
}

/**
 * Generates a unique ID for an override record.
 */
function generateOverrideId(attempt: ConfigOverrideAttempt): string {
  const content = `${attempt.path}:${attempt.layer}:${attempt.source}:${attempt.timestamp}`;
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function generateOverrideAuditDigest(record: ConfigOverrideRecord): string {
  const content = JSON.stringify({
    id: record.id,
    path: record.path,
    layer: record.layer,
    source: record.source,
    timestamp: record.timestamp,
    allowed: record.allowed,
    reason: record.reason ?? null,
    highRiskObject: record.highRiskObject ?? null,
    auditRequired: record.auditRequired ?? false,
  });
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Helper function to create a break-glass override record.
 * Break-glass overrides are high-risk emergency overrides that require strong audit.
 */
export function createBreakGlassOverride(
  path: string,
  value: unknown,
  reason: string,
): ConfigOverrideAttempt {
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
export function createTenantOverride(
  path: string,
  value: unknown,
  tenantId: string,
): ConfigOverrideAttempt {
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
export function createEnvironmentOverride(
  path: string,
  value: unknown,
  environment: string,
): ConfigOverrideAttempt {
  return {
    path,
    layer: "environment",
    source: `env:${environment}`,
    value,
    timestamp: nowIso(),
  };
}
