import type { KnowledgeNamespace } from "../knowledge-model.js";

/**
 * Namespace validation result with policy decision details.
 */
export interface NamespaceValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly namespace: KnowledgeNamespace | null;
}

/**
 * Namespace strategy configuration for §50 knowledge domain isolation.
 *
 * Defines how namespaces interact with cross-domain access,
 * freshness policies, and trust levels.
 */
export interface NamespaceStrategyConfig {
  /** Enable strict isolation between namespaces */
  strictIsolation: boolean;
  /** Allow cross-namespace retrieval with approval */
  crossNamespaceRetrieval: boolean;
  /** Enforce freshness policy on all operations */
  enforceFreshness: boolean;
  /** Minimum trust level for cross-domain access */
  minTrustLevelForCrossDomain: "verified" | "reviewed" | "community" | "unverified";
}

/**
 * Default namespace strategy configuration.
 * §50: moderate isolation with cross-namespace retrieval allowed.
 */
export const DEFAULT_NAMESPACE_STRATEGY: NamespaceStrategyConfig = {
  strictIsolation: false,
  crossNamespaceRetrieval: true,
  enforceFreshness: true,
  minTrustLevelForCrossDomain: "reviewed",
};

/**
 * Namespace conflict detection result.
 */
export interface NamespaceConflict {
  readonly pathA: string;
  readonly pathB: string;
  readonly overlapType: "exact" | "prefix" | "sibling";
  readonly resolution: "allow" | "merge" | "reject";
}

/**
 * Namespace policy store with enhanced §50 strategy support.
 *
 * Provides namespace registration, validation, and conflict detection
 * for knowledge domain isolation.
 */
export class NamespacePolicyStore {
  private readonly namespaces = new Map<string, KnowledgeNamespace>();
  private readonly strategyConfig: NamespaceStrategyConfig;

  constructor(config: Partial<NamespaceStrategyConfig> = {}) {
    this.strategyConfig = { ...DEFAULT_NAMESPACE_STRATEGY, ...config };
  }

  /**
   * Registers a namespace with validation.
   *
   * §50 Strategy: Validates namespace path, freshness policy,
   * and checks for conflicts with existing namespaces.
   */
  public register(namespace: KnowledgeNamespace): KnowledgeNamespace {
    this.validateOrThrow(namespace);
    this.namespaces.set(namespace.path, namespace);
    return namespace;
  }

  /**
   * Gets a namespace by path.
   */
  public get(path: string): KnowledgeNamespace | null {
    return this.namespaces.get(path) ?? null;
  }

  /**
   * Lists all registered namespaces.
   */
  public list(): KnowledgeNamespace[] {
    return [...this.namespaces.values()];
  }

  /**
   * Validates a namespace against §50 strategy constraints.
   *
   * Checks:
   * - Path format validity
   * - Freshness policy configuration
   * - Trust level requirements for cross-domain access
   */
  public validate(namespace: unknown): NamespaceValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!namespace || typeof namespace !== "object") {
      return {
        valid: false,
        errors: ["Namespace must be a non-null object"],
        warnings: [],
        namespace: null,
      };
    }

    const ns = namespace as Record<string, unknown>;

    // Path validation
    if (typeof ns.path !== "string" || ns.path.length === 0) {
      errors.push("Namespace path must be a non-empty string");
    } else if (!this.isValidNamespacePath(ns.path)) {
      errors.push(`Invalid namespace path format: ${ns.path}`);
    }

    // Freshness policy validation
    if (ns.freshnessPolicy && typeof ns.freshnessPolicy === "object") {
      const fp = ns.freshnessPolicy as Record<string, unknown>;
      if (typeof fp.maxAgeDays !== "number" || fp.maxAgeDays <= 0) {
        errors.push("Freshness policy maxAgeDays must be a positive number");
      }
      if (!["warn", "demote", "archive", "delete"].includes(String(fp.staleAction))) {
        errors.push("Freshness policy staleAction must be one of: warn, demote, archive, delete");
      }
    }

    // Trust level validation for cross-domain namespaces
    if (ns.accessPolicy === "restricted" && ns.trustLevel === "unverified") {
      warnings.push("Restricted namespace with unverified trust level may limit cross-domain access");
    }

    // Check for path conflicts
    const conflicts = this.detectPathConflicts(String(ns.path ?? ""));
    if (conflicts.length > 0) {
      warnings.push(`Path conflicts detected: ${conflicts.map((c) => c.pathB).join(", ")}`);
    }

    const validNamespace = errors.length === 0 ? (namespace as KnowledgeNamespace) : null;
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      namespace: validNamespace,
    };
  }

  /**
   * Validates a namespace or throws if invalid.
   */
  private validateOrThrow(namespace: KnowledgeNamespace): void {
    const result = this.validate(namespace);
    if (!result.valid) {
      throw new Error(`Namespace validation failed: ${result.errors.join("; ")}`);
    }
  }

  /**
   * Checks if a namespace path is valid.
   * §50 Strategy: Paths must be lowercase, dot- or slash-separated, and start with domain prefix.
   * Segment names may contain hyphens (e.g., "test/file-default" is valid).
   */
  private isValidNamespacePath(path: string): boolean {
    // Valid path format: domain.subdomain.name or domain/subdomain/name (e.g., "finance.payments.reports" or "test/file-default")
    const pathPattern = /^[a-z][a-z0-9]*([./][a-z][a-z0-9-]*)*$/;
    return pathPattern.test(path);
  }

  /**
   * Detects path conflicts with existing namespaces.
   *
   * Returns conflict information for:
   * - Exact matches (same path)
   * - Prefix conflicts (one path is a prefix of another)
   * - Sibling conflicts (same parent domain)
   */
  public detectPathConflicts(newPath: string): NamespaceConflict[] {
    const conflicts: NamespaceConflict[] = [];

    for (const existingPath of this.namespaces.keys()) {
      if (newPath === existingPath) {
        conflicts.push({
          pathA: newPath,
          pathB: existingPath,
          overlapType: "exact",
          resolution: "reject",
        });
      } else if (newPath.startsWith(existingPath + ".") || existingPath.startsWith(newPath + ".")) {
        conflicts.push({
          pathA: newPath,
          pathB: existingPath,
          overlapType: "prefix",
          resolution: this.strategyConfig.strictIsolation ? "reject" : "allow",
        });
      } else if (this.areSiblingPaths(newPath, existingPath)) {
        conflicts.push({
          pathA: newPath,
          pathB: existingPath,
          overlapType: "sibling",
          resolution: "allow",
        });
      }
    }

    return conflicts;
  }

  /**
   * Checks if two paths are siblings (share the same parent domain).
   */
  private areSiblingPaths(pathA: string, pathB: string): boolean {
    const partsA = pathA.split(".");
    const partsB = pathB.split(".");
    if (partsA.length < 2 || partsB.length < 2) return false;

    // Siblings share all parts except the last
    const parentA = partsA.slice(0, -1).join(".");
    const parentB = partsB.slice(0, -1).join(".");
    return parentA === parentB;
  }

  /**
   * Checks if cross-namespace retrieval is allowed.
   * §50 Strategy: Respects configuration for cross-namespace access.
   */
  public canAccessCrossNamespace(
    sourceNamespace: KnowledgeNamespace,
    targetNamespace: KnowledgeNamespace,
  ): boolean {
    if (!this.strategyConfig.crossNamespaceRetrieval) {
      return false;
    }

    // Cross-domain access requires minimum trust level
    const trustOrder = ["unverified", "community", "reviewed", "verified"];
    const sourceTrustIndex = trustOrder.indexOf(sourceNamespace.trustLevel);
    const requiredIndex = trustOrder.indexOf(this.strategyConfig.minTrustLevelForCrossDomain);

    return sourceTrustIndex >= requiredIndex;
  }

  /**
   * Gets namespaces owned by a specific domain.
   */
  public getByDomain(domainId: string): KnowledgeNamespace[] {
    return this.list().filter((ns) => ns.ownerDomainId === domainId);
  }

  /**
   * Checks if a namespace is stale based on its freshness policy.
   */
  public isStale(namespace: KnowledgeNamespace, lastUpdated: string): boolean {
    const maxAgeMs = namespace.freshnessPolicy.maxAgeDays * 24 * 60 * 60 * 1000;
    const lastUpdateTime = new Date(lastUpdated).getTime();
    return Date.now() - lastUpdateTime > maxAgeMs;
  }

  /**
   * Gets the current strategy configuration.
   */
  public getStrategyConfig(): Readonly<NamespaceStrategyConfig> {
    return { ...this.strategyConfig };
  }

  /**
   * Updates the strategy configuration.
   */
  public updateStrategy(config: Partial<NamespaceStrategyConfig>): void {
    Object.assign(this.strategyConfig, config);
  }
}
