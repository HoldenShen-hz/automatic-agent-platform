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
/**
 * Validates if a lifecycle stage transition is allowed.
 */
export function isValidLifecycleTransition(from, to) {
    const transitions = {
        draft: ["certifying", "archived"],
        certifying: ["published", "draft", "archived"],
    }, published, deprecated, archived; // Terminal state
}
;
return transitions[from]?.includes(to) ?? false;
/**
 * Checks if a stage allows execution.
 */
export function isExecutableStage(stage) {
    return stage === "published" || stage === "deprecated";
}
/**
 * Checks if a stage is terminal.
 */
export function isTerminalStage(stage) {
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
    version: z.string().min(1),
    domainId: z.string().min(1),
    description: z.string().optional().default(""),
    // Lifecycle and status
    lifecycleStage: z.enum(["draft", "review", "approved", "published", "deprecated", "archived"]).default("draft"),
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
    sandboxTier: z.enum(["none", "process", "container", "scoped_external_access"]).default("process"),
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
export function validateBusinessPackManifest(manifest, options = {}) {
    const issues = [];
    const existingPackIds = new Set(options.existingPackIds ?? []);
    const installedPluginIds = new Set(options.installedPluginIds ?? []);
    // Required fields validation
    if (!manifest.packId || manifest.packId.trim().length === 0) {
        issues.push({
            code: "manifest.missing_pack_id",
            field: "packId",
            message: "Pack ID is required",
            severity: "error",
        });
    }
    if (!manifest.name || manifest.name.trim().length === 0) {
        issues.push({
            code: "manifest.missing_name",
            field: "name",
            message: "Pack name is required",
            severity: "error",
        });
    }
    if (!manifest.version || manifest.version.trim().length === 0) {
        issues.push({
            code: "manifest.missing_version",
            field: "version",
            message: "Pack version is required",
            severity: "error",
        });
    }
    else if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
        issues.push({
            code: "manifest.invalid_version_format",
            field: "version",
            message: "Version must follow semver format (e.g., 1.0.0)",
            severity: "error",
        });
    }
    if (!manifest.domainId || manifest.domainId.trim().length === 0) {
        issues.push({
            code: "manifest.missing_domain_id",
            field: "domainId",
            message: "Domain ID is required (must reference an active DomainDescriptor)",
            severity: "error",
        });
    }
    // Dependency validation
    for (const dep of manifest.dependencies) {
        if (!dep.packId) {
            issues.push({
                code: "manifest.missing_dependency_pack_id",
                field: `dependencies.${dep.packId}.packId`,
                message: "Dependency pack ID is required",
                severity: "error",
            });
        }
        else if (!existingPackIds.has(dep.packId) && dep.packId !== manifest.packId) {
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
        }
    }
    // Plugin validation
    for (const pluginId of manifest.pluginIds) {
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
    const maxRisk = manifest.riskMatrix.reduce((max, entry) => {
        const riskOrder = ["low", "medium", "high", "critical"];
        if (!max)
            return entry.level;
        return riskOrder.indexOf(entry.level) > riskOrder.indexOf(max) ? entry.level : max;
    }, null);
    if (maxRisk === "critical" && manifest.sandboxTier === "none") {
        issues.push({
            code: "manifest.insecure_sandbox_tier",
            field: "sandboxTier",
            message: "Critical risk packs must not use 'none' sandbox tier",
            severity: "error",
        });
    }
    if (maxRisk === "high" && manifest.sandboxTier === "none" || manifest.sandboxTier === "process") {
        issues.push({
            code: "manifest.insecure_sandbox_tier",
            field: "sandboxTier",
            message: "High risk packs should use container or scoped_external_access sandbox",
            severity: "warning",
        });
    }
    // Permission validation - least privilege
    for (const perm of manifest.permissions) {
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
    for (const approval of manifest.approvalPoints) {
        if (approval.requiredApprovals > 1 && approval.approverRoles.length < approval.requiredApprovals) {
            issues.push({
                code: "manifest.insufficient_approvers",
                field: `approvalPoints.${approval.pointId}`,
                message: `Approval point requires ${approval.requiredApprovals} approvals but only ${approval.approverRoles.length} roles defined`,
                severity: "error",
            });
        }
        if (approval.timeoutMinutes <= 0) {
            issues.push({
                code: "manifest.invalid_timeout",
                field: `approvalPoints.${approval.pointId}.timeoutMinutes`,
                message: "Approval timeout must be positive",
                severity: "error",
            });
        }
    }
    // Rollback capability validation
    if (manifest.failureStrategy === "fail_fast" && !manifest.rollbackCapability) {
        issues.push({
            code: "manifest.rollback_recommended",
            field: "rollbackCapability",
            message: "fail_fast strategy without rollback capability is risky",
            severity: "warning",
        });
    }
    // Lifecycle-specific validation
    if (manifest.lifecycleStage === "published" && manifest.riskMatrix.length === 0) {
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
/**
 * Attempts to transition a Business Pack to a new lifecycle stage.
 */
export function transitionLifecycle(currentStage, targetStage) {
    const allowed = isValidLifecycleTransition(currentStage, targetStage);
    return {
        from: currentStage,
        to: targetStage,
        allowed,
        ...(allowed ? {} : { reason: `Invalid transition from ${currentStage} to ${targetStage}` }),
    };
}
//# sourceMappingURL=business-pack-manifest.js.map