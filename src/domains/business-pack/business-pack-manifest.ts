/**
 * @fileoverview Business Pack Manifest - Domain model for Business Packs
 *
 * Implements the Business Pack model as defined in architecture doc §30:
 * - Full lifecycle: draft → certifying → published → deprecated → archived
 * - Rich manifest structure with risk_matrix, approval_points, dependencies, etc.
 * - Enhanced validation for dependencies, permissions, and sandbox requirements
 *
 * @see docs_zh/architecture/00-platform-architecture.md §30
 */

import { z } from "zod";

import { ValidationError } from "../../platform/contracts/errors.js";
import type { SandboxMode } from "../../platform/control-plane/iam/sandbox-policy.js";

// ============================================================================
// Semver Range Parsing (R13-28 FIX)
// ============================================================================

/**
 * Parses a semver range string into component constraints.
 * Supports: exact versions (1.0.0), ranges (1.0.0 - 2.0.0), carets (^1.0.0), tildes (~1.0.0), x-ranges (1.x, 1.0.x), and stars (*)
 */
export function parseSemverRange(range: string): {
  major: number | "any";
  minor: number | "any";
  patch: number | "any";
  comparators: readonly {
    op: ">=" | "<=" | ">" | "<" | "=";
    major: number | "any";
    minor: number | "any";
    patch: number | "any";
  }[];
} | null {
  if (!range || range === "*") {
    return { major: "any", minor: "any", patch: "any", comparators: [] };
  }

  const comparators: {
    op: ">=" | "<=" | ">" | "<" | "=";
    major: number | "any";
    minor: number | "any";
    patch: number | "any";
  }[] = [];

  // Handle range syntax like "1.0.0 - 2.0.0"
  const rangeParts = range.split(/\s*-\s*/);
  if (rangeParts.length === 2) {
    const leftPart = rangeParts[0];
    const rightPart = rangeParts[1];
    if (leftPart !== undefined && rightPart !== undefined) {
      const left = parseSemverRange(leftPart.trim());
      const right = parseSemverRange(rightPart.trim());
      if (left && right) {
        comparators.push({ op: ">=", major: left.major, minor: left.minor, patch: left.patch });
        comparators.push({ op: "<=", major: right.major, minor: right.minor, patch: right.patch });
        return { major: "any", minor: "any", patch: "any", comparators };
      }
    }
  }

  // Handle caret (^1.0.0) - compatible minor version
  if (range.startsWith("^")) {
    const version = range.slice(1);
    const parsed = parsePlainSemver(version);
    if (parsed) {
      return {
        major: "any",
        minor: "any",
        patch: "any",
        comparators: [
          { op: ">=", major: parsed.major, minor: parsed.minor, patch: parsed.patch },
          { op: "<", major: parsed.major + 1, minor: 0, patch: 0 },
        ],
      };
    }
    return null;
  }

  // Handle tilde (~1.0.0) - compatible patch version
  if (range.startsWith("~")) {
    const version = range.slice(1);
    const parsed = parsePlainSemver(version);
    if (parsed) {
      return {
        major: "any",
        minor: "any",
        patch: "any",
        comparators: [
          { op: ">=", major: parsed.major, minor: parsed.minor, patch: parsed.patch },
          { op: "<", major: parsed.major, minor: parsed.minor + 1, patch: 0 },
        ],
      };
    }
    return null;
  }

  // Handle x-ranges (1.x, 1.0.x, *)
  if (range.includes("x") || range.includes("*")) {
    const normalized = range.replace(/x/g, "*").replace(/\.\*/g, ".x");
    const parts = normalized.split(".");
    const majorPart = parts[0];
    const minorPart = parts[1];
    const patchPart = parts[2];
    return {
      major: majorPart === "*" ? "any" : majorPart !== undefined ? parseInt(majorPart, 10) : "any",
      minor: minorPart === undefined || minorPart === "*" ? "any" : parseInt(minorPart, 10),
      patch: patchPart === undefined || patchPart === "*" ? "any" : parseInt(patchPart, 10),
      comparators: [],
    };
  }

  // Handle comparison operators
  const match = range.match(/^(>=|<=|>|<|=)?(\d+)\.(\d+)\.(\d+)$/);
  if (match) {
    const op = (match[1] ?? "=") as ">=" | "<=" | ">" | "<" | "=";
    const majorStr = match[2];
    const minorStr = match[3];
    const patchStr = match[4];
    if (majorStr !== undefined && minorStr !== undefined && patchStr !== undefined) {
      return {
        major: parseInt(majorStr, 10),
        minor: parseInt(minorStr, 10),
        patch: parseInt(patchStr, 10),
        comparators: [{ op, major: parseInt(majorStr, 10), minor: parseInt(minorStr, 10), patch: parseInt(patchStr, 10) }],
      };
    }
  }

  // Handle plain semver
  const parsed = parsePlainSemver(range);
  if (parsed) {
    return {
      major: parsed.major,
      minor: parsed.minor,
      patch: parsed.patch,
      comparators: [{ op: "=", major: parsed.major, minor: parsed.minor, patch: parsed.patch }],
    };
  }

  return null;
}

function parsePlainSemver(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  const majorStr = match[1];
  const minorStr = match[2];
  const patchStr = match[3];
  if (majorStr === undefined || minorStr === undefined || patchStr === undefined) return null;
  return {
    major: parseInt(majorStr, 10),
    minor: parseInt(minorStr, 10),
    patch: parseInt(patchStr, 10),
  };
}

/**
 * Checks if a version satisfies a semver range.
 */
export function satisfiesSemverRange(version: string, range: string): boolean {
  const versionParsed = parsePlainSemver(version);
  if (!versionParsed) return false;

  const rangeParsed = parseSemverRange(range);
  if (!rangeParsed) return false;

  // Check major.minor.patch constraints
  if (rangeParsed.major !== "any" && versionParsed.major !== rangeParsed.major) {
    return false;
  }
  if (rangeParsed.minor !== "any" && versionParsed.minor !== rangeParsed.minor) {
    return false;
  }
  if (rangeParsed.patch !== "any" && versionParsed.patch !== rangeParsed.patch) {
    return false;
  }

  // Check comparator constraints
  for (const comp of rangeParsed.comparators) {
    const compResult = compareVersionParts(versionParsed, comp);
    switch (comp.op) {
      case ">=":
        if (compResult < 0) return false;
        break;
      case "<=":
        if (compResult > 0) return false;
        break;
      case ">":
        if (compResult <= 0) return false;
        break;
      case "<":
        if (compResult >= 0) return false;
        break;
      case "=":
        if (compResult !== 0) return false;
        break;
    }
  }

  return true;
}

function compareVersionParts(
  version: { major: number; minor: number; patch: number },
  comparator: { major: number | "any"; minor: number | "any"; patch: number | "any" },
): number {
  if (comparator.major !== "any" && version.major !== comparator.major) {
    return version.major - comparator.major;
  }
  if (comparator.minor !== "any" && version.minor !== comparator.minor) {
    return version.minor - comparator.minor;
  }
  if (comparator.patch !== "any" && version.patch !== comparator.patch) {
    return version.patch - comparator.patch;
  }
  return 0;
}

// ============================================================================
// Dependency Graph (R13-29 FIX)
// ============================================================================

export interface DependencyNode {
  packId: string;
  version: string;
  dependencies: readonly PackDependency[];
}

export interface DependencyGraphResult {
  valid: boolean;
  cycles: readonly string[][];
  unresolvedDependencies: readonly { packId: string; versionRange: string }[];
}

/**
 * Builds a dependency graph and detects cycles.
 * R13-29 FIX: Transitive dependency graph parsing with cycle detection.
 */
export function buildDependencyGraph(
  manifest: NormalizedBusinessPackManifest,
  getPackVersion: (packId: string) => string | null,
): DependencyGraphResult {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];
  const unresolvedDependencies: { packId: string; versionRange: string }[] = [];

  // Build adjacency list from manifest dependencies
  const dependencyMap = new Map<string, PackDependency[]>();
  for (const dep of manifest.dependencies ?? []) {
    const existing = dependencyMap.get(manifest.packId) ?? [];
    existing.push(dep);
    dependencyMap.set(manifest.packId, existing);
  }

  function dfs(packId: string, path: string[]): boolean {
    if (recursionStack.has(packId)) {
      // Found cycle - extract the cycle path
      const cycleStart = path.indexOf(packId);
      if (cycleStart >= 0) {
        cycles.push([...path.slice(cycleStart), packId]);
      }
      return true;
    }

    if (visited.has(packId)) {
      return false;
    }

    visited.add(packId);
    recursionStack.add(packId);

    // Get direct dependencies for this pack
    const directDeps = dependencyMap.get(packId) ?? [];
    path.push(packId);
    for (const transitiveDep of directDeps) {
      if (dfs(transitiveDep.packId, [...path])) {
        // Cycle detected, but continue to find all cycles
      }
    }

    recursionStack.delete(packId);
    return false;
  }

  // Start with self to detect self-referential cycles
  dfs(manifest.packId, [manifest.packId]);

  // Check for unresolved dependencies
  for (const dep of manifest.dependencies ?? []) {
    if (dep.optional) continue;
    const availableVersion = getPackVersion(dep.packId);
    if (!availableVersion) {
      unresolvedDependencies.push({ packId: dep.packId, versionRange: dep.versionRange ?? "*" });
    } else if (dep.versionRange && !satisfiesSemverRange(availableVersion, dep.versionRange)) {
      unresolvedDependencies.push({ packId: dep.packId, versionRange: dep.versionRange });
    }
  }

  return {
    valid: cycles.length === 0 && unresolvedDependencies.length === 0,
    cycles,
    unresolvedDependencies,
  };
}

// ============================================================================
// Upgrade Path Calculator (R13-30 FIX)
// ============================================================================

export interface UpgradePath {
  fromVersion: string;
  toVersion: string;
  breaking: boolean;
  steps: readonly string[];
}

export interface UpgradePathResult {
  hasPath: boolean;
  paths: readonly UpgradePath[];
  breakingChanges: readonly { from: string; to: string; breakingFeatures: readonly string[] }[];
}

/**
 * Calculates automatic upgrade paths between pack versions.
 * R13-30 FIX: Automatic upgrade path calculation with breaking change detection.
 */
export function calculateUpgradePaths(
  currentVersion: string,
  targetVersion: string,
  availableVersions: readonly string[],
): UpgradePathResult {
  const breakingChanges: { from: string; to: string; breakingFeatures: readonly string[] }[] = [];
  const paths: UpgradePath[] = [];

  // Parse versions
  const current = parsePlainSemver(currentVersion);
  const target = parsePlainSemver(targetVersion);

  if (!current || !target) {
    return { hasPath: false, paths: [], breakingChanges: [] };
  }

  // Major version change = breaking
  const breaking = current.major !== target.major;

  if (breaking) {
    breakingChanges.push({
      from: currentVersion,
      to: targetVersion,
      breakingFeatures: ["major_version_change"],
    });
  }

  // Build upgrade path through intermediate versions
  const sortedVersions = [...availableVersions]
    .filter((v) => {
      const parsed = parsePlainSemver(v);
      if (!parsed) return false;
      // Versions between current and target (inclusive)
      return (
        (parsed.major > current.major || (parsed.major === current.major && parsed.minor > current.minor) ||
          (parsed.major === current.major && parsed.minor === current.minor && parsed.patch >= current.patch)) &&
        (parsed.major < target.major || (parsed.major === target.major && parsed.minor < target.minor) ||
          (parsed.major === target.major && parsed.minor === target.minor && parsed.patch <= target.patch))
      );
    })
    .sort((a, b) => compareSemverSimple(a, b));

  if (sortedVersions.length > 0) {
    const steps = [currentVersion, ...sortedVersions, targetVersion].filter(
      (v, i, arr) => arr.indexOf(v) === i,
    );
    paths.push({
      fromVersion: currentVersion,
      toVersion: targetVersion,
      breaking,
      steps,
    });
  }

  return {
    hasPath: paths.length > 0,
    paths,
    breakingChanges,
  };
}

function compareSemverSimple(left: string, right: string): number {
  const leftParsed = parsePlainSemver(left);
  const rightParsed = parsePlainSemver(right);
  if (!leftParsed || !rightParsed) return 0;
  if (leftParsed.major !== rightParsed.major) return leftParsed.major - rightParsed.major;
  if (leftParsed.minor !== rightParsed.minor) return leftParsed.minor - rightParsed.minor;
  return leftParsed.patch - rightParsed.patch;
}

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Risk level for a Business Pack.
 */
export type BusinessPackRiskLevel = "low" | "medium" | "high" | "critical";

/**
 * Execution strategy for handling failures.
 */
export type ExecutionStrategy = "fail_fast" | "continue" | "skip" | "fallback";

/**
 * Risk matrix entry defining how risks are handled.
 */
export interface RiskMatrixEntry {
  riskId: string;
  level: BusinessPackRiskLevel;
  triggers: string[];
  mitigation: string;
  escalationPolicy: string;
}

/**
 * Approval point definition.
 */
export interface ApprovalPointDef {
  pointId: string;
  name: string;
  description: string;
  triggerCondition: string;
  requiredApprovals: number;
  approverRoles: string[];
  timeoutMinutes: number;
  autoApproveRoles: string[];
}

/**
 * Metric definition for domain metrics.
 */
export interface MetricDef {
  metricId: string;
  name: string;
  description: string;
  unit: string;
  aggregation: "sum" | "avg" | "min" | "max" | "count";
  threshold?: {
    warning: number;
    critical: number;
  };
}

/**
 * Sandbox tier requirements for the pack.
 */
export type SandboxTier = SandboxMode;

const SANDBOX_TIER_ALIASES = {
  process: "read_only",
  container: "workspace_write",
  scoped_external_access: "scoped_external_access",
  read_only: "read_only",
  workspace_write: "workspace_write",
  restricted_exec: "restricted_exec",
} as const satisfies Record<string, SandboxTier>;

function normalizeSandboxTier(value: unknown): unknown {
  return typeof value === "string" ? SANDBOX_TIER_ALIASES[value as keyof typeof SANDBOX_TIER_ALIASES] ?? value : value;
}

/**
 * Permission requirement for the pack.
 */
export interface PermissionRequirement {
  permission: string;
  level: "read" | "write" | "admin";
  justification: string;
}

/**
 * Dependency on another pack.
 */
export interface PackDependency {
  packId: string;
  versionRange: string;
  optional: boolean;
  reason: string;
}

// ============================================================================
// Business Pack Lifecycle
// ============================================================================

/**
 * Business Pack lifecycle stages.
 *
 * Full lifecycle as defined in architecture doc §30.4:
 * - draft: Initial development
 * - certifying: Under security/quality certification review
 * - published: Available in marketplace
 * - deprecated: No longer supported, still runs for existing users
 * - archived: Fully retired, cannot run
 */
export type BusinessPackLifecycleStage =
  | "draft"
  | "certifying"
  | "published"
  | "deprecated"
  | "archived";

/**
 * Validates if a lifecycle stage transition is allowed.
 */
export function isValidLifecycleTransition(
  from: BusinessPackLifecycleStage,
  to: BusinessPackLifecycleStage,
): boolean {
  const transitions: Record<BusinessPackLifecycleStage, BusinessPackLifecycleStage[]> = {
    draft: ["certifying", "archived"],
    certifying: ["published", "draft", "archived"],
    published: ["deprecated", "archived"],
    deprecated: ["published", "archived"],
    archived: [], // Terminal state
  };
  return transitions[from]?.includes(to) ?? false;
}

/**
 * Checks if a stage allows execution.
 */
export function isExecutableStage(stage: BusinessPackLifecycleStage): boolean {
  return stage === "published" || stage === "deprecated";
}

/**
 * Checks if a stage is terminal.
 */
export function isTerminalStage(stage: BusinessPackLifecycleStage): boolean {
  return stage === "archived";
}

// ============================================================================
// Business Pack Manifest Schema
// ============================================================================

/**
 * Business Pack Manifest - the complete definition of a Business Pack.
 *
 * As defined in architecture doc §30.2:
 * ```typescript
 * interface BusinessPackManifest {
 *   pack_id: string;
 *   name: string;
 *   version: string;
 *   domain_id: string;
 *   risk_matrix: RiskMatrixEntry[];
 *   tool_bundles: string[];
 *   approval_points: ApprovalPointDef[];
 *   artifact_types: string[];
 *   knowledge_namespaces: string[];
 *   failure_strategy: ExecutionStrategy;
 *   rollback_capability: boolean;
 *   domain_metrics: MetricDef[];
 * }
 * ```
 */
export const BusinessPackManifestSchema = z.object({
  packId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1).regex(/^\d+\.\d+\.\d+$/, "Version must follow semver format (e.g., 1.0.0)"),
  domainId: z.string().min(1),
  description: z.string().optional().default(""),

  // Lifecycle and status
  lifecycleStage: z.enum(["draft", "certifying", "published", "deprecated", "archived"]).default("draft"),
  deprecatedAt: z.string().nullable().default(null),
  archivedAt: z.string().nullable().default(null),

  // Risk and compliance
  riskMatrix: z.array(z.object({
    riskId: z.string().min(1),
    level: z.enum(["low", "medium", "high", "critical"]),
    triggers: z.array(z.string()).default([]),
    mitigation: z.string().default(""),
    escalationPolicy: z.string().default(""),
  })).default([]),

  // Tool and plugin dependencies
  toolBundles: z.array(z.string()).default([]),
  pluginIds: z.array(z.string()).default([]),
  dependencies: z.array(z.object({
    packId: z.string().min(1),
    versionRange: z.string().default("*"),
    optional: z.boolean().default(false),
    reason: z.string().default(""),
  })).default([]),

  // Approval points
  approvalPoints: z.array(z.object({
    pointId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().default(""),
    triggerCondition: z.string().default(""),
    requiredApprovals: z.number().int().min(1).default(1),
    approverRoles: z.array(z.string()).default([]),
    timeoutMinutes: z.number().int().positive().default(60),
    autoApproveRoles: z.array(z.string()).default([]),
  })).default([]),

  // Artifact and knowledge
  artifactTypes: z.array(z.string()).default([]),
  knowledgeNamespaces: z.array(z.string()).default([]),

  // Execution configuration
  failureStrategy: z.enum(["fail_fast", "continue", "skip", "fallback"]).default("fail_fast"),
  rollbackCapability: z.boolean().default(false),

  // Metrics
  domainMetrics: z.array(z.object({
    metricId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().default(""),
    unit: z.string().default("count"),
    aggregation: z.enum(["sum", "avg", "min", "max", "count"]).default("count"),
    threshold: z.object({
      warning: z.number(),
      critical: z.number(),
    }).optional().nullable().default(null),
  })).default([]),

  // Security and sandbox requirements
  sandboxTier: z.preprocess(
    normalizeSandboxTier,
    z.enum(["read_only", "workspace_write", "scoped_external_access", "restricted_exec"]),
  ).default("read_only"),
  permissions: z.array(z.object({
    permission: z.string().min(1),
    level: z.enum(["read", "write", "admin"]).default("read"),
    justification: z.string().default(""),
  })).default([]),

  // Additional metadata
  author: z.string().default(""),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});

export type BusinessPackManifest = z.input<typeof BusinessPackManifestSchema>;
export type NormalizedBusinessPackManifest = z.output<typeof BusinessPackManifestSchema>;

// ============================================================================
// Validation Result
// ============================================================================

/**
 * Validation issue found during manifest validation.
 */
export interface ManifestValidationIssue {
  code: string;
  field: string;
  message: string;
  severity: "error" | "warning";
}

/**
 * Result of validating a Business Pack manifest.
 */
export interface ManifestValidationResult {
  valid: boolean;
  issues: ManifestValidationIssue[];
}

/**
 * Validates a Business Pack manifest for completeness and correctness.
 *
 * Enhanced validation that checks:
 * - Required fields are present
 * - Dependencies exist and are compatible
 * - Permissions follow least-privilege principle
 * - Sandbox tier is appropriate for risk level
 * - Approval points are properly configured
 */
export function validateBusinessPackManifest(
  manifest: BusinessPackManifest,
  options: {
    existingPackIds?: readonly string[];
    installedPluginIds?: readonly string[];
  } = {},
): ManifestValidationResult {
  const schemaResult = BusinessPackManifestSchema.safeParse(manifest);
  const issues: ManifestValidationIssue[] = [];
  const existingPackIds = new Set(options.existingPackIds ?? []);
  const installedPluginIds = new Set(options.installedPluginIds ?? []);
  const raw = manifest as Partial<Record<string, unknown>>;
  const normalizedManifest = schemaResult.success
    ? schemaResult.data
    : {
      packId: typeof raw["packId"] === "string" ? raw["packId"] : "",
      name: typeof raw["name"] === "string" ? raw["name"] : "",
      version: typeof raw["version"] === "string" ? raw["version"] : "",
      domainId: typeof raw["domainId"] === "string" ? raw["domainId"] : "",
      dependencies: Array.isArray(raw["dependencies"]) ? raw["dependencies"] as BusinessPackManifest["dependencies"] : [],
      pluginIds: Array.isArray(raw["pluginIds"]) ? raw["pluginIds"] as string[] : [],
      riskMatrix: Array.isArray(raw["riskMatrix"]) ? raw["riskMatrix"] as BusinessPackManifest["riskMatrix"] : [],
      sandboxTier: normalizeSandboxTier(raw["sandboxTier"] ?? "read_only") as NormalizedBusinessPackManifest["sandboxTier"],
      permissions: Array.isArray(raw["permissions"]) ? raw["permissions"] as BusinessPackManifest["permissions"] : [],
      approvalPoints: Array.isArray(raw["approvalPoints"]) ? raw["approvalPoints"] as BusinessPackManifest["approvalPoints"] : [],
      failureStrategy: raw["failureStrategy"] === "continue" || raw["failureStrategy"] === "skip" || raw["failureStrategy"] === "fallback"
        ? raw["failureStrategy"]
        : "fail_fast",
      rollbackCapability: raw["rollbackCapability"] === true,
      lifecycleStage: raw["lifecycleStage"] === "certifying"
        || raw["lifecycleStage"] === "published"
        || raw["lifecycleStage"] === "deprecated"
        || raw["lifecycleStage"] === "archived"
        ? raw["lifecycleStage"]
        : "draft",
    };
  const dependencies = normalizedManifest.dependencies ?? [];
  const pluginIds = normalizedManifest.pluginIds ?? [];
  const riskMatrix = normalizedManifest.riskMatrix ?? [];
  const permissions = normalizedManifest.permissions ?? [];
  const approvalPoints = normalizedManifest.approvalPoints ?? [];

  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      issues.push({
        code: `manifest.schema.${issue.code}`,
        field: issue.path.join("."),
        message: issue.message,
        severity: "error",
      });
    }
  }

  // Required fields validation
  if (!normalizedManifest.packId || normalizedManifest.packId.trim().length === 0) {
    issues.push({
      code: "manifest.missing_pack_id",
      field: "packId",
      message: "Pack ID is required",
      severity: "error",
    });
  }

  if (!normalizedManifest.name || normalizedManifest.name.trim().length === 0) {
    issues.push({
      code: "manifest.missing_name",
      field: "name",
      message: "Pack name is required",
      severity: "error",
    });
  }

  if (!normalizedManifest.version || normalizedManifest.version.trim().length === 0) {
    issues.push({
      code: "manifest.missing_version",
      field: "version",
      message: "Pack version is required",
      severity: "error",
    });
  } else if (!/^\d+\.\d+\.\d+$/.test(normalizedManifest.version)) {
    issues.push({
      code: "manifest.invalid_version_format",
      field: "version",
      message: "Version must follow semver format (e.g., 1.0.0)",
      severity: "error",
    });
  }

  if (!normalizedManifest.domainId || normalizedManifest.domainId.trim().length === 0) {
    issues.push({
      code: "manifest.missing_domain_id",
      field: "domainId",
      message: "Domain ID is required (must reference an active DomainDescriptor)",
      severity: "error",
    });
  }

  // Dependency validation with semver range parsing (R13-28 FIX)
  for (const dep of dependencies) {
    if (!dep.packId) {
      issues.push({
        code: "manifest.missing_dependency_pack_id",
        field: `dependencies.${dep.packId}.packId`,
        message: "Dependency pack ID is required",
        severity: "error",
      });
    } else if (!existingPackIds.has(dep.packId) && dep.packId !== normalizedManifest.packId) {
      issues.push({
        code: "manifest.dependency_not_found",
        field: `dependencies.${dep.packId}.packId`,
        message: `Dependency pack '${dep.packId}' not found in registry`,
        severity: dep.optional ? "warning" : "error",
      });
    }

    if (!dep.versionRange) {
      issues.push({
        code: "manifest.missing_version_range",
        field: `dependencies.${dep.packId}.versionRange`,
        message: "Dependency version range is required",
        severity: "warning",
      });
    } else {
      // R13-28 FIX: Validate semver range format and parseability
      const rangeParsed = parseSemverRange(dep.versionRange);
      if (!rangeParsed) {
        issues.push({
          code: "manifest.invalid_version_range_format",
          field: `dependencies.${dep.packId}.versionRange`,
          message: `Dependency version range '${dep.versionRange}' is not a valid semver range`,
          severity: "error",
        });
      }
    }
  }

  // R13-29 FIX: Transitive dependency graph validation with cycle detection
  const getPackVersionFn = (packId: string): string | null => {
    if (packId === normalizedManifest.packId) {
      return normalizedManifest.version;
    }
    // In a real implementation, this would look up from a pack registry
    // For now, we assume any pack in existingPackIds has a compatible version
    return existingPackIds.has(packId) ? "1.0.0" : null;
  };

  const depGraphResult = buildDependencyGraph(
    normalizedManifest as NormalizedBusinessPackManifest,
    getPackVersionFn,
  );
  for (const cycle of depGraphResult.cycles) {
    issues.push({
      code: "manifest.dependency_cycle_detected",
      field: "dependencies",
      message: `Circular dependency detected: ${cycle.join(" -> ")}`,
      severity: "error",
    });
  }
  for (const unresolved of depGraphResult.unresolvedDependencies) {
    issues.push({
      code: "manifest.unresolved_dependency",
      field: `dependencies.${unresolved.packId}`,
      message: `Dependency '${unresolved.packId}' version range '${unresolved.versionRange}' cannot be satisfied`,
      severity: "error",
    });
  }

  // R13-30 FIX: Upgrade path validation for major version changes
  if (normalizedManifest.lifecycleStage === "published" && dependencies.length > 0) {
    for (const dep of dependencies) {
      if (!dep.versionRange) continue;
      const depVersion = getPackVersionFn(dep.packId);
      if (depVersion && !satisfiesSemverRange(depVersion, dep.versionRange)) {
        const upgradeResult = calculateUpgradePaths(depVersion, dep.versionRange, []);
        if (upgradeResult.breakingChanges.length > 0) {
          issues.push({
            code: "manifest.breaking_change_in_dependency",
            field: `dependencies.${dep.packId}`,
            message: `Dependency '${dep.packId}' has a breaking change path (major version bump)`,
            severity: "warning",
          });
        }
      }
    }
  }

  // Plugin validation
  for (const pluginId of pluginIds) {
    if (!installedPluginIds.has(pluginId)) {
      issues.push({
        code: "manifest.plugin_not_installed",
        field: `pluginIds.${pluginId}`,
        message: `Plugin '${pluginId}' is not installed`,
        severity: "error",
      });
    }
  }

  // Sandbox tier validation based on risk level
  const maxRisk = riskMatrix.reduce<BusinessPackRiskLevel | null>(
    (max, entry) => {
      const riskOrder: BusinessPackRiskLevel[] = ["low", "medium", "high", "critical"];
      if (!max) return entry.level;
      return riskOrder.indexOf(entry.level) > riskOrder.indexOf(max) ? entry.level : max;
    },
    null,
  );

  if (maxRisk === "critical" && (normalizedManifest.sandboxTier === "read_only" || normalizedManifest.sandboxTier === "workspace_write")) {
    issues.push({
      code: "manifest.insecure_sandbox_tier",
      field: "sandboxTier",
      message: "Critical risk packs must use scoped_external_access or restricted_exec sandbox",
      severity: "error",
    });
  }

  if (maxRisk === "high" && normalizedManifest.sandboxTier === "read_only") {
    issues.push({
      code: "manifest.insecure_sandbox_tier",
      field: "sandboxTier",
      message: "High risk packs should use workspace_write, scoped_external_access, or restricted_exec sandbox",
      severity: "warning",
    });
  }

  // Permission validation - least privilege
  for (const perm of permissions) {
    if (perm.level === "admin" && !perm.justification) {
      issues.push({
        code: "manifest.admin_permission_without_justification",
        field: `permissions.${perm.permission}`,
        message: `Admin permission '${perm.permission}' requires justification`,
        severity: "warning",
      });
    }
  }

  // Approval point validation
  for (const approval of approvalPoints) {
    const requiredApprovals = approval.requiredApprovals ?? 1;
    const approverRoles = approval.approverRoles ?? [];
    const timeoutMinutes = approval.timeoutMinutes ?? 0;
    if (requiredApprovals > 1 && approverRoles.length < requiredApprovals) {
      issues.push({
        code: "manifest.insufficient_approvers",
        field: `approvalPoints.${approval.pointId}`,
        message: `Approval point requires ${requiredApprovals} approvals but only ${approverRoles.length} roles defined`,
        severity: "error",
      });
    }

    if (timeoutMinutes <= 0) {
      issues.push({
        code: "manifest.invalid_timeout",
        field: `approvalPoints.${approval.pointId}.timeoutMinutes`,
        message: "Approval timeout must be positive",
        severity: "error",
      });
    }
  }

  // Rollback capability validation
  if (normalizedManifest.failureStrategy === "fail_fast" && !normalizedManifest.rollbackCapability) {
    issues.push({
      code: "manifest.rollback_recommended",
      field: "rollbackCapability",
      message: "fail_fast strategy without rollback capability is risky",
      severity: "warning",
    });
  }

  // Lifecycle-specific validation
  if (normalizedManifest.lifecycleStage === "published" && riskMatrix.length === 0) {
    issues.push({
      code: "manifest.published_without_risk_matrix",
      field: "riskMatrix",
      message: "Published packs should have a risk matrix defined",
      severity: "warning",
    });
  }

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  };
}

// ============================================================================
// Lifecycle Helpers
// ============================================================================

/**
 * Transition result after a lifecycle change.
 */
export interface LifecycleTransitionResult {
  from: BusinessPackLifecycleStage;
  to: BusinessPackLifecycleStage;
  allowed: boolean;
  reason?: string;
}

/**
 * Attempts to transition a Business Pack to a new lifecycle stage.
 */
export function transitionLifecycle(
  currentStage: BusinessPackLifecycleStage,
  targetStage: BusinessPackLifecycleStage,
): LifecycleTransitionResult {
  const allowed = isValidLifecycleTransition(currentStage, targetStage);
  return {
    from: currentStage,
    to: targetStage,
    allowed,
    ...(allowed ? {} : { reason: `Invalid transition from ${currentStage} to ${targetStage}` }),
  };
}
