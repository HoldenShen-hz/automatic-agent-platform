/**
 * Config Impact Analyzer
 *
 * Implements §24.4 pre-publish impact analysis gate for configuration changes.
 * Analyzes the blast radius and risk of configuration changes before they are
 * published or rolled out.
 *
 * Features:
 * - Analyzes configuration change impact scope
 * - Identifies affected components and dependencies
 * - Calculates risk scores for changes
 * - Provides recommendations for safe rollout
 */

import { newId } from "../../contracts/types/ids.js";

import { diffObjects, type ConfigDiffEntry } from "./config-governance-support.js";

/**
 * Impact severity levels.
 */
export type ImpactSeverity = "none" | "low" | "medium" | "high" | "critical";

/**
 * Category of impact.
 */
export type ImpactCategory =
  | "security"
  | "performance"
  | "availability"
  | "compliance"
  | "functionality"
  | "configuration";

/**
 * Represents an impacted component.
 */
export interface ImpactedComponent {
  /** Component identifier */
  componentId: string;
  /** Component type */
  componentType: string;
  /** Severity of impact on this component */
  severity: ImpactSeverity;
  /** Reasons for the impact */
  reasons: string[];
  /** Estimated risk score (0-100) */
  riskScore: number;
}

/**
 * Configuration change impact analysis result.
 */
export interface ConfigImpactAnalysis {
  /** Unique analysis ID */
  analysisId: string;
  /** Configuration path that changed */
  configPath: string;
  /** Layer of the changed config */
  layer: string;
  /** Changes that were analyzed */
  changes: ConfigDiffEntry[];
  /** Overall impact severity */
  overallSeverity: ImpactSeverity;
  /** Components affected by the change */
  impactedComponents: ImpactedComponent[];
  /** Blast radius score (0-100) - percentage of system affected */
  blastRadiusScore: number;
  /** Rollback recommendation */
  rollbackRecommended: boolean;
  /** Rollback reason if recommended */
  rollbackReason: string | null;
  /** Suggested rollout strategy */
  recommendedStrategy: RolloutStrategy;
  /** Analysis timestamp */
  analyzedAt: string;
  /** Warnings generated during analysis */
  warnings: string[];
}

/**
 * Recommended rollout strategy based on impact.
 */
export type RolloutStrategy =
  /** Immediate full rollout - only for trivial changes */
  | "immediate"
  /** Standard canary: 5% -> 25% -> 50% -> 100% */
  | "standard_canary"
  /** Conservative canary: 1% -> 5% -> 10% -> 25% -> 50% -> 100% */
  | "conservative_canary"
  /** Feature flag style: 1% -> 5% -> 10% -> 25% -> 50% -> 100% with manual gates */
  | "feature_flag"
  /** Emergency override - rapid full rollout for critical fixes */
  | "emergency_override"
  /** Require manual approval before any rollout */
  | "manual_approval";

/**
 * Options for ConfigImpactAnalyzer.
 */
export interface ConfigImpactAnalyzerOptions {
  /** Risk thresholds for different severity levels */
  riskThresholds?: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  /** Blast radius thresholds for different strategies */
  blastRadiusThresholds?: {
    immediate: number;
    standardCanary: number;
    conservativeCanary: number;
  };
}

/**
 * Security-sensitive configuration keys that have high impact when changed.
 */
const SECURITY_SENSITIVE_KEYS = [
  "sandboxMode",
  "allowDestructiveActions",
  "approvalMode",
  "authentication.enabled",
  "authorization.enabled",
  "encryption.enabled",
  "ssl.enabled",
];

/**
 * Performance-sensitive configuration keys.
 */
const PERFORMANCE_SENSITIVE_KEYS = [
  "maxConcurrentTasks",
  "defaultTaskTimeoutMs",
  "defaultStepTimeoutMs",
  "maxAgentRounds",
  "maxToolCalls",
  "queueSize",
  "poolSize",
];

/**
 * Minimum recommended values for complex workflow execution.
 * Below these thresholds, complex workflows may be silently truncated.
 */
const MIN_RECOMMENDED_MAX_AGENT_ROUNDS = 16;
const MIN_RECOMMENDED_MAX_TOOL_CALLS = 32;

/**
 * Availability-sensitive configuration keys.
 */
const AVAILABILITY_SENSITIVE_KEYS = [
  "failover.enabled",
  "circuitBreaker.enabled",
  "rateLimiting.enabled",
  "circuitBreaker.threshold",
  "healthCheck.interval",
];

/**
 * Service for analyzing the impact of configuration changes.
 * §24.4/R15-74: Implements pre-publish impact analysis gate.
 */
export class ConfigImpactAnalyzer {
  private readonly riskThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  private readonly blastRadiusThresholds: {
    immediate: number;
    standardCanary: number;
    conservativeCanary: number;
  };

  public constructor(options: ConfigImpactAnalyzerOptions = {}) {
    this.riskThresholds = options.riskThresholds ?? {
      low: 20,
      medium: 40,
      high: 60,
      critical: 80,
    };
    this.blastRadiusThresholds = options.blastRadiusThresholds ?? {
      immediate: 5,
      standardCanary: 20,
      conservativeCanary: 50,
    };
  }

  /**
   * Analyzes the impact of a configuration change.
   * §24.4/R15-74: Required pre-publish gate for all config changes.
   *
   * @param configPath - Dot-notation path to the config
   * @param layer - Hierarchy layer
   * @param oldContent - Previous configuration content
   * @param newContent - New configuration content
   * @returns Complete impact analysis
   */
  public analyzeImpact(
    configPath: string,
    layer: string,
    oldContent: Record<string, unknown>,
    newContent: Record<string, unknown>,
  ): ConfigImpactAnalysis {
    const analysisId = newId("impact");
    const changes = diffObjects(oldContent, newContent);

    // Analyze each change for impact
    const impactedComponents = this.analyzeChanges(configPath, layer, changes);
    const overallSeverity = this.calculateOverallSeverity(impactedComponents);
    const blastRadiusScore = this.calculateBlastRadius(impactedComponents);
    const warnings = this.generateWarnings(configPath, layer, changes, impactedComponents);

    // Determine rollback recommendation
    const { rollbackRecommended, rollbackReason } = this.evaluateRollbackRecommendation(
      overallSeverity,
      blastRadiusScore,
      impactedComponents,
    );

    // Determine recommended rollout strategy
    const recommendedStrategy = this.determineRolloutStrategy(
      overallSeverity,
      blastRadiusScore,
      changes,
    );

    return {
      analysisId,
      configPath,
      layer,
      changes,
      overallSeverity,
      impactedComponents,
      blastRadiusScore,
      rollbackRecommended,
      rollbackReason,
      recommendedStrategy,
      analyzedAt: new Date().toISOString(),
      warnings,
    };
  }

  /**
   * Analyzes individual changes for impact.
   */
  private analyzeChanges(
    configPath: string,
    layer: string,
    changes: ConfigDiffEntry[],
  ): ImpactedComponent[] {
    const impactedComponents: ImpactedComponent[] = [];

    for (const change of changes) {
      const categories = this.categorizeChange(change.path, change.changeType);
      const severity = this.calculateChangeSeverity(categories, change);
      const riskScore = this.calculateRiskScore(severity, categories);

      // Group by component - using config path as component identifier
      const componentId = this.extractComponentId(configPath, change.path);
      const existing = impactedComponents.find((c) => c.componentId === componentId);

      if (existing) {
        // Merge impacts
        existing.severity = this.mergeSeverity(existing.severity, severity);
        existing.riskScore = Math.max(existing.riskScore, riskScore);
        existing.reasons.push(...this.getReasonsForChange(change, categories));
      } else {
        impactedComponents.push({
          componentId,
          componentType: this.getComponentType(configPath, layer),
          severity,
          riskScore,
          reasons: this.getReasonsForChange(change, categories),
        });
      }
    }

    return impactedComponents;
  }

  /**
   * Categorizes a change based on the key path.
   */
  private categorizeChange(
    path: string,
    changeType: "added" | "removed" | "changed",
  ): Set<ImpactCategory> {
    const categories = new Set<ImpactCategory>();

    if (SECURITY_SENSITIVE_KEYS.some((key) => path.includes(key))) {
      categories.add("security");
    }

    if (PERFORMANCE_SENSITIVE_KEYS.some((key) => path.includes(key))) {
      categories.add("performance");
    }

    if (AVAILABILITY_SENSITIVE_KEYS.some((key) => path.includes(key))) {
      categories.add("availability");
    }

    if (changeType === "removed") {
      categories.add("functionality");
    }

    // All changes affect configuration
    categories.add("configuration");

    return categories;
  }

  /**
   * Calculates the severity of a change based on its categories.
   */
  private calculateChangeSeverity(
    categories: Set<ImpactCategory>,
    change: ConfigDiffEntry,
  ): ImpactSeverity {
    if (categories.has("security")) {
      return "critical";
    }

    if (categories.has("availability")) {
      return "high";
    }

    if (categories.has("performance")) {
      // Large performance changes are high severity
      if (change.changeType === "changed" && typeof change.beforeValue === "number" && typeof change.afterValue === "number") {
        const ratio = Math.abs(change.afterValue - change.beforeValue) / Math.max(change.beforeValue, 1);
        if (ratio > 0.5) {
          return "high";
        }
        if (ratio > 0.2) {
          return "medium";
        }
      }
      return "medium";
    }

    if (change.changeType === "removed") {
      return "medium";
    }

    if (change.changeType === "added") {
      return "low";
    }

    return "low";
  }

  /**
   * Calculates a risk score (0-100) for a change.
   */
  private calculateRiskScore(
    severity: ImpactSeverity,
    categories: Set<ImpactCategory>,
  ): number {
    let score = 0;

    switch (severity) {
      case "critical":
        score = 100;
        break;
      case "high":
        score = 75;
        break;
      case "medium":
        score = 50;
        break;
      case "low":
        score = 25;
        break;
      case "none":
        score = 0;
        break;
    }

    // Increase score for multiple category impacts
    if (categories.size > 1) {
      score = Math.min(100, score + categories.size * 5);
    }

    return score;
  }

  /**
   * Calculates the overall severity across all impacted components.
   */
  private calculateOverallSeverity(components: ImpactedComponent[]): ImpactSeverity {
    if (components.length === 0) {
      return "none";
    }

    const severities = components.map((c) => c.severity);

    if (severities.includes("critical")) {
      return "critical";
    }

    if (severities.includes("high")) {
      return "high";
    }

    if (severities.includes("medium")) {
      return "medium";
    }

    return "low";
  }

  /**
   * Calculates the blast radius score (0-100).
   */
  private calculateBlastRadius(components: ImpactedComponent[]): number {
    if (components.length === 0) {
      return 0;
    }

    // Simple calculation based on number and severity of impacted components
    const totalRisk = components.reduce((sum, c) => sum + c.riskScore, 0);
    const maxPossibleRisk = components.length * 100;

    return Math.round((totalRisk / maxPossibleRisk) * 100);
  }

  /**
   * Determines the rollout strategy based on impact analysis.
   */
  private determineRolloutStrategy(
    severity: ImpactSeverity,
    blastRadius: number,
    changes: ConfigDiffEntry[],
  ): RolloutStrategy {
    if (severity === "low" && changes.length <= 1) {
      return "immediate";
    }

    // Emergency override for critical security changes
    if (severity === "critical" && changes.some((c) => c.path.includes("security"))) {
      return "emergency_override";
    }

    // Manual approval for critical changes with high blast radius
    if (severity === "critical" && blastRadius > this.blastRadiusThresholds.conservativeCanary) {
      return "manual_approval";
    }

    // Conservative canary for high severity or high blast radius
    if (severity === "high" || blastRadius > this.blastRadiusThresholds.standardCanary) {
      return "conservative_canary";
    }

    // Standard canary for medium severity
    if (severity === "medium" || blastRadius > this.blastRadiusThresholds.immediate) {
      return "standard_canary";
    }

    // Immediate for trivial changes
    return "immediate";
  }

  /**
   * Evaluates whether rollback is recommended.
   */
  private evaluateRollbackRecommendation(
    severity: ImpactSeverity,
    blastRadius: number,
    components: ImpactedComponent[],
  ): { rollbackRecommended: boolean; rollbackReason: string | null } {
    // Critical severity with high blast radius warrants rollback recommendation
    if (severity === "critical" && blastRadius > this.blastRadiusThresholds.conservativeCanary) {
      return {
        rollbackRecommended: true,
        rollbackReason: `Critical change with ${blastRadius}% blast radius exceeds safety threshold`,
      };
    }

    // Check for blocking security changes
    const securityComponents = components.filter((c) =>
      c.reasons.some((r) => r.includes("security"))
    );

    if (securityComponents.length > 0 && severity === "critical") {
      return {
        rollbackRecommended: true,
        rollbackReason: "Security-sensitive configuration change requires manual review",
      };
    }

    return {
      rollbackRecommended: false,
      rollbackReason: null,
    };
  }

  /**
   * Generates warnings based on the analysis.
   */
  private generateWarnings(
    configPath: string,
    layer: string,
    changes: ConfigDiffEntry[],
    components: ImpactedComponent[],
  ): string[] {
    const warnings: string[] = [];

    // Warn about removed keys
    const removedChanges = changes.filter((c) => c.changeType === "removed");
    if (removedChanges.length > 0) {
      warnings.push(`${removedChanges.length} configuration key(s) were removed - verify functionality is not broken`);
    }

    // Warn about security-sensitive changes
    const securityChanges = changes.filter((c) =>
      SECURITY_SENSITIVE_KEYS.some((key) => c.path.includes(key))
    );
    if (securityChanges.length > 0) {
      warnings.push(`security-sensitive keys modified: ${securityChanges.map((c) => c.path).join(", ")}`);
    }

    // Warn about performance-sensitive changes
    const performanceChanges = changes.filter((c) =>
      PERFORMANCE_SENSITIVE_KEYS.some((key) => c.path.includes(key))
    );
    if (performanceChanges.length > 0) {
      warnings.push(`Performance-sensitive keys modified: ${performanceChanges.map((c) => c.path).join(", ")}`);
    }

    // Warn about high blast radius
    if (components.length > 10) {
      warnings.push(`Large number of components affected (${components.length}) - consider conservative rollout`);
    }

    // Warn about potentially too-low limits for complex workflows
    const maxAgentRoundsChange = changes.find((c) => c.path === "maxAgentRounds" && c.changeType === "changed");
    if (maxAgentRoundsChange && typeof maxAgentRoundsChange.afterValue === "number") {
      if (maxAgentRoundsChange.afterValue < MIN_RECOMMENDED_MAX_AGENT_ROUNDS) {
        warnings.push(
          `maxAgentRounds=${maxAgentRoundsChange.afterValue} is below recommended minimum ${MIN_RECOMMENDED_MAX_AGENT_ROUNDS} for complex workflows — workflows may be silently truncated`,
        );
      }
    }

    const maxToolCallsChange = changes.find((c) => c.path === "maxToolCalls" && c.changeType === "changed");
    if (maxToolCallsChange && typeof maxToolCallsChange.afterValue === "number") {
      if (maxToolCallsChange.afterValue < MIN_RECOMMENDED_MAX_TOOL_CALLS) {
        warnings.push(
          `maxToolCalls=${maxToolCallsChange.afterValue} is below recommended minimum ${MIN_RECOMMENDED_MAX_TOOL_CALLS} for complex workflows — workflows may be silently truncated`,
        );
      }
    }

    return warnings;
  }

  /**
   * Extracts a component ID from a config path and change path.
   */
  private extractComponentId(configPath: string, changePath: string): string {
    // Use the change path as the component identifier
    return `${configPath}.${changePath}`;
  }

  /**
   * Gets the component type based on config path and layer.
   */
  private getComponentType(configPath: string, layer: string): string {
    // Map layer to component type
    const layerToType: Record<string, string> = {
      platform: "platform",
      tenant: "tenant",
      pack: "extension_pack",
      task_type: "task_type",
    };

    return layerToType[layer] ?? "unknown";
  }

  /**
   * Gets human-readable reasons for a change.
   */
  private getReasonsForChange(
    change: ConfigDiffEntry,
    categories: Set<ImpactCategory>,
  ): string[] {
    const reasons: string[] = [];

    for (const category of categories) {
      switch (category) {
        case "security":
          reasons.push(`Security-sensitive key changed: ${change.path}`);
          break;
        case "performance":
          reasons.push(`Performance-sensitive key changed: ${change.path}`);
          break;
        case "availability":
          reasons.push(`Availability-sensitive key changed: ${change.path}`);
          break;
        case "functionality":
          reasons.push(`Functionality affected by ${change.changeType}: ${change.path}`);
          break;
        case "configuration":
          if (change.changeType !== "changed") {
            reasons.push(`Configuration ${change.changeType}: ${change.path}`);
          }
          break;
      }
    }

    return [...new Set(reasons)];
  }

  /**
   * Merges two severity levels, returning the higher one.
   */
  private mergeSeverity(a: ImpactSeverity, b: ImpactSeverity): ImpactSeverity {
    const order: ImpactSeverity[] = ["none", "low", "medium", "high", "critical"];
    const aIdx = order.indexOf(a);
    const bIdx = order.indexOf(b);
    const maxIdx = Math.max(aIdx >= 0 ? aIdx : 0, bIdx >= 0 ? bIdx : 0);
    return order[maxIdx] ?? "medium";
  }
}
