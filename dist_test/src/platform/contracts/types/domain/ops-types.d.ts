/**
 * @fileoverview Ops Types - Operational records for readiness, enterprise, extensions, and marketplace.
 *
 * Contains records related to environment readiness, enterprise capability reporting,
 * incident handoff, extension packages, and marketplace governance.
 *
 * Part of the domain.ts split (see src/core/types/domain/index.ts).
 */
import type { EnvironmentName, DeploymentMode, EnvironmentReadinessComponentType, ExtensionPackageType, ExtensionTrustLevel, ExtensionLifecycleState, MarketplaceReviewStatus, MarketplacePublicationStatus, ActionProposalStatus, PerceptionSourceType, Timestamp } from "./primitives.js";
export interface EnvironmentReadinessRecord {
    readinessId: string;
    environment: EnvironmentName;
    componentType: EnvironmentReadinessComponentType;
    componentId: string;
    credentialReady: 0 | 1;
    secondaryGatesJson: string;
    owner: string;
    lastVerifiedAt: Timestamp;
    isActive: 0 | 1;
    notes: string | null;
}
export interface EnterpriseCapabilityReportRecord {
    reportId: string;
    accountId: string | null;
    workspaceId: string | null;
    tenantId: string | null;
    environment: EnvironmentName;
    deploymentMode: DeploymentMode;
    summaryJson: string;
    reportJson: string;
    generatedAt: Timestamp;
}
export interface IncidentHandoffRecord {
    handoffId: string;
    incidentId: string | null;
    environment: EnvironmentName;
    status: "ready" | "warning" | "blocked";
    shiftOwner: string;
    primaryOncall: string;
    secondaryOncall: string;
    severity: string | null;
    handoffJson: string;
    createdAt: Timestamp;
}
export interface EnterpriseGovernanceReportRecord {
    reportId: string;
    taskId: string | null;
    environment: EnvironmentName;
    status: "pass" | "warning" | "fail";
    shiftOwner: string;
    summaryJson: string;
    reportJson: string;
    generatedAt: Timestamp;
    handoffId: string;
}
export interface ExtensionPackageRecord {
    packageId: string;
    tenantId: string | null;
    extensionId: string;
    packageType: ExtensionPackageType;
    displayName: string;
    version: string;
    owner: string;
    trustLevel: ExtensionTrustLevel;
    sourceUri: string;
    capabilitiesJson: string;
    permissionsJson: string;
    compatibilityJson: string;
    signatureVerified: 0 | 1;
    manifestChecksum: string;
    lifecycleState: ExtensionLifecycleState;
    reviewRequired: 0 | 1;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
export interface MarketplaceReviewRecord {
    reviewId: string;
    tenantId: string | null;
    packageId: string;
    status: MarketplaceReviewStatus;
    submitter: string;
    reviewer: string | null;
    decisionReasonCode: string | null;
    findingsJson: string;
    permissionSurfaceHash: string;
    submittedAt: Timestamp;
    decidedAt: Timestamp | null;
}
export interface MarketplacePublicationRecord {
    publicationId: string;
    tenantId: string | null;
    packageId: string;
    reviewId: string;
    channel: string;
    status: MarketplacePublicationStatus;
    compatibilityMatrixJson: string;
    revocationReasonCode: string | null;
    publishedAt: Timestamp;
    updatedAt: Timestamp;
}
export interface MarketplaceGovernanceReportRecord {
    reportId: string;
    tenantId: string | null;
    summaryJson: string;
    reportJson: string;
    generatedAt: Timestamp;
}
export interface PerceptionSourceRecord {
    sourceId: string;
    tenantId: string | null;
    type: PerceptionSourceType;
    name: string;
    enabled: 0 | 1;
    scheduleJson: string | null;
    filtersJson: string | null;
    priority: number;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
export interface ActionProposalRecord {
    proposalId: string;
    tenantId: string | null;
    briefId: string;
    intelId: string | null;
    taskId: string | null;
    title: string;
    summary: string;
    actionType: string;
    status: ActionProposalStatus;
    requiresApproval: 0 | 1;
    proposalJson: string;
    createdAt: Timestamp;
    decidedAt: Timestamp | null;
}
