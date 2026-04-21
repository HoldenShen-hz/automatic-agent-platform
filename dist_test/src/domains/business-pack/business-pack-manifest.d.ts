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
export type SandboxTier = "none" | "process" | "container" | "scoped_external_access";
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
/**
 * Business Pack lifecycle stages.
 *
 * Full lifecycle as defined in architecture doc §30.4:
 * - draft: Initial development
 * - review: Under security/quality review
 * - approved: Passed review, ready for publishing
 * - published: Available in marketplace
 * - deprecated: No longer supported, still runs for existing users
 * - archived: Fully retired, cannot run
 */
export type BusinessPackLifecycleStage = "draft" | "review" | "approved" | "published" | "deprecated" | "archived";
/**
 * Validates if a lifecycle stage transition is allowed.
 */
export declare function isValidLifecycleTransition(from: BusinessPackLifecycleStage, to: BusinessPackLifecycleStage): boolean;
/**
 * Checks if a stage allows execution.
 */
export declare function isExecutableStage(stage: BusinessPackLifecycleStage): boolean;
/**
 * Checks if a stage is terminal.
 */
export declare function isTerminalStage(stage: BusinessPackLifecycleStage): boolean;
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
export declare const BusinessPackManifestSchema: z.ZodObject<{
    packId: z.ZodString;
    name: z.ZodString;
    version: z.ZodString;
    domainId: z.ZodString;
    description: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    lifecycleStage: z.ZodDefault<z.ZodEnum<["draft", "review", "approved", "published", "deprecated", "archived"]>>;
    deprecatedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    archivedAt: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    riskMatrix: z.ZodDefault<z.ZodArray<z.ZodObject<{
        riskId: z.ZodString;
        level: z.ZodEnum<["low", "medium", "high", "critical"]>;
        triggers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        mitigation: z.ZodDefault<z.ZodString>;
        escalationPolicy: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        level: "low" | "high" | "medium" | "critical";
        triggers: string[];
        mitigation: string;
        riskId: string;
        escalationPolicy: string;
    }, {
        level: "low" | "high" | "medium" | "critical";
        riskId: string;
        triggers?: string[] | undefined;
        mitigation?: string | undefined;
        escalationPolicy?: string | undefined;
    }>, "many">>;
    toolBundles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    pluginIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    dependencies: z.ZodDefault<z.ZodArray<z.ZodObject<{
        packId: z.ZodString;
        versionRange: z.ZodDefault<z.ZodString>;
        optional: z.ZodDefault<z.ZodBoolean>;
        reason: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        reason: string;
        optional: boolean;
        packId: string;
        versionRange: string;
    }, {
        packId: string;
        reason?: string | undefined;
        optional?: boolean | undefined;
        versionRange?: string | undefined;
    }>, "many">>;
    approvalPoints: z.ZodDefault<z.ZodArray<z.ZodObject<{
        pointId: z.ZodString;
        name: z.ZodString;
        description: z.ZodDefault<z.ZodString>;
        triggerCondition: z.ZodDefault<z.ZodString>;
        requiredApprovals: z.ZodDefault<z.ZodNumber>;
        approverRoles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        timeoutMinutes: z.ZodDefault<z.ZodNumber>;
        autoApproveRoles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        requiredApprovals: number;
        pointId: string;
        triggerCondition: string;
        approverRoles: string[];
        timeoutMinutes: number;
        autoApproveRoles: string[];
    }, {
        name: string;
        pointId: string;
        description?: string | undefined;
        requiredApprovals?: number | undefined;
        triggerCondition?: string | undefined;
        approverRoles?: string[] | undefined;
        timeoutMinutes?: number | undefined;
        autoApproveRoles?: string[] | undefined;
    }>, "many">>;
    artifactTypes: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    knowledgeNamespaces: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    failureStrategy: z.ZodDefault<z.ZodEnum<["fail_fast", "continue", "skip", "fallback"]>>;
    rollbackCapability: z.ZodDefault<z.ZodBoolean>;
    domainMetrics: z.ZodDefault<z.ZodArray<z.ZodObject<{
        metricId: z.ZodString;
        name: z.ZodString;
        description: z.ZodDefault<z.ZodString>;
        unit: z.ZodDefault<z.ZodString>;
        aggregation: z.ZodDefault<z.ZodEnum<["sum", "avg", "min", "max", "count"]>>;
        threshold: z.ZodDefault<z.ZodNullable<z.ZodOptional<z.ZodObject<{
            warning: z.ZodNumber;
            critical: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            warning: number;
            critical: number;
        }, {
            warning: number;
            critical: number;
        }>>>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        unit: string;
        threshold: {
            warning: number;
            critical: number;
        } | null;
        metricId: string;
        aggregation: "max" | "min" | "count" | "sum" | "avg";
    }, {
        name: string;
        metricId: string;
        description?: string | undefined;
        unit?: string | undefined;
        threshold?: {
            warning: number;
            critical: number;
        } | null | undefined;
        aggregation?: "max" | "min" | "count" | "sum" | "avg" | undefined;
    }>, "many">>;
    sandboxTier: z.ZodDefault<z.ZodEnum<["none", "process", "container", "scoped_external_access"]>>;
    permissions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        permission: z.ZodString;
        level: z.ZodDefault<z.ZodEnum<["read", "write", "admin"]>>;
        justification: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        level: "admin" | "read" | "write";
        permission: string;
        justification: string;
    }, {
        permission: string;
        level?: "admin" | "read" | "write" | undefined;
        justification?: string | undefined;
    }>, "many">>;
    author: z.ZodDefault<z.ZodString>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    createdAt: z.ZodDefault<z.ZodString>;
    updatedAt: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    createdAt: string;
    version: string;
    updatedAt: string;
    description: string;
    tags: string[];
    dependencies: {
        reason: string;
        optional: boolean;
        packId: string;
        versionRange: string;
    }[];
    domainId: string;
    toolBundles: string[];
    archivedAt: string | null;
    packId: string;
    lifecycleStage: "approved" | "draft" | "published" | "archived" | "deprecated" | "review";
    deprecatedAt: string | null;
    riskMatrix: {
        level: "low" | "high" | "medium" | "critical";
        triggers: string[];
        mitigation: string;
        riskId: string;
        escalationPolicy: string;
    }[];
    pluginIds: string[];
    approvalPoints: {
        name: string;
        description: string;
        requiredApprovals: number;
        pointId: string;
        triggerCondition: string;
        approverRoles: string[];
        timeoutMinutes: number;
        autoApproveRoles: string[];
    }[];
    artifactTypes: string[];
    knowledgeNamespaces: string[];
    failureStrategy: "continue" | "fail_fast" | "skip" | "fallback";
    rollbackCapability: boolean;
    domainMetrics: {
        name: string;
        description: string;
        unit: string;
        threshold: {
            warning: number;
            critical: number;
        } | null;
        metricId: string;
        aggregation: "max" | "min" | "count" | "sum" | "avg";
    }[];
    sandboxTier: "none" | "process" | "container" | "scoped_external_access";
    permissions: {
        level: "admin" | "read" | "write";
        permission: string;
        justification: string;
    }[];
    author: string;
}, {
    name: string;
    version: string;
    domainId: string;
    packId: string;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    description?: string | undefined;
    tags?: string[] | undefined;
    dependencies?: {
        packId: string;
        reason?: string | undefined;
        optional?: boolean | undefined;
        versionRange?: string | undefined;
    }[] | undefined;
    toolBundles?: string[] | undefined;
    archivedAt?: string | null | undefined;
    lifecycleStage?: "approved" | "draft" | "published" | "archived" | "deprecated" | "review" | undefined;
    deprecatedAt?: string | null | undefined;
    riskMatrix?: {
        level: "low" | "high" | "medium" | "critical";
        riskId: string;
        triggers?: string[] | undefined;
        mitigation?: string | undefined;
        escalationPolicy?: string | undefined;
    }[] | undefined;
    pluginIds?: string[] | undefined;
    approvalPoints?: {
        name: string;
        pointId: string;
        description?: string | undefined;
        requiredApprovals?: number | undefined;
        triggerCondition?: string | undefined;
        approverRoles?: string[] | undefined;
        timeoutMinutes?: number | undefined;
        autoApproveRoles?: string[] | undefined;
    }[] | undefined;
    artifactTypes?: string[] | undefined;
    knowledgeNamespaces?: string[] | undefined;
    failureStrategy?: "continue" | "fail_fast" | "skip" | "fallback" | undefined;
    rollbackCapability?: boolean | undefined;
    domainMetrics?: {
        name: string;
        metricId: string;
        description?: string | undefined;
        unit?: string | undefined;
        threshold?: {
            warning: number;
            critical: number;
        } | null | undefined;
        aggregation?: "max" | "min" | "count" | "sum" | "avg" | undefined;
    }[] | undefined;
    sandboxTier?: "none" | "process" | "container" | "scoped_external_access" | undefined;
    permissions?: {
        permission: string;
        level?: "admin" | "read" | "write" | undefined;
        justification?: string | undefined;
    }[] | undefined;
    author?: string | undefined;
}>;
export type BusinessPackManifest = z.infer<typeof BusinessPackManifestSchema>;
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
export declare function validateBusinessPackManifest(manifest: BusinessPackManifest, options?: {
    existingPackIds?: readonly string[];
    installedPluginIds?: readonly string[];
}): ManifestValidationResult;
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
export declare function transitionLifecycle(currentStage: BusinessPackLifecycleStage, targetStage: BusinessPackLifecycleStage): LifecycleTransitionResult;
