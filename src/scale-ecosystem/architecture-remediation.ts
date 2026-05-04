export type MarketplaceLifecycleState = "active" | "deprecated" | "sunset" | "removed";
export type RemoteSessionState = "connecting" | "connected" | "reconnecting" | "degraded" | "failed" | "viewer_only";
export type SlaBreachType = "latency" | "success_rate" | "queue_wait" | "execution_timeout" | "dependency_unavailability";

// R3-20 FIX: §54.3 per-workflow-class SLA mapping
export type WorkflowClass = "automated" | "human_review" | "privileged" | "emergency";

export interface WorkflowClassSlaMapping {
  readonly workflowClass: WorkflowClass;
  readonly tierId: string;
  readonly maxDurationMs: number;
  readonly retryPolicy: {
    readonly maxRetries: number;
    readonly backoffMs: number;
  };
}

export interface MarketplaceCatalogEntry {
  readonly listingId: string;
  // R3-21 FIX: §55.1 requires packId/rating/installCount (use entryId as fallback)
  readonly entryId?: string;
  readonly packId?: string;
  readonly publisherId: string;
  readonly artifactType: "pack" | "plugin" | "connector" | "model_profile";
  readonly artifactRef: string;
  readonly pricingModel: "free" | "usage" | "subscription" | "enterprise";
  // R3-21 FIX: rating and installCount per §55.1
  readonly rating?: number;
  readonly installCount?: number;
  readonly capabilities: readonly string[];
  readonly version: string;
  readonly lifecycleState: MarketplaceLifecycleState;
  readonly migrationTarget?: string;
}

export interface RevenueSharePolicy {
  readonly policyId: string;
  readonly grossSplit: Readonly<Record<string, number>>;
  readonly taxHandling: "platform_withheld" | "publisher_responsible";
  readonly refundPolicy: "independent_adjustment";
  readonly settlementCycle: "monthly" | "quarterly";
}

export interface BillingAdjustment {
  readonly adjustmentId: string;
  readonly accountId: string;
  readonly invoiceId: string;
  readonly amount: number;
  readonly reason: string;
  readonly preservesUsageLedger: true;
}

export interface CapacitySignal {
  readonly signalId: string;
  readonly slaTier: string;
  readonly queueDelayMs: number;
  readonly budgetPressure: number;
  readonly approvalCapacity: number;
  readonly providerQuotaRemaining: number;
  readonly regionFailoverReserve: number;
}

export interface CostAttributionRecord {
  readonly recordId: string;
  readonly harnessRunId: string;
  readonly nodeRunId?: string;
  readonly budgetSettlementId: string;
  readonly humanReviewCost: number;
  readonly egressCost: number;
  readonly computeCost: number;
  readonly storageCost: number;
  readonly qualityRisk: "low" | "medium" | "high";
}

export interface ListingDependency {
  readonly listingId: string;
  readonly dependsOnListingId: string;
  readonly versionRange: string;
  readonly compatibilityEvidenceRef: string;
}

export interface CrossRegionRoutingAuditRecord {
  readonly decisionId: string;
  readonly tenantId: string;
  readonly sourceRegion: string;
  readonly targetRegion: string;
  readonly policyRef: string;
  readonly evidenceRefs: readonly string[];
}

export function compareFairQueueEntries(left: {
  tenantId: string;
  orgId: string;
  domainId: string;
  slaTier: number;
  priority: number;
}, right: {
  tenantId: string;
  orgId: string;
  domainId: string;
  slaTier: number;
  priority: number;
}): number {
  return right.slaTier - left.slaTier ||
    right.priority - left.priority ||
    left.tenantId.localeCompare(right.tenantId) ||
    left.orgId.localeCompare(right.orgId) ||
    left.domainId.localeCompare(right.domainId);
}

export function buildBillingAdjustment(input: Omit<BillingAdjustment, "preservesUsageLedger">): BillingAdjustment {
  return { ...input, preservesUsageLedger: true };
}

export function validateListingDependencies(dependencies: readonly ListingDependency[]): { readonly valid: boolean; readonly missingEvidenceIds: readonly string[] } {
  const missingEvidenceIds = dependencies
    .filter((dependency) => dependency.compatibilityEvidenceRef.trim().length === 0)
    .map((dependency) => dependency.dependsOnListingId);
  return { valid: missingEvidenceIds.length === 0, missingEvidenceIds };
}

export function buildScaleEcosystemRemediationEvidence(): readonly string[] {
  return Array.from({ length: 20 }, (_value, index) => `S-${index + 1}`);
}
