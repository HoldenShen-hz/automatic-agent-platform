import { AuthoritativeTaskStoreDelegatingEngagement, } from "./authoritative-task-store-delegating-engagement.js";
export class AuthoritativeTaskStoreDelegatingGovernance extends AuthoritativeTaskStoreDelegatingEngagement {
    upsertSecretRegistryRecord(...args) {
        return this.delegateLegacy("upsertSecretRegistryRecord", "secret", "upsertSecretRegistryRecord", ...args);
    }
    insertSecretUsageAudit(...args) {
        return this.delegateLegacy("insertSecretUsageAudit", "secret", "insertSecretUsageAudit", ...args);
    }
    insertSecretRotationEvent(...args) {
        return this.delegateLegacy("insertSecretRotationEvent", "secret", "insertSecretRotationEvent", ...args);
    }
    upsertSecretLeaseRecord(...args) {
        return this.delegateLegacy("upsertSecretLeaseRecord", "secret", "upsertSecretLeaseRecord", ...args);
    }
    getSecretRegistryRecord(...args) {
        return this.delegateLegacy("getSecretRegistryRecord", "secret", "getSecretRegistryRecord", ...args);
    }
    listSecretRegistryRecords(...args) {
        return this.delegateLegacy("listSecretRegistryRecords", "secret", "listSecretRegistryRecords", ...args);
    }
    listSecretUsageAuditsBySecretRef(...args) {
        return this.delegateLegacy("listSecretUsageAuditsBySecretRef", "secret", "listSecretUsageAuditsBySecretRef", ...args);
    }
    listSecretRotationEventsBySecretRef(...args) {
        return this.delegateLegacy("listSecretRotationEventsBySecretRef", "secret", "listSecretRotationEventsBySecretRef", ...args);
    }
    getSecretLeaseRecord(...args) {
        return this.delegateLegacy("getSecretLeaseRecord", "secret", "getSecretLeaseRecord", ...args);
    }
    listSecretLeasesBySecretRef(...args) {
        return this.delegateLegacy("listSecretLeasesBySecretRef", "secret", "listSecretLeasesBySecretRef", ...args);
    }
    insertEvolutionProposal(...args) {
        return this.delegateLegacy("insertEvolutionProposal", "evolution", "insertEvolutionProposal", ...args);
    }
    updateEvolutionProposal(...args) {
        return this.delegateLegacy("updateEvolutionProposal", "evolution", "updateEvolutionProposal", ...args);
    }
    getEvolutionProposal(...args) {
        return this.delegateLegacy("getEvolutionProposal", "evolution", "getEvolutionProposal", ...args);
    }
    listEvolutionProposals(...args) {
        return this.delegateLegacy("listEvolutionProposals", "evolution", "listEvolutionProposals", ...args);
    }
    insertEvolutionPolicy(...args) {
        return this.delegateLegacy("insertEvolutionPolicy", "evolution", "insertEvolutionPolicy", ...args);
    }
    updateEvolutionPolicy(...args) {
        return this.delegateLegacy("updateEvolutionPolicy", "evolution", "updateEvolutionPolicy", ...args);
    }
    getEvolutionPolicyByProposal(...args) {
        return this.delegateLegacy("getEvolutionPolicyByProposal", "evolution", "getEvolutionPolicyByProposal", ...args);
    }
    listEvolutionPolicies(...args) {
        return this.delegateLegacy("listEvolutionPolicies", "evolution", "listEvolutionPolicies", ...args);
    }
    insertEvolutionLog(...args) {
        return this.delegateLegacy("insertEvolutionLog", "evolution", "insertEvolutionLog", ...args);
    }
    listEvolutionLogsByProposal(...args) {
        return this.delegateLegacy("listEvolutionLogsByProposal", "evolution", "listEvolutionLogsByProposal", ...args);
    }
    insertReleaseBundleRecord(...args) {
        return this.delegateLegacy("insertReleaseBundleRecord", "release", "insertReleaseBundleRecord", ...args);
    }
    insertReleaseExecutionReportRecord(...args) {
        return this.delegateLegacy("insertReleaseExecutionReportRecord", "release", "insertReleaseExecutionReportRecord", ...args);
    }
    insertDeploymentExecutionReportRecord(...args) {
        return this.delegateLegacy("insertDeploymentExecutionReportRecord", "release", "insertDeploymentExecutionReportRecord", ...args);
    }
    insertEnvironmentPromotionHistoryRecord(...args) {
        return this.delegateLegacy("insertEnvironmentPromotionHistoryRecord", "release", "insertEnvironmentPromotionHistoryRecord", ...args);
    }
    getReleaseBundleRecord(...args) {
        return this.delegateLegacy("getReleaseBundleRecord", "release", "getReleaseBundleRecord", ...args);
    }
    listReleaseBundleRecords(...args) {
        return this.delegateLegacy("listReleaseBundleRecords", "release", "listReleaseBundleRecords", ...args);
    }
    getDeploymentExecutionReportRecord(...args) {
        return this.delegateLegacy("getDeploymentExecutionReportRecord", "release", "getDeploymentExecutionReportRecord", ...args);
    }
    getReleaseExecutionReportRecord(...args) {
        return this.delegateLegacy("getReleaseExecutionReportRecord", "release", "getReleaseExecutionReportRecord", ...args);
    }
    listReleaseExecutionReportRecords(...args) {
        return this.delegateLegacy("listReleaseExecutionReportRecords", "release", "listReleaseExecutionReportRecords", ...args);
    }
    listDeploymentExecutionReportRecords(...args) {
        return this.delegateLegacy("listDeploymentExecutionReportRecords", "release", "listDeploymentExecutionReportRecords", ...args);
    }
    listEnvironmentPromotionHistoryRecords(...args) {
        return this.delegateLegacy("listEnvironmentPromotionHistoryRecords", "release", "listEnvironmentPromotionHistoryRecords", ...args);
    }
    upsertEnvironmentReadinessRecord(...args) {
        return this.delegateLegacy("upsertEnvironmentReadinessRecord", "release", "upsertEnvironmentReadinessRecord", ...args);
    }
    getActiveEnvironmentReadinessRecord(...args) {
        return this.delegateLegacy("getActiveEnvironmentReadinessRecord", "release", "getActiveEnvironmentReadinessRecord", ...args);
    }
    listEnvironmentReadinessRecords(...args) {
        return this.delegateLegacy("listEnvironmentReadinessRecords", "release", "listEnvironmentReadinessRecords", ...args);
    }
    insertEnterpriseCapabilityReport(...args) {
        return this.delegateLegacy("insertEnterpriseCapabilityReport", "release", "insertEnterpriseCapabilityReport", ...args);
    }
    insertIncidentHandoffRecord(...args) {
        return this.delegateLegacy("insertIncidentHandoffRecord", "release", "insertIncidentHandoffRecord", ...args);
    }
    insertEnterpriseGovernanceReport(...args) {
        return this.delegateLegacy("insertEnterpriseGovernanceReport", "release", "insertEnterpriseGovernanceReport", ...args);
    }
    listEnterpriseCapabilityReports(...args) {
        return this.delegateLegacy("listEnterpriseCapabilityReports", "release", "listEnterpriseCapabilityReports", ...args);
    }
    listIncidentHandoffRecords(...args) {
        return this.delegateLegacy("listIncidentHandoffRecords", "release", "listIncidentHandoffRecords", ...args);
    }
    listEnterpriseGovernanceReports(...args) {
        return this.delegateLegacy("listEnterpriseGovernanceReports", "release", "listEnterpriseGovernanceReports", ...args);
    }
    upsertWorkspaceRecord(...args) {
        return this.delegateLegacy("upsertWorkspaceRecord", "organization", "upsertWorkspaceRecord", ...args);
    }
    upsertWorkspaceMembershipRecord(...args) {
        return this.delegateLegacy("upsertWorkspaceMembershipRecord", "organization", "upsertWorkspaceMembershipRecord", ...args);
    }
    upsertOrganizationRecord(...args) {
        return this.delegateLegacy("upsertOrganizationRecord", "organization", "upsertOrganizationRecord", ...args);
    }
    upsertOrganizationMembershipRecord(...args) {
        return this.delegateLegacy("upsertOrganizationMembershipRecord", "organization", "upsertOrganizationMembershipRecord", ...args);
    }
    upsertTenantRecord(...args) {
        return this.delegateLegacy("upsertTenantRecord", "organization", "upsertTenantRecord", ...args);
    }
    upsertDeploymentBindingRecord(...args) {
        return this.delegateLegacy("upsertDeploymentBindingRecord", "organization", "upsertDeploymentBindingRecord", ...args);
    }
    upsertDataNamespaceRecord(...args) {
        return this.delegateLegacy("upsertDataNamespaceRecord", "organization", "upsertDataNamespaceRecord", ...args);
    }
    getWorkspaceRecord(...args) {
        return this.delegateLegacy("getWorkspaceRecord", "organization", "getWorkspaceRecord", ...args);
    }
    listWorkspaceRecords(...args) {
        return this.delegateLegacy("listWorkspaceRecords", "organization", "listWorkspaceRecords", ...args);
    }
    listWorkspaceMemberships(...args) {
        return this.delegateLegacy("listWorkspaceMemberships", "organization", "listWorkspaceMemberships", ...args);
    }
    getOrganizationRecord(...args) {
        return this.delegateLegacy("getOrganizationRecord", "organization", "getOrganizationRecord", ...args);
    }
    listOrganizationRecords(...args) {
        return this.delegateLegacy("listOrganizationRecords", "organization", "listOrganizationRecords", ...args);
    }
    listOrganizationMemberships(...args) {
        return this.delegateLegacy("listOrganizationMemberships", "organization", "listOrganizationMemberships", ...args);
    }
    getTenantRecord(...args) {
        return this.delegateLegacy("getTenantRecord", "organization", "getTenantRecord", ...args);
    }
    listTenantRecords(...args) {
        return this.delegateLegacy("listTenantRecords", "organization", "listTenantRecords", ...args);
    }
    getDeploymentBindingRecord(...args) {
        return this.delegateLegacy("getDeploymentBindingRecord", "organization", "getDeploymentBindingRecord", ...args);
    }
    listDeploymentBindings(...args) {
        return this.delegateLegacy("listDeploymentBindings", "organization", "listDeploymentBindings", ...args);
    }
    getDataNamespaceRecord(...args) {
        return this.delegateLegacy("getDataNamespaceRecord", "organization", "getDataNamespaceRecord", ...args);
    }
    listDataNamespaces(...args) {
        return this.delegateLegacy("listDataNamespaces", "organization", "listDataNamespaces", ...args);
    }
    upsertMarketplaceReview(...args) {
        return this.delegateLegacy("upsertMarketplaceReview", "marketplace", "upsertMarketplaceReview", ...args);
    }
    upsertMarketplacePublication(...args) {
        return this.delegateLegacy("upsertMarketplacePublication", "marketplace", "upsertMarketplacePublication", ...args);
    }
    insertMarketplaceGovernanceReport(...args) {
        return this.delegateLegacy("insertMarketplaceGovernanceReport", "marketplace", "insertMarketplaceGovernanceReport", ...args);
    }
    upsertExtensionPackage(...args) {
        return this.delegateLegacy("upsertExtensionPackage", "marketplace", "upsertExtensionPackage", ...args);
    }
    getExtensionPackage(...args) {
        return this.delegateLegacy("getExtensionPackage", "marketplace", "getExtensionPackage", ...args);
    }
    listExtensionPackages(...args) {
        return this.delegateLegacy("listExtensionPackages", "marketplace", "listExtensionPackages", ...args);
    }
    getMarketplaceReview(...args) {
        return this.delegateLegacy("getMarketplaceReview", "marketplace", "getMarketplaceReview", ...args);
    }
    listMarketplaceReviews(...args) {
        return this.delegateLegacy("listMarketplaceReviews", "marketplace", "listMarketplaceReviews", ...args);
    }
    getLatestMarketplaceReviewForPackage(...args) {
        return this.delegateLegacy("getLatestMarketplaceReviewForPackage", "marketplace", "getLatestMarketplaceReviewForPackage", ...args);
    }
    getMarketplacePublication(...args) {
        return this.delegateLegacy("getMarketplacePublication", "marketplace", "getMarketplacePublication", ...args);
    }
    getActiveMarketplacePublicationForPackage(...args) {
        return this.delegateLegacy("getActiveMarketplacePublicationForPackage", "marketplace", "getActiveMarketplacePublicationForPackage", ...args);
    }
    listMarketplacePublications(...args) {
        return this.delegateLegacy("listMarketplacePublications", "marketplace", "listMarketplacePublications", ...args);
    }
    listMarketplaceGovernanceReports(...args) {
        return this.delegateLegacy("listMarketplaceGovernanceReports", "marketplace", "listMarketplaceGovernanceReports", ...args);
    }
    upsertPerceptionSource(...args) {
        return this.delegateLegacy("upsertPerceptionSource", "intelligence", "upsertPerceptionSource", ...args);
    }
    insertIntelItem(...args) {
        return this.delegateLegacy("insertIntelItem", "intelligence", "insertIntelItem", ...args);
    }
    insertIntelBrief(...args) {
        return this.delegateLegacy("insertIntelBrief", "intelligence", "insertIntelBrief", ...args);
    }
    insertActionProposal(...args) {
        return this.delegateLegacy("insertActionProposal", "intelligence", "insertActionProposal", ...args);
    }
    getPerceptionSource(...args) {
        return this.delegateLegacy("getPerceptionSource", "intelligence", "getPerceptionSource", ...args);
    }
    listPerceptionSources(...args) {
        return this.delegateLegacy("listPerceptionSources", "intelligence", "listPerceptionSources", ...args);
    }
    getIntelItemBySourceAndDedupeKey(...args) {
        return this.delegateLegacy("getIntelItemBySourceAndDedupeKey", "intelligence", "getIntelItemBySourceAndDedupeKey", ...args);
    }
    listIntelItems(...args) {
        return this.delegateLegacy("listIntelItems", "intelligence", "listIntelItems", ...args);
    }
    listIntelItemsByIds(...args) {
        return this.delegateLegacy("listIntelItemsByIds", "intelligence", "listIntelItemsByIds", ...args);
    }
    getIntelBrief(...args) {
        return this.delegateLegacy("getIntelBrief", "intelligence", "getIntelBrief", ...args);
    }
    listIntelBriefs(...args) {
        return this.delegateLegacy("listIntelBriefs", "intelligence", "listIntelBriefs", ...args);
    }
    listActionProposalsByBrief(...args) {
        return this.delegateLegacy("listActionProposalsByBrief", "intelligence", "listActionProposalsByBrief", ...args);
    }
}
/* c8 ignore stop */
//# sourceMappingURL=authoritative-task-store-delegating-governance.js.map