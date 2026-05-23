import assert from "node:assert/strict";
import test from "node:test";

import {
  listVerticalDomainBaselines,
  listVerticalDomainIds,
  listLegacyVerticalDomainIds,
  resolveCanonicalVerticalDomainId,
  getVerticalDomainBaseline,
  listVerticalDomainBaselinesByPhase,
} from "../../../src/domains/domain-baseline-catalog.js";

test("listVerticalDomainIds returns array of all domain IDs", () => {
  const ids = listVerticalDomainIds();

  assert.ok(Array.isArray(ids));
  assert.ok(ids.length > 0);
});

test("listVerticalDomainIds returns 31 domain IDs", () => {
  const ids = listVerticalDomainIds();

  assert.equal(ids.length, 31);
});

test("listVerticalDomainIds includes coding domain", () => {
  const ids = listVerticalDomainIds();

  assert.ok(ids.includes("coding"));
});

test("listVerticalDomainIds includes all canonical domain IDs", () => {
  const ids = listVerticalDomainIds();

  const expectedIds = [
    "coding",
    "data-engineering",
    "knowledge-base",
    "user-operations",
    "quant-trading",
    "financial-services",
    "ecommerce",
    "advertising",
    "industry-research",
    "academic-research",
    "product-management",
    "quality-assurance",
    "finance-accounting",
    "legal",
    "project-management",
    "customer-service",
    "it-operations",
    "content-moderation",
    "live-streaming",
    "healthcare",
    "human-resources",
    "facilities",
    "executive-assistant",
    "supply-chain",
    "education",
    "creative-production",
    "game-dev",
    "game-publishing",
    "manufacturing",
    "agriculture",
    "marketing",
  ] as const;

  for (const expectedId of expectedIds) {
    assert.ok(ids.includes(expectedId), `Missing domain ID: ${expectedId}`);
  }
});

test("listLegacyVerticalDomainIds returns array of legacy IDs", () => {
  const ids = listLegacyVerticalDomainIds();

  assert.ok(Array.isArray(ids));
  assert.ok(ids.length > 0);
});

test("listLegacyVerticalDomainIds includes data-processing", () => {
  const ids = listLegacyVerticalDomainIds();

  assert.ok(ids.includes("data-processing"));
});

test("listLegacyVerticalDomainIds includes finance", () => {
  const ids = listLegacyVerticalDomainIds();

  assert.ok(ids.includes("finance"));
});

test("listLegacyVerticalDomainIds maps to correct canonical IDs", () => {
  const ids = listLegacyVerticalDomainIds();

  const legacyToCanonical: Record<string, string> = {
    "data-processing": "data-engineering",
    "enterprise-knowledge-base": "knowledge-base",
    "quantitative-trading": "quant-trading",
    "advertising-promotion": "advertising",
    "sales": "ecommerce",
    "security": "content-moderation",
    "data-analytics": "data-engineering",
    "finance": "finance-accounting",
    "online-livestream": "live-streaming",
    "medical-health": "healthcare",
    "supply-chain-logistics": "supply-chain",
    "education-training": "education",
    "advertising-creative": "creative-production",
    "game-development": "game-dev",
    "marketing-brand": "marketing",
  };

  for (const [legacyId, canonicalId] of Object.entries(legacyToCanonical)) {
    assert.ok(ids.includes(legacyId as never), `Missing legacy ID: ${legacyId}`);
    // Verify the legacy ID resolves to the correct canonical ID
    const resolved = resolveCanonicalVerticalDomainId(legacyId);
    assert.equal(resolved, canonicalId, `Legacy ID ${legacyId} should resolve to ${canonicalId}, got ${resolved}`);
  }
});

test("resolveCanonicalVerticalDomainId returns canonical ID for valid legacy ID", () => {
  const resolved = resolveCanonicalVerticalDomainId("data-processing");
  assert.equal(resolved, "data-engineering");
});

test("resolveCanonicalVerticalDomainId returns canonical ID for valid canonical ID", () => {
  const resolved = resolveCanonicalVerticalDomainId("coding");
  assert.equal(resolved, "coding");
});

test("resolveCanonicalVerticalDomainId returns null for unknown ID", () => {
  const resolved = resolveCanonicalVerticalDomainId("nonexistent-domain");
  assert.equal(resolved, null);
});

test("getVerticalDomainBaseline returns baseline for valid domain ID", () => {
  const baseline = getVerticalDomainBaseline("coding");

  assert.ok(baseline);
  assert.equal(baseline.domainId, "coding");
  assert.equal(baseline.phase, "9a");
});

test("getVerticalDomainBaseline returns baseline for legacy domain ID", () => {
  const baseline = getVerticalDomainBaseline("quantitative-trading");

  assert.ok(baseline);
  assert.equal(baseline.domainId, "quant-trading");
});

test("getVerticalDomainBaseline throws for unknown domain ID", () => {
  assert.throws(
    () => getVerticalDomainBaseline("nonexistent-domain"),
    /vertical_domain\.not_found/,
  );
});

test("getVerticalDomainBaseline returns baseline with correct structure", () => {
  const baseline = getVerticalDomainBaseline("healthcare");

  assert.ok(baseline.domainId);
  assert.ok(baseline.displayName);
  assert.ok(baseline.riskProfile);
  assert.ok(baseline.knowledgeSchema);
  assert.ok(baseline.evalFramework);
  assert.ok(baseline.promptLibrary);
  assert.ok(baseline.recipes);
  assert.ok(baseline.interactionRules);
  assert.ok(baseline.governancePolicy);
  assert.ok(baseline.metaModel);
});

test("listVerticalDomainBaselinesByPhase returns correct count per phase", () => {
  const phaseCounts: Record<string, number> = {
    "9a": 4,
    "9b": 4,
    "9c": 6,
    "9d": 5,
    "9e": 6,
    "9f": 6,
  };

  for (const [phase, expectedCount] of Object.entries(phaseCounts)) {
    const baselines = listVerticalDomainBaselinesByPhase(phase as "9a" | "9b" | "9c" | "9d" | "9e" | "9f");
    assert.equal(baselines.length, expectedCount, `Phase ${phase} should have ${expectedCount} domains`);
  }
});

test("listVerticalDomainBaselinesByPhase returns correct domains for phase 9a", () => {
  const baselines = listVerticalDomainBaselinesByPhase("9a");
  const domainIds = baselines.map((b) => b.domainId);

  assert.ok(domainIds.includes("coding"));
  assert.ok(domainIds.includes("data-engineering"));
  assert.ok(domainIds.includes("knowledge-base"));
  assert.ok(domainIds.includes("user-operations"));
});

test("listVerticalDomainBaselinesByPhase returns correct domains for phase 9b", () => {
  const baselines = listVerticalDomainBaselinesByPhase("9b");
  const domainIds = baselines.map((b) => b.domainId);

  assert.ok(domainIds.includes("quant-trading"));
  assert.ok(domainIds.includes("financial-services"));
  assert.ok(domainIds.includes("ecommerce"));
  assert.ok(domainIds.includes("advertising"));
});

test("listVerticalDomainBaselines returns same count as all domain IDs", () => {
  const baselines = listVerticalDomainBaselines();
  const ids = listVerticalDomainIds();

  assert.equal(baselines.length, ids.length);
});

test("each baseline in listVerticalDomainBaselines has required fields", () => {
  const baselines = listVerticalDomainBaselines();

  for (const baseline of baselines) {
    assert.ok(baseline.domainId, "baseline missing domainId");
    assert.ok(baseline.phase, "baseline missing phase");
    assert.ok(baseline.displayName, "baseline missing displayName");
    assert.ok(baseline.ownerOrgNodeId, "baseline missing ownerOrgNodeId");
    assert.ok(baseline.definition, "baseline missing definition");
    assert.ok(baseline.riskProfile, "baseline missing riskProfile");
    assert.ok(baseline.knowledgeSchema, "baseline missing knowledgeSchema");
    assert.ok(baseline.evalFramework, "baseline missing evalFramework");
    assert.ok(baseline.promptLibrary, "baseline missing promptLibrary");
    assert.ok(baseline.recipes, "baseline missing recipes");
    assert.ok(baseline.interactionRules, "baseline missing interactionRules");
    assert.ok(baseline.governancePolicy, "baseline missing governancePolicy");
    assert.ok(baseline.metaModel, "baseline missing metaModel");
    assert.ok(baseline.workflowSpecialization, "baseline missing workflowSpecialization");
    assert.ok(baseline.toolingSpecialization, "baseline missing toolingSpecialization");
    assert.ok(baseline.evalSpecialization, "baseline missing evalSpecialization");
    assert.ok(baseline.latencyProfile, "baseline missing latencyProfile");
    assert.ok(baseline.ownershipProfile, "baseline missing ownershipProfile");
  }
});
