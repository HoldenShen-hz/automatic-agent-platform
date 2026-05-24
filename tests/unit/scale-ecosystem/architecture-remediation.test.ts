import assert from "node:assert/strict";
import test from "node:test";

import {
  MarketplaceLifecycleState,
  RemoteSessionState,
  SlaBreachType,
  buildBillingAdjustment,
  buildScaleEcosystemRemediationEvidence,
  compareFairQueueEntries,
  validateListingDependencies,
  type BillingAdjustment,
  type CapacitySignal,
  type CostAttributionRecord,
  type CrossRegionRoutingAuditRecord,
  type ListingDependency,
  type MarketplaceCatalogEntry,
  type RevenueSharePolicy,
} from "../../../src/scale-ecosystem/architecture-remediation.js";

test("architecture remediation exports the documented state enums", () => {
  const lifecycleStates: MarketplaceLifecycleState[] = ["active", "deprecated", "sunset", "removed"];
  const remoteStates: RemoteSessionState[] = ["connecting", "connected", "reconnecting", "degraded", "failed", "viewer_only"];
  const breachTypes: SlaBreachType[] = ["latency", "success_rate", "queue_wait", "execution_timeout", "dependency_unavailability"];

  assert.equal(lifecycleStates.length, 4);
  assert.equal(remoteStates.length, 6);
  assert.equal(breachTypes.length, 5);
});

test("marketplace, revenue, capacity, cost, and routing records match the current contract", () => {
  const entry: MarketplaceCatalogEntry = {
    entryId: "entry-001",
    publisherId: "publisher-001",
    artifactType: "pack",
    artifactRef: "artifact/ref@v1.0.0",
    pricingModel: "usage",
    capabilities: ["capability-1", "capability-2"],
    version: "1.0.0",
    lifecycleState: "active",
  };
  const policy: RevenueSharePolicy = {
    policyId: "policy-001",
    grossSplit: { publisher: 70, platform: 30 },
    taxHandling: "platform_withheld",
    refundPolicy: "independent_adjustment",
    settlementCycle: "monthly",
  };
  const capacity: CapacitySignal = {
    signalId: "signal-001",
    slaTier: "premium",
    queueDelayMs: 150,
    budgetPressure: 0.75,
    approvalCapacity: 100,
    providerQuotaRemaining: 5000,
    regionFailoverReserve: 0.2,
  };
  const cost: CostAttributionRecord = {
    recordId: "cost-001",
    harnessRunId: "harness-001",
    nodeRunId: "node-001",
    budgetSettlementId: "budget-001",
    humanReviewCost: 25,
    egressCost: 5.5,
    computeCost: 100,
    storageCost: 10.25,
    qualityRisk: "medium",
  };
  const routing: CrossRegionRoutingAuditRecord = {
    decisionId: "decision-001",
    tenantId: "tenant-001",
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    policyRef: "policy:cross-region",
    evidenceRefs: ["evidence-1"],
  };

  assert.equal(entry.entryId, "entry-001");
  assert.equal(policy.grossSplit.publisher, 70);
  assert.equal(capacity.budgetPressure <= 1, true);
  assert.equal(cost.qualityRisk, "medium");
  assert.equal(routing.targetRegion, "eu-west-1");
});

test("buildBillingAdjustment always preserves the usage ledger", () => {
  const adjustment = buildBillingAdjustment({
    adjustmentId: "adj-001",
    accountId: "acc-001",
    invoiceId: "inv-001",
    amount: 50,
    reason: "Promotional credit",
  });

  assert.deepEqual(adjustment, {
    adjustmentId: "adj-001",
    accountId: "acc-001",
    invoiceId: "inv-001",
    amount: 50,
    reason: "Promotional credit",
    preservesUsageLedger: true,
  } satisfies BillingAdjustment);
});

test("compareFairQueueEntries prioritizes SLA tier, then priority, then stable identifiers", () => {
  const higherSla = compareFairQueueEntries(
    { tenantId: "tenant-b", orgId: "org", domainId: "ops", slaTier: 1, priority: 5 },
    { tenantId: "tenant-a", orgId: "org", domainId: "ops", slaTier: 2, priority: 1 },
  );
  const tieBrokenByPriority = compareFairQueueEntries(
    { tenantId: "tenant-b", orgId: "org", domainId: "ops", slaTier: 2, priority: 1 },
    { tenantId: "tenant-a", orgId: "org", domainId: "ops", slaTier: 2, priority: 5 },
  );

  assert.equal(higherSla > 0, true);
  assert.equal(tieBrokenByPriority > 0, true);
});

test("validateListingDependencies reports missing compatibility evidence using entry ids", () => {
  const dependencies: ListingDependency[] = [
    {
      entryId: "entry-a",
      dependsOnEntryId: "entry-b",
      versionRange: "^1.0.0",
      compatibilityEvidenceRef: "evidence:1",
    },
    {
      entryId: "entry-a",
      dependsOnEntryId: "entry-c",
      versionRange: "^2.0.0",
      compatibilityEvidenceRef: "",
    },
  ];

  const result = validateListingDependencies(dependencies);
  assert.equal(result.valid, false);
  assert.deepEqual(result.missingEvidenceIds, ["entry-c"]);
});

test("buildScaleEcosystemRemediationEvidence returns the full 20-item remediation checklist", () => {
  const evidence = buildScaleEcosystemRemediationEvidence();

  assert.equal(evidence.length, 20);
  assert.equal(evidence[0], "S-1");
  assert.equal(evidence[19], "S-20");
});
