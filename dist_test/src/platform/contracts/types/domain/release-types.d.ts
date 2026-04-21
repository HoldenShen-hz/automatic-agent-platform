/**
 * @fileoverview Release Types - Release bundle and deployment records.
 *
 * Contains records related to release management, deployment execution,
 * and environment promotion tracking.
 *
 * Part of the domain.ts split (see src/core/types/domain/index.ts).
 */
import type { EnvironmentName, SecretProviderKind, SecretLeaseStatus, Timestamp } from "./primitives.js";
/**
 * Release bundle record - immutable artifact of a versioned deployment configuration.
 *
 * Captures the complete configuration for a specific versioned release including
 * rollout strategy, deployment targets, and required credentials. Used for
 * audit, rollback, and compliance verification of deployed versions.
 */
export interface ReleaseBundleRecord {
    bundleId: string;
    environment: EnvironmentName;
    version: string;
    commitSha: string;
    imageTag: string;
    imageRef: string;
    rolloutStrategy: "rolling" | "canary" | "blue_green";
    deploymentNamespace: string;
    clusterName: string;
    configPath: string;
    configBundleRef: string;
    registryCredentialRef: string;
    deploymentCredentialRef: string;
    publishWorkflowPath: string;
    deployWorkflowPath: string;
    requiredReadinessChecksJson: string;
    recommendedCommandsJson: string;
    taskId: string | null;
    jsonArtifactUri: string | null;
    markdownArtifactUri: string | null;
    generatedAt: Timestamp;
    exportedAt: Timestamp;
}
export interface ReleaseExecutionReportRecord {
    executionId: string;
    bundleId: string;
    environment: EnvironmentName;
    version: string;
    commitSha: string;
    rolloutStrategy: "rolling" | "canary" | "blue_green";
    imageRef: string;
    imageRepository: string;
    registrySecretRef: string;
    registrySecretProviderKind: SecretProviderKind;
    registrySecretResolved: 0 | 1;
    registrySecretAccessMode: "describe" | "lease";
    registryLeaseId: string | null;
    registryLeaseStatus: SecretLeaseStatus | null;
    registryLeaseExpiresAt: Timestamp | null;
    registryLeaseRevokedAt: Timestamp | null;
    publishWorkflowRunId: string | null;
    publishWorkflowRunUrl: string | null;
    buildCommand: string;
    publishCommand: string;
    commandResultsJson: string;
    taskId: string | null;
    jsonArtifactUri: string | null;
    markdownArtifactUri: string | null;
    generatedAt: Timestamp;
    exportedAt: Timestamp;
}
export interface DeploymentExecutionReportRecord {
    executionId: string;
    environment: EnvironmentName;
    version: string;
    commitSha: string;
    rolloutStrategy: "rolling" | "canary" | "blue_green";
    targetEligible: 0 | 1;
    configBundleRef: string;
    configVersionId: string | null;
    registrySecretRef: string;
    registrySecretProviderKind: SecretProviderKind;
    registrySecretResolved: 0 | 1;
    deploymentSecretRef: string;
    deploymentSecretProviderKind: SecretProviderKind;
    deploymentSecretResolved: 0 | 1;
    publishWorkflowRunId: string | null;
    publishWorkflowRunUrl: string | null;
    deployWorkflowRunId: string | null;
    deployWorkflowRunUrl: string | null;
    executionMode: "plan" | "execute";
    publishCommand: string;
    deployCommand: string;
    commandResultsJson: string;
    releaseBundleId: string | null;
    taskId: string | null;
    jsonArtifactUri: string | null;
    markdownArtifactUri: string | null;
    generatedAt: Timestamp;
    exportedAt: Timestamp;
}
export interface EnvironmentPromotionHistoryRecord {
    promotionId: string;
    sourceEnvironment: EnvironmentName | null;
    targetEnvironment: EnvironmentName;
    version: string;
    commitSha: string;
    rolloutStrategy: "rolling" | "canary" | "blue_green";
    decisionType: "plan" | "execute";
    decisionStatus: "planned" | "executed";
    releaseBundleId: string | null;
    deploymentExecutionId: string | null;
    reasonCode: string;
    actor: string;
    metadataJson: string | null;
    recordedAt: Timestamp;
}
