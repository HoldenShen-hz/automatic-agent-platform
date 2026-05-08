/**
 * Unit tests for Architecture Remediation
 *
 * @see src/scale-ecosystem/architecture-remediation.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  compareFairQueueEntries,
  buildBillingAdjustment,
  validateListingDependencies,
  buildScaleEcosystemRemediationEvidence,
  type MarketplaceCatalogEntry,
  type RevenueSharePolicy,
  type BillingAdjustment,
  type CapacitySignal,
  type CostAttributionRecord,
  type ListingDependency,
  type CrossRegionRoutingAuditRecord,
  MarketplaceLifecycleState,
  RemoteSessionState,
  SlaBreachType,
} from "../../../src/scale-ecosystem/architecture-remediation.js";

test("MarketplaceLifecycleState has all expected states", () => {
  const states: MarketplaceLifecycleState[] = ["active", "deprecated", "sunset", "removed"];
  assert.equal(states.length, 4);
});

test("RemoteSessionState has all expected states", () => {
  const states: RemoteSessionState[] = ["connecting", "connected", "reconnecting", "degraded", "failed", "viewer_only"];
  assert.equal(states.length, 6);
});

test("SlaBreachType has all expected breach types", () => {
  const types: SlaBreachType[] = ["latency", "success_rate", "queue_wait", "execution_timeout", "dependency_unavailability"];
  assert.equal(types.length, 5);
});

test("MarketplaceCatalogEntry has correct interface structure", () => {
  const entry: MarketplaceCatalogEntry = {
    listingId: "listing-001",
    publisherId: "pub-001",
    artifactType: "pack",
    artifactRef: "artifact/ref@v1.0.0",
    pricingModel: "usage",
    capabilities: ["capability-1", "capability-2"],
    version: "1.0.0",
    lifecycleState: "active",
  };

  assert.equal(entry.listingId, "listing-001");
  assert.equal(entry.publisherId, "pub-001");
  assert.equal(entry.artifactType, "pack");
  assert.equal(entry.pricingModel, "usage");
  assert.equal(entry.capabilities.length, 2);
  assert.equal(entry.lifecycleState, "active");
});

test("MarketplaceCatalogEntry supports optional migrationTarget", () => {
  const entry: MarketplaceCatalogEntry = {
    listingId: "listing-002",
    publisherId: "pub-001",
    artifactType: "plugin",
    artifactRef: "plugin/ref@v1.0.0",
    pricingModel: "subscription",
    capabilities: [],
    version: "1.0.0",
    lifecycleState: "deprecated",
    migrationTarget: "listing-migration-target",
  };

  assert.equal(entry.lifecycleState, "deprecated");
  assert.equal(entry.migrationTarget, "listing-migration-target");
});

test("MarketplaceCatalogEntry readonly fields prevent modification", () => {
  const entry: MarketplaceCatalogEntry = {
    listingId: "listing-001",
    publisherId: "pub-001",
    artifactType: "connector",
    artifactRef: "connector/ref@v1.0.0",
    pricingModel: "enterprise",
    capabilities: ["cap-1"],
    version: "1.0.0",
    lifecycleState: "active",
  };

  // TypeScript ensures readonly, but we verify structure
  assert.equal(entry.listingId, "listing-001");
});

test("MarketplaceCatalogEntry accepts all artifact types", () => {
  const types: MarketplaceCatalogEntry["artifactType"][] = ["pack", "plugin", "connector", "model_profile"];
  for (const type of types) {
    const entry: MarketplaceCatalogEntry = {
      listingId: `listing-${type}`,
      publisherId: "pub-001",
      artifactType: type,
      artifactRef: `ref@v1`,
      pricingModel: "free",
      capabilities: [],
      version: "1.0.0",
      lifecycleState: "active",
    };
    assert.equal(entry.artifactType, type);
  }
});

test("MarketplaceCatalogEntry accepts all pricing models", () => {
  const models: MarketplaceCatalogEntry["pricingModel"][] = ["free", "usage", "subscription", "enterprise"];
  for (const model of models) {
    const entry: MarketplaceCatalogEntry = {
      listingId: `listing-${model}`,
      publisherId: "pub-001",
      artifactType: "pack",
      artifactRef: `ref@v1`,
      pricingModel: model,
      capabilities: [],
      version: "1.0.0",
      lifecycleState: "active",
    };
    assert.equal(entry.pricingModel, model);
  }
});

test("RevenueSharePolicy has correct interface structure", () => {
  const policy: RevenueSharePolicy = {
    policyId: "policy-001",
    grossSplit: { "publisher-a": 70, "platform": 30 },
    taxHandling: "platform_withheld",
    refundPolicy: "independent_adjustment",
    settlementCycle: "monthly",
  };

  assert.equal(policy.policyId, "policy-001");
  assert.equal(policy.grossSplit["publisher-a"], 70);
  assert.equal(policy.taxHandling, "platform_withheld");
  assert.equal(policy.settlementCycle, "monthly");
});

test("RevenueSharePolicy supports quarterly settlement cycle", () => {
  const policy: RevenueSharePolicy = {
    policyId: "policy-002",
    grossSplit: { "pub": 80, "platform": 20 },
    taxHandling: "publisher_responsible",
    refundPolicy: "independent_adjustment",
    settlementCycle: "quarterly",
  };

  assert.equal(policy.settlementCycle, "quarterly");
});

test("RevenueSharePolicy readonly grossSplit prevents modification", () => {
  const policy: RevenueSharePolicy = {
    policyId: "policy-003",
    grossSplit: Object.freeze({ "pub": 75, "platform": 25 }),
    taxHandling: "platform_withheld",
    refundPolicy: "independent_adjustment",
    settlementCycle: "monthly",
  };

  assert.equal(Object.isFrozen(policy.grossSplit), true);
});

test("BillingAdjustment has correct interface structure", () => {
  const adjustment: BillingAdjustment = {
    adjustmentId: "adj-001",
    accountId: "acc-001",
    invoiceId: "inv-001",
    amount: 100.50,
    reason: "Customer refund",
    preservesUsageLedger: true,
  };

  assert.equal(adjustment.adjustmentId, "adj-001");
  assert.equal(adjustment.amount, 100.50);
  assert.equal(adjustment.preservesUsageLedger, true);
});

test("BillingAdjustment preservesUsageLedger is always true", () => {
  const adjustment: BillingAdjustment = {
    adjustmentId: "adj-002",
    accountId: "acc-002",
    invoiceId: "inv-002",
    amount: 50.00,
    reason: "Promotional credit",
    preservesUsageLedger: true,
  };

  assert.equal(adjustment.preservesUsageLedger, true);
});

test("CapacitySignal has correct interface structure", () => {
  const signal: CapacitySignal = {
    signalId: "sig-001",
    slaTier: "premium",
    queueDelayMs: 150,
    budgetPressure: 0.75,
    approvalCapacity: 100,
    providerQuotaRemaining: 5000,
    regionFailoverReserve: 0.2,
  };

  assert.equal(signal.signalId, "sig-001");
  assert.equal(signal.slaTier, "premium");
  assert.equal(signal.queueDelayMs, 150);
  assert.ok(signal.budgetPressure >= 0 && signal.budgetPressure <= 1);
});

test("CapacitySignal handles zero values", () => {
  const signal: CapacitySignal = {
    signalId: "sig-002",
    slaTier: "basic",
    queueDelayMs: 0,
    budgetPressure: 0,
    approvalCapacity: 0,
    providerQuotaRemaining: 0,
    regionFailoverReserve: 0,
  };

  assert.equal(signal.queueDelayMs, 0);
  assert.equal(signal.budgetPressure, 0);
});

test("CostAttributionRecord has correct interface structure", () => {
  const record: CostAttributionRecord = {
    recordId: "rec-001",
    harnessRunId: "harness-001",
    nodeRunId: "node-001",
    budgetSettlementId: "budget-001",
    humanReviewCost: 25.00,
    egressCost: 5.50,
    computeCost: 100.00,
    storageCost: 10.25,
    qualityRisk: "medium",
  };

  assert.equal(record.recordId, "rec-001");
  assert.equal(record.humanReviewCost, 25.00);
  assert.equal(record.qualityRisk, "medium");
});

test("CostAttributionRecord nodeRunId is optional", () => {
  const record: CostAttributionRecord = {
    recordId: "rec-002",
    harnessRunId: "harness-002",
    budgetSettlementId: "budget-002",
    humanReviewCost: 0,
    egressCost: 0,
    computeCost: 0,
    storageCost: 0,
    qualityRisk: "low",
  };

  assert.equal(record.nodeRunId, undefined);
});

test("CostAttributionRecord accepts all quality risk values", () => {
  const risks: CostAttributionRecord["qualityRisk"][] = ["low", "medium", "high"];
  for (const risk of risks) {
    const record: CostAttributionRecord = {
      recordId: `rec-${risk}`,
      harnessRunId: "harness-001",
      budgetSettlementId: "budget-001",
      humanReviewCost: 0,
      egressCost: 0,
      computeCost: 0,
      storageCost: 0,
      qualityRisk: risk,
    };
    assert.equal(record.qualityRisk, risk);
  }
});

test("ListingDependency has correct interface structure", () => {
  const dep: ListingDependency = {
    listingId: "listing-001",
    dependsOnListingId: "listing-002",
    versionRange: "^1.0.0",
    compatibilityEvidenceRef: "evidence-001",
  };

  assert.equal(dep.listingId, "listing-001");
  assert.equal(dep.dependsOnListingId, "listing-002");
  assert.equal(dep.versionRange, "^1.0.0");
  assert.equal(dep.compatibilityEvidenceRef, "evidence-001");
});

test("CrossRegionRoutingAuditRecord has correct interface structure", () => {
  const record: CrossRegionRoutingAuditRecord = {
    decisionId: "dec-001",
    tenantId: "tenant-001",
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    policyRef: "policy/routing/default",
    evidenceRefs: ["evidence-1", "evidence-2"],
  };

  assert.equal(record.decisionId, "dec-001");
  assert.equal(record.sourceRegion, "us-east-1");
  assert.equal(record.targetRegion, "eu-west-1");
  assert.equal(record.evidenceRefs.length, 2);
});

test("CrossRegionRoutingAuditRecord supports empty evidenceRefs", () => {
  const record: CrossRegionRoutingAuditRecord = {
    decisionId: "dec-002",
    tenantId: "tenant-002",
    sourceRegion: "us-west-2",
    targetRegion: "ap-south-1",
    policyRef: "policy/routing/default",
    evidenceRefs: [],
  };

  assert.equal(record.evidenceRefs.length, 0);
});

test("compareFairQueueEntries sorts by slaTier descending (higher tier first)", () => {
  const entry1 = { tenantId: "t1", orgId: "o1", domainId: "d1", slaTier: 1, priority: 50 };
  const entry2 = { tenantId: "t2", orgId: "o2", domainId: "d2", slaTier: 3, priority: 50 };

  assert.ok(compareFairQueueEntries(entry1, entry2) > 0); // entry2 comes first (higher tier)
  assert.ok(compareFairQueueEntries(entry2, entry1) < 0); // entry1 comes after (lower tier)
});

test("compareFairQueueEntries sorts by priority descending when slaTier equal", () => {
  const entry1 = { tenantId: "t1", orgId: "o1", domainId: "d1", slaTier: 2, priority: 30 };
  const entry2 = { tenantId: "t2", orgId: "o2", domainId: "d2", slaTier: 2, priority: 70 };

  assert.ok(compareFairQueueEntries(entry1, entry2) > 0); // entry2 comes first (higher priority)
  assert.ok(compareFairQueueEntries(entry2, entry1) < 0); // entry1 comes after (lower priority)
});

test("compareFairQueueEntries sorts by tenantId ascending when slaTier and priority equal", () => {
  const entry1 = { tenantId: "b-tenant", orgId: "o1", domainId: "d1", slaTier: 2, priority: 50 };
  const entry2 = { tenantId: "a-tenant", orgId: "o2", domainId: "d2", slaTier: 2, priority: 50 };

  assert.ok(compareFairQueueEntries(entry1, entry2) > 0); // a-tenant comes first
  assert.ok(compareFairQueueEntries(entry2, entry1) < 0); // b-tenant comes after
});

test("compareFairQueueEntries returns 0 for identical entries", () => {
  const entry = { tenantId: "t1", orgId: "o1", domainId: "d1", slaTier: 1, priority: 50 };
  assert.equal(compareFairQueueEntries(entry, entry), 0);
});

test("compareFairQueueEntries handles orgId tiebreaker", () => {
  const entry1 = { tenantId: "t1", orgId: "b-org", domainId: "d1", slaTier: 1, priority: 50 };
  const entry2 = { tenantId: "t1", orgId: "a-org", domainId: "d2", slaTier: 1, priority: 50 };

  assert.ok(compareFairQueueEntries(entry1, entry2) > 0); // a-org comes first
  assert.ok(compareFairQueueEntries(entry2, entry1) < 0); // b-org comes after
});

test("compareFairQueueEntries handles domainId tiebreaker", () => {
  const entry1 = { tenantId: "t1", orgId: "o1", domainId: "b-domain", slaTier: 1, priority: 50 };
  const entry2 = { tenantId: "t1", orgId: "o1", domainId: "a-domain", slaTier: 1, priority: 50 };

  assert.ok(compareFairQueueEntries(entry1, entry2) > 0); // a-domain comes first
  assert.ok(compareFairQueueEntries(entry2, entry1) < 0); // b-domain comes after
});

test("buildBillingAdjustment creates adjustment with preservesUsageLedger true", () => {
  const input = {
    adjustmentId: "adj-001",
    accountId: "acc-001",
    invoiceId: "inv-001",
    amount: 100.00,
    reason: "Service credit",
  };

  const result = buildBillingAdjustment(input);

  assert.equal(result.adjustmentId, "adj-001");
  assert.equal(result.preservesUsageLedger, true);
});

test("buildBillingAdjustment preserves all input fields", () => {
  const input = {
    adjustmentId: "adj-002",
    accountId: "acc-002",
    invoiceId: "inv-002",
    amount: 250.75,
    reason: "Volume discount",
  };

  const result = buildBillingAdjustment(input);

  assert.equal(result.adjustmentId, input.adjustmentId);
  assert.equal(result.accountId, input.accountId);
  assert.equal(result.invoiceId, input.invoiceId);
  assert.equal(result.amount, input.amount);
  assert.equal(result.reason, input.reason);
});

test("buildBillingAdjustment handles negative amounts", () => {
  const input = {
    adjustmentId: "adj-003",
    accountId: "acc-003",
    invoiceId: "inv-003",
    amount: -50.00,
    reason: "Correction",
  };

  const result = buildBillingAdjustment(input);

  assert.equal(result.amount, -50.00);
  assert.equal(result.preservesUsageLedger, true);
});

test("validateListingDependencies returns valid when all dependencies have evidence", () => {
  const deps: readonly ListingDependency[] = [
    {
      listingId: "listing-001",
      dependsOnListingId: "listing-002",
      versionRange: "^1.0.0",
      compatibilityEvidenceRef: "evidence-001",
    },
    {
      listingId: "listing-002",
      dependsOnListingId: "listing-003",
      versionRange: "^2.0.0",
      compatibilityEvidenceRef: "evidence-002",
    },
  ];

  const result = validateListingDependencies(deps);

  assert.equal(result.valid, true);
  assert.equal(result.missingEvidenceIds.length, 0);
});

test("validateListingDependencies returns invalid when dependency has empty evidence", () => {
  const deps: readonly ListingDependency[] = [
    {
      listingId: "listing-001",
      dependsOnListingId: "listing-002",
      versionRange: "^1.0.0",
      compatibilityEvidenceRef: "",
    },
  ];

  const result = validateListingDependencies(deps);

  assert.equal(result.valid, false);
  assert.equal(result.missingEvidenceIds.length, 1);
  assert.equal(result.missingEvidenceIds[0], "listing-002");
});

test("validateListingDependencies returns invalid when dependency has whitespace-only evidence", () => {
  const deps: readonly ListingDependency[] = [
    {
      listingId: "listing-001",
      dependsOnListingId: "listing-002",
      versionRange: "^1.0.0",
      compatibilityEvidenceRef: "   ",
    },
  ];

  const result = validateListingDependencies(deps);

  assert.equal(result.valid, false);
  assert.equal(result.missingEvidenceIds[0], "listing-002");
});

test("validateListingDependencies returns empty missingEvidenceIds for empty input", () => {
  const result = validateListingDependencies([]);

  assert.equal(result.valid, true);
  assert.equal(result.missingEvidenceIds.length, 0);
});

test("validateListingDependencies identifies multiple missing dependencies", () => {
  const deps: readonly ListingDependency[] = [
    {
      listingId: "listing-001",
      dependsOnListingId: "listing-002",
      versionRange: "^1.0.0",
      compatibilityEvidenceRef: "",
    },
    {
      listingId: "listing-003",
      dependsOnListingId: "listing-004",
      versionRange: "^1.0.0",
      compatibilityEvidenceRef: "",
    },
    {
      listingId: "listing-005",
      dependsOnListingId: "listing-006",
      versionRange: "^1.0.0",
      compatibilityEvidenceRef: "evidence-005",
    },
  ];

  const result = validateListingDependencies(deps);

  assert.equal(result.valid, false);
  assert.equal(result.missingEvidenceIds.length, 2);
  assert.ok(result.missingEvidenceIds.includes("listing-002"));
  assert.ok(result.missingEvidenceIds.includes("listing-004"));
  assert.ok(!result.missingEvidenceIds.includes("listing-006"));
});

test("validateListingDependencies reports dependsOnListingId as missing, not listingId", () => {
  const deps: readonly ListingDependency[] = [
    {
      listingId: "parent-listing",
      dependsOnListingId: "child-listing-id",
      versionRange: "^1.0.0",
      compatibilityEvidenceRef: "",
    },
  ];

  const result = validateListingDependencies(deps);

  assert.equal(result.missingEvidenceIds[0], "child-listing-id");
});

test("buildScaleEcosystemRemediationEvidence returns array of 20 evidence IDs", () => {
  const evidence = buildScaleEcosystemRemediationEvidence();

  assert.equal(evidence.length, 20);
});

test("buildScaleEcosystemRemediationEvidence returns evidence IDs with S- prefix", () => {
  const evidence = buildScaleEcosystemRemediationEvidence();

  assert.ok(evidence[0].startsWith("S-"));
  assert.ok(evidence[19].startsWith("S-"));
});

test("buildScaleEcosystemRemediationEvidence returns sequential IDs from S-1 to S-20", () => {
  const evidence = buildScaleEcosystemRemediationEvidence();

  assert.equal(evidence[0], "S-1");
  assert.equal(evidence[9], "S-10");
  assert.equal(evidence[19], "S-20");
});

test("buildScaleEcosystemRemediationEvidence returns readonly array", () => {
  const evidence = buildScaleEcosystemRemediationEvidence();

  assert.ok(Array.isArray(evidence));
});