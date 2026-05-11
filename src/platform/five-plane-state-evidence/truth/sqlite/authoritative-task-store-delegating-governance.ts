/* c8 ignore start */
import {
  AuthoritativeTaskStoreLegacyCompat,
} from "./authoritative-task-store-legacy-compat.js";
import {
  AuthoritativeTaskStoreDelegatingEngagement,
} from "./authoritative-task-store-delegating-engagement.js";

export abstract class AuthoritativeTaskStoreDelegatingGovernance extends AuthoritativeTaskStoreDelegatingEngagement {
  public override upsertSecretRegistryRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertSecretRegistryRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertSecretRegistryRecord"]> {
    return this.delegateLegacy("upsertSecretRegistryRecord", "secret", "upsertSecretRegistryRecord", ...args);
  }

  public override insertSecretUsageAudit(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertSecretUsageAudit"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertSecretUsageAudit"]> {
    return this.delegateLegacy("insertSecretUsageAudit", "secret", "insertSecretUsageAudit", ...args);
  }

  public override insertSecretRotationEvent(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertSecretRotationEvent"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertSecretRotationEvent"]> {
    return this.delegateLegacy("insertSecretRotationEvent", "secret", "insertSecretRotationEvent", ...args);
  }

  public override upsertSecretLeaseRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertSecretLeaseRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertSecretLeaseRecord"]> {
    return this.delegateLegacy("upsertSecretLeaseRecord", "secret", "upsertSecretLeaseRecord", ...args);
  }

  public override getSecretRegistryRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getSecretRegistryRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getSecretRegistryRecord"]> {
    return this.delegateLegacy("getSecretRegistryRecord", "secret", "getSecretRegistryRecord", ...args);
  }

  public override listSecretRegistryRecords(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listSecretRegistryRecords"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listSecretRegistryRecords"]> {
    return this.delegateLegacy("listSecretRegistryRecords", "secret", "listSecretRegistryRecords", ...args);
  }

  public override listSecretUsageAuditsBySecretRef(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listSecretUsageAuditsBySecretRef"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listSecretUsageAuditsBySecretRef"]> {
    return this.delegateLegacy("listSecretUsageAuditsBySecretRef", "secret", "listSecretUsageAuditsBySecretRef", ...args);
  }

  public override listSecretRotationEventsBySecretRef(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listSecretRotationEventsBySecretRef"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listSecretRotationEventsBySecretRef"]> {
    return this.delegateLegacy("listSecretRotationEventsBySecretRef", "secret", "listSecretRotationEventsBySecretRef", ...args);
  }

  public override getSecretLeaseRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getSecretLeaseRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getSecretLeaseRecord"]> {
    return this.delegateLegacy("getSecretLeaseRecord", "secret", "getSecretLeaseRecord", ...args);
  }

  public override listSecretLeasesBySecretRef(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listSecretLeasesBySecretRef"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listSecretLeasesBySecretRef"]> {
    return this.delegateLegacy("listSecretLeasesBySecretRef", "secret", "listSecretLeasesBySecretRef", ...args);
  }

  public override upsertSecretVersionRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertSecretVersionRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertSecretVersionRecord"]> {
    return this.delegateLegacy("upsertSecretVersionRecord", "secret", "upsertSecretVersionRecord", ...args);
  }

  public override getSecretVersionRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getSecretVersionRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getSecretVersionRecord"]> {
    return this.delegateLegacy("getSecretVersionRecord", "secret", "getSecretVersionRecord", ...args);
  }

  public override listSecretVersionRecordsBySecretRef(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listSecretVersionRecordsBySecretRef"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listSecretVersionRecordsBySecretRef"]> {
    return this.delegateLegacy("listSecretVersionRecordsBySecretRef", "secret", "listSecretVersionRecordsBySecretRef", ...args);
  }

  public override insertEvolutionProposal(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertEvolutionProposal"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertEvolutionProposal"]> {
    return this.delegateLegacy("insertEvolutionProposal", "evolution", "insertEvolutionProposal", ...args);
  }

  public override updateEvolutionProposal(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["updateEvolutionProposal"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["updateEvolutionProposal"]> {
    return this.delegateLegacy("updateEvolutionProposal", "evolution", "updateEvolutionProposal", ...args);
  }

  public override getEvolutionProposal(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getEvolutionProposal"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getEvolutionProposal"]> {
    return this.delegateLegacy("getEvolutionProposal", "evolution", "getEvolutionProposal", ...args);
  }

  public override listEvolutionProposals(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listEvolutionProposals"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listEvolutionProposals"]> {
    return this.delegateLegacy("listEvolutionProposals", "evolution", "listEvolutionProposals", ...args);
  }

  public override insertEvolutionPolicy(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertEvolutionPolicy"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertEvolutionPolicy"]> {
    return this.delegateLegacy("insertEvolutionPolicy", "evolution", "insertEvolutionPolicy", ...args);
  }

  public override updateEvolutionPolicy(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["updateEvolutionPolicy"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["updateEvolutionPolicy"]> {
    return this.delegateLegacy("updateEvolutionPolicy", "evolution", "updateEvolutionPolicy", ...args);
  }

  public override getEvolutionPolicyByProposal(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getEvolutionPolicyByProposal"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getEvolutionPolicyByProposal"]> {
    return this.delegateLegacy("getEvolutionPolicyByProposal", "evolution", "getEvolutionPolicyByProposal", ...args);
  }

  public override listEvolutionPolicies(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listEvolutionPolicies"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listEvolutionPolicies"]> {
    return this.delegateLegacy("listEvolutionPolicies", "evolution", "listEvolutionPolicies", ...args);
  }

  public override insertEvolutionLog(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertEvolutionLog"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertEvolutionLog"]> {
    return this.delegateLegacy("insertEvolutionLog", "evolution", "insertEvolutionLog", ...args);
  }

  public override listEvolutionLogsByProposal(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listEvolutionLogsByProposal"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listEvolutionLogsByProposal"]> {
    return this.delegateLegacy("listEvolutionLogsByProposal", "evolution", "listEvolutionLogsByProposal", ...args);
  }

  public override insertReleaseBundleRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertReleaseBundleRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertReleaseBundleRecord"]> {
    return this.delegateLegacy("insertReleaseBundleRecord", "release", "insertReleaseBundleRecord", ...args);
  }

  public override insertReleaseExecutionReportRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertReleaseExecutionReportRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertReleaseExecutionReportRecord"]> {
    return this.delegateLegacy("insertReleaseExecutionReportRecord", "release", "insertReleaseExecutionReportRecord", ...args);
  }

  public override insertDeploymentExecutionReportRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertDeploymentExecutionReportRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertDeploymentExecutionReportRecord"]> {
    return this.delegateLegacy("insertDeploymentExecutionReportRecord", "release", "insertDeploymentExecutionReportRecord", ...args);
  }

  public override insertEnvironmentPromotionHistoryRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertEnvironmentPromotionHistoryRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertEnvironmentPromotionHistoryRecord"]> {
    return this.delegateLegacy("insertEnvironmentPromotionHistoryRecord", "release", "insertEnvironmentPromotionHistoryRecord", ...args);
  }

  public override getReleaseBundleRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getReleaseBundleRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getReleaseBundleRecord"]> {
    return this.delegateLegacy("getReleaseBundleRecord", "release", "getReleaseBundleRecord", ...args);
  }

  public override listReleaseBundleRecords(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listReleaseBundleRecords"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listReleaseBundleRecords"]> {
    return this.delegateLegacy("listReleaseBundleRecords", "release", "listReleaseBundleRecords", ...args);
  }

  public override getDeploymentExecutionReportRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getDeploymentExecutionReportRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getDeploymentExecutionReportRecord"]> {
    return this.delegateLegacy("getDeploymentExecutionReportRecord", "release", "getDeploymentExecutionReportRecord", ...args);
  }

  public override getReleaseExecutionReportRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getReleaseExecutionReportRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getReleaseExecutionReportRecord"]> {
    return this.delegateLegacy("getReleaseExecutionReportRecord", "release", "getReleaseExecutionReportRecord", ...args);
  }

  public override listReleaseExecutionReportRecords(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listReleaseExecutionReportRecords"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listReleaseExecutionReportRecords"]> {
    return this.delegateLegacy("listReleaseExecutionReportRecords", "release", "listReleaseExecutionReportRecords", ...args);
  }

  public override listDeploymentExecutionReportRecords(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listDeploymentExecutionReportRecords"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listDeploymentExecutionReportRecords"]> {
    return this.delegateLegacy("listDeploymentExecutionReportRecords", "release", "listDeploymentExecutionReportRecords", ...args);
  }

  public override listEnvironmentPromotionHistoryRecords(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listEnvironmentPromotionHistoryRecords"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listEnvironmentPromotionHistoryRecords"]> {
    return this.delegateLegacy("listEnvironmentPromotionHistoryRecords", "release", "listEnvironmentPromotionHistoryRecords", ...args);
  }

  public override upsertEnvironmentReadinessRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertEnvironmentReadinessRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertEnvironmentReadinessRecord"]> {
    return this.delegateLegacy("upsertEnvironmentReadinessRecord", "release", "upsertEnvironmentReadinessRecord", ...args);
  }

  public override getActiveEnvironmentReadinessRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getActiveEnvironmentReadinessRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getActiveEnvironmentReadinessRecord"]> {
    return this.delegateLegacy("getActiveEnvironmentReadinessRecord", "release", "getActiveEnvironmentReadinessRecord", ...args);
  }

  public override listEnvironmentReadinessRecords(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listEnvironmentReadinessRecords"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listEnvironmentReadinessRecords"]> {
    return this.delegateLegacy("listEnvironmentReadinessRecords", "release", "listEnvironmentReadinessRecords", ...args);
  }

  public override insertEnterpriseCapabilityReport(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertEnterpriseCapabilityReport"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertEnterpriseCapabilityReport"]> {
    return this.delegateLegacy("insertEnterpriseCapabilityReport", "release", "insertEnterpriseCapabilityReport", ...args);
  }

  public override insertIncidentHandoffRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertIncidentHandoffRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertIncidentHandoffRecord"]> {
    return this.delegateLegacy("insertIncidentHandoffRecord", "release", "insertIncidentHandoffRecord", ...args);
  }

  public override insertEnterpriseGovernanceReport(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertEnterpriseGovernanceReport"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertEnterpriseGovernanceReport"]> {
    return this.delegateLegacy("insertEnterpriseGovernanceReport", "release", "insertEnterpriseGovernanceReport", ...args);
  }

  public override listEnterpriseCapabilityReports(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listEnterpriseCapabilityReports"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listEnterpriseCapabilityReports"]> {
    return this.delegateLegacy("listEnterpriseCapabilityReports", "release", "listEnterpriseCapabilityReports", ...args);
  }

  public override listIncidentHandoffRecords(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listIncidentHandoffRecords"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listIncidentHandoffRecords"]> {
    return this.delegateLegacy("listIncidentHandoffRecords", "release", "listIncidentHandoffRecords", ...args);
  }

  public override listEnterpriseGovernanceReports(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listEnterpriseGovernanceReports"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listEnterpriseGovernanceReports"]> {
    return this.delegateLegacy("listEnterpriseGovernanceReports", "release", "listEnterpriseGovernanceReports", ...args);
  }

  public override upsertWorkspaceRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertWorkspaceRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertWorkspaceRecord"]> {
    return this.delegateLegacy("upsertWorkspaceRecord", "organization", "upsertWorkspaceRecord", ...args);
  }

  public override upsertWorkspaceMembershipRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertWorkspaceMembershipRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertWorkspaceMembershipRecord"]> {
    return this.delegateLegacy("upsertWorkspaceMembershipRecord", "organization", "upsertWorkspaceMembershipRecord", ...args);
  }

  public override upsertOrganizationRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertOrganizationRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertOrganizationRecord"]> {
    return this.delegateLegacy("upsertOrganizationRecord", "organization", "upsertOrganizationRecord", ...args);
  }

  public override upsertOrganizationMembershipRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertOrganizationMembershipRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertOrganizationMembershipRecord"]> {
    return this.delegateLegacy("upsertOrganizationMembershipRecord", "organization", "upsertOrganizationMembershipRecord", ...args);
  }

  public override upsertTenantRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertTenantRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertTenantRecord"]> {
    return this.delegateLegacy("upsertTenantRecord", "organization", "upsertTenantRecord", ...args);
  }

  public override upsertDeploymentBindingRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertDeploymentBindingRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertDeploymentBindingRecord"]> {
    return this.delegateLegacy("upsertDeploymentBindingRecord", "organization", "upsertDeploymentBindingRecord", ...args);
  }

  public override upsertDataNamespaceRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertDataNamespaceRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertDataNamespaceRecord"]> {
    return this.delegateLegacy("upsertDataNamespaceRecord", "organization", "upsertDataNamespaceRecord", ...args);
  }

  public override getWorkspaceRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getWorkspaceRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getWorkspaceRecord"]> {
    return this.delegateLegacy("getWorkspaceRecord", "organization", "getWorkspaceRecord", ...args);
  }

  public override listWorkspaceRecords(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listWorkspaceRecords"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listWorkspaceRecords"]> {
    return this.delegateLegacy("listWorkspaceRecords", "organization", "listWorkspaceRecords", ...args);
  }

  public override listWorkspaceMemberships(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listWorkspaceMemberships"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listWorkspaceMemberships"]> {
    return this.delegateLegacy("listWorkspaceMemberships", "organization", "listWorkspaceMemberships", ...args);
  }

  public override getOrganizationRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getOrganizationRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getOrganizationRecord"]> {
    return this.delegateLegacy("getOrganizationRecord", "organization", "getOrganizationRecord", ...args);
  }

  public override listOrganizationRecords(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listOrganizationRecords"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listOrganizationRecords"]> {
    return this.delegateLegacy("listOrganizationRecords", "organization", "listOrganizationRecords", ...args);
  }

  public override listOrganizationMemberships(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listOrganizationMemberships"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listOrganizationMemberships"]> {
    return this.delegateLegacy("listOrganizationMemberships", "organization", "listOrganizationMemberships", ...args);
  }

  public override getTenantRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getTenantRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getTenantRecord"]> {
    return this.delegateLegacy("getTenantRecord", "organization", "getTenantRecord", ...args);
  }

  public override listTenantRecords(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listTenantRecords"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listTenantRecords"]> {
    return this.delegateLegacy("listTenantRecords", "organization", "listTenantRecords", ...args);
  }

  public override getDeploymentBindingRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getDeploymentBindingRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getDeploymentBindingRecord"]> {
    return this.delegateLegacy("getDeploymentBindingRecord", "organization", "getDeploymentBindingRecord", ...args);
  }

  public override listDeploymentBindings(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listDeploymentBindings"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listDeploymentBindings"]> {
    return this.delegateLegacy("listDeploymentBindings", "organization", "listDeploymentBindings", ...args);
  }

  public override getDataNamespaceRecord(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getDataNamespaceRecord"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getDataNamespaceRecord"]> {
    return this.delegateLegacy("getDataNamespaceRecord", "organization", "getDataNamespaceRecord", ...args);
  }

  public override listDataNamespaces(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listDataNamespaces"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listDataNamespaces"]> {
    return this.delegateLegacy("listDataNamespaces", "organization", "listDataNamespaces", ...args);
  }

  public override upsertMarketplaceReview(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertMarketplaceReview"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertMarketplaceReview"]> {
    return this.delegateLegacy("upsertMarketplaceReview", "marketplace", "upsertMarketplaceReview", ...args);
  }

  public override upsertMarketplacePublication(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertMarketplacePublication"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertMarketplacePublication"]> {
    return this.delegateLegacy("upsertMarketplacePublication", "marketplace", "upsertMarketplacePublication", ...args);
  }

  public override insertMarketplaceGovernanceReport(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertMarketplaceGovernanceReport"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertMarketplaceGovernanceReport"]> {
    return this.delegateLegacy("insertMarketplaceGovernanceReport", "marketplace", "insertMarketplaceGovernanceReport", ...args);
  }

  public override upsertExtensionPackage(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertExtensionPackage"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertExtensionPackage"]> {
    return this.delegateLegacy("upsertExtensionPackage", "marketplace", "upsertExtensionPackage", ...args);
  }

  public override getExtensionPackage(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getExtensionPackage"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getExtensionPackage"]> {
    return this.delegateLegacy("getExtensionPackage", "marketplace", "getExtensionPackage", ...args);
  }

  public override listExtensionPackages(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listExtensionPackages"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listExtensionPackages"]> {
    return this.delegateLegacy("listExtensionPackages", "marketplace", "listExtensionPackages", ...args);
  }

  public override getMarketplaceReview(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getMarketplaceReview"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getMarketplaceReview"]> {
    return this.delegateLegacy("getMarketplaceReview", "marketplace", "getMarketplaceReview", ...args);
  }

  public override listMarketplaceReviews(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listMarketplaceReviews"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listMarketplaceReviews"]> {
    return this.delegateLegacy("listMarketplaceReviews", "marketplace", "listMarketplaceReviews", ...args);
  }

  public override getLatestMarketplaceReviewForPackage(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getLatestMarketplaceReviewForPackage"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getLatestMarketplaceReviewForPackage"]> {
    return this.delegateLegacy("getLatestMarketplaceReviewForPackage", "marketplace", "getLatestMarketplaceReviewForPackage", ...args);
  }

  public override getMarketplacePublication(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getMarketplacePublication"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getMarketplacePublication"]> {
    return this.delegateLegacy("getMarketplacePublication", "marketplace", "getMarketplacePublication", ...args);
  }

  public override getActiveMarketplacePublicationForPackage(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getActiveMarketplacePublicationForPackage"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getActiveMarketplacePublicationForPackage"]> {
    return this.delegateLegacy("getActiveMarketplacePublicationForPackage", "marketplace", "getActiveMarketplacePublicationForPackage", ...args);
  }

  public override listMarketplacePublications(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listMarketplacePublications"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listMarketplacePublications"]> {
    return this.delegateLegacy("listMarketplacePublications", "marketplace", "listMarketplacePublications", ...args);
  }

  public override listMarketplaceGovernanceReports(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listMarketplaceGovernanceReports"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listMarketplaceGovernanceReports"]> {
    return this.delegateLegacy("listMarketplaceGovernanceReports", "marketplace", "listMarketplaceGovernanceReports", ...args);
  }

  public override upsertPerceptionSource(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["upsertPerceptionSource"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["upsertPerceptionSource"]> {
    return this.delegateLegacy("upsertPerceptionSource", "intelligence", "upsertPerceptionSource", ...args);
  }

  public override insertIntelItem(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertIntelItem"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertIntelItem"]> {
    return this.delegateLegacy("insertIntelItem", "intelligence", "insertIntelItem", ...args);
  }

  public override insertIntelBrief(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertIntelBrief"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertIntelBrief"]> {
    return this.delegateLegacy("insertIntelBrief", "intelligence", "insertIntelBrief", ...args);
  }

  public override insertActionProposal(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["insertActionProposal"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["insertActionProposal"]> {
    return this.delegateLegacy("insertActionProposal", "intelligence", "insertActionProposal", ...args);
  }

  public override getPerceptionSource(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getPerceptionSource"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getPerceptionSource"]> {
    return this.delegateLegacy("getPerceptionSource", "intelligence", "getPerceptionSource", ...args);
  }

  public override listPerceptionSources(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listPerceptionSources"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listPerceptionSources"]> {
    return this.delegateLegacy("listPerceptionSources", "intelligence", "listPerceptionSources", ...args);
  }

  public override getIntelItemBySourceAndDedupeKey(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getIntelItemBySourceAndDedupeKey"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getIntelItemBySourceAndDedupeKey"]> {
    return this.delegateLegacy("getIntelItemBySourceAndDedupeKey", "intelligence", "getIntelItemBySourceAndDedupeKey", ...args);
  }

  public override listIntelItems(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listIntelItems"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listIntelItems"]> {
    return this.delegateLegacy("listIntelItems", "intelligence", "listIntelItems", ...args);
  }

  public override listIntelItemsByIds(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listIntelItemsByIds"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listIntelItemsByIds"]> {
    return this.delegateLegacy("listIntelItemsByIds", "intelligence", "listIntelItemsByIds", ...args);
  }

  public override getIntelBrief(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["getIntelBrief"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["getIntelBrief"]> {
    return this.delegateLegacy("getIntelBrief", "intelligence", "getIntelBrief", ...args);
  }

  public override listIntelBriefs(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listIntelBriefs"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listIntelBriefs"]> {
    return this.delegateLegacy("listIntelBriefs", "intelligence", "listIntelBriefs", ...args);
  }

  public override listActionProposalsByBrief(...args: Parameters<AuthoritativeTaskStoreLegacyCompat["listActionProposalsByBrief"]>): ReturnType<AuthoritativeTaskStoreLegacyCompat["listActionProposalsByBrief"]> {
    return this.delegateLegacy("listActionProposalsByBrief", "intelligence", "listActionProposalsByBrief", ...args);
  }
}
/* c8 ignore stop */
