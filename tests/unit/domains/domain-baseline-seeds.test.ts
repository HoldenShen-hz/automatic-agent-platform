import assert from "node:assert/strict";
import { DOMAIN_SEEDS, type DomainSeed } from "../../../src/domains/domain-baseline-seeds.js";
import {
  VERTICAL_DOMAIN_BASELINES,
  getVerticalDomainBaseline,
  listVerticalDomainBaselines,
  listVerticalDomainIds,
  resolveCanonicalVerticalDomainId,
  bootstrapVerticalDomainBaselines,
  listVerticalDomainBaselinesByPhase,
} from "../../../src/domains/domain-baseline-catalog.js";
import type { DomainLatencyProfile, VerticalDomainPhase, VerticalDomainId } from "../../../src/domains/domain-baseline-catalog.js";

const VALID_PHASES: readonly VerticalDomainPhase[] = ["9a", "9b", "9c", "9d", "9e", "9f"];

const VALID_DOMAIN_IDS: readonly VerticalDomainId[] = [
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
];

const VALID_RISK_LEVELS: readonly DomainRiskLevel[] = ["low", "medium", "high", "critical"];

const VALID_LATENCY_TIERS = ["ultra_realtime", "realtime", "near_realtime", "business_day"] as const;
const VALID_DATA_SENSITIVITY = ["internal", "confidential", "regulated"] as const;
const VALID_ROLLOUT_STRATEGIES = ["manual", "canary", "shadow", "supervised_auto"] as const;

// =============================================================================
// 1. Baseline seeds loading
// =============================================================================

test("DOMAIN_SEEDS is a non-empty readonly array", () => {
  assert.ok(Array.isArray(DOMAIN_SEEDS), "DOMAIN_SEEDS should be an array");
  assert.ok(DOMAIN_SEEDS.length > 0, "DOMAIN_SEEDS should not be empty");
  assert.equal(typeof DOMAIN_SEEDS[0], "object", "DOMAIN_SEEDS elements should be objects");
});

test("DOMAIN_SEEDS contains 31 seeds (one per vertical domain)", () => {
  assert.equal(DOMAIN_SEEDS.length, 31, "DOMAIN_SEEDS should have 31 entries");
});

test("DOMAIN_SEEDS covers all phases 9a through 9f", () => {
  const phases = new Set(DOMAIN_SEEDS.map((seed) => seed.phase));
  for (const phase of VALID_PHASES) {
    assert.ok(phases.has(phase), `missing phase ${phase}`);
  }
});

// =============================================================================
// 2. Seed data structure validation
// =============================================================================

test("each seed has all required string and array fields", () => {
  for (const seed of DOMAIN_SEEDS) {
    assert.ok(typeof seed.phase === "string" && seed.phase.length > 0, `${seed.domainId}: phase must be a non-empty string`);
    assert.ok(typeof seed.domainId === "string" && seed.domainId.length > 0, `${seed.domainId}: domainId must be a non-empty string`);
    assert.ok(Array.isArray(seed.legacyDomainIds), `${seed.domainId}: legacyDomainIds must be an array`);
    assert.ok(typeof seed.displayName === "string" && seed.displayName.length > 0, `${seed.domainId}: displayName must be a non-empty string`);
    assert.ok(typeof seed.description === "string" && seed.description.length > 0, `${seed.domainId}: description must be a non-empty string`);
    assert.ok(typeof seed.riskLevel === "string" && seed.riskLevel.length > 0, `${seed.domainId}: riskLevel must be a non-empty string`);
    assert.ok(typeof seed.ownerOrgNodeId === "string" && seed.ownerOrgNodeId.length > 0, `${seed.domainId}: ownerOrgNodeId must be a non-empty string`);
    assert.ok(Array.isArray(seed.taskTypes), `${seed.domainId}: taskTypes must be an array`);
    assert.ok(Array.isArray(seed.tags), `${seed.domainId}: tags must be an array`);
    assert.ok(Array.isArray(seed.workflowStages), `${seed.domainId}: workflowStages must be an array`);
    assert.ok(Array.isArray(seed.requiredTools), `${seed.domainId}: requiredTools must be an array`);
    assert.ok(Array.isArray(seed.optionalTools), `${seed.domainId}: optionalTools must be an array`);
    assert.ok(Array.isArray(seed.externalAdapters), `${seed.domainId}: externalAdapters must be an array`);
    assert.ok(Array.isArray(seed.blockingMetrics), `${seed.domainId}: blockingMetrics must be an array`);
    assert.ok(Array.isArray(seed.advisoryMetrics), `${seed.domainId}: advisoryMetrics must be an array`);
    assert.ok(Array.isArray(seed.restrictedDataClasses), `${seed.domainId}: restrictedDataClasses must be an array`);
    assert.ok(typeof seed.rolloutStrategy === "string", `${seed.domainId}: rolloutStrategy must be a string`);
  }
});

test("each seed has a valid phase from the VerticalDomainPhase union", () => {
  for (const seed of DOMAIN_SEEDS) {
    assert.ok(
      VALID_PHASES.includes(seed.phase as VerticalDomainPhase),
      `${seed.domainId}: invalid phase "${seed.phase}"`,
    );
  }
});

test("each seed has a valid domainId from the catalog", () => {
  for (const seed of DOMAIN_SEEDS) {
    assert.ok(
      VALID_DOMAIN_IDS.includes(seed.domainId as VerticalDomainId),
      `${seed.domainId}: domainId not in VerticalDomainId union`,
    );
  }
});

test("each seed has a valid riskLevel", () => {
  for (const seed of DOMAIN_SEEDS) {
    assert.ok(
      VALID_RISK_LEVELS.includes(seed.riskLevel as DomainRiskLevel),
      `${seed.domainId}: invalid riskLevel "${seed.riskLevel}"`,
    );
  }
});

test("each seed has a valid rolloutStrategy", () => {
  for (const seed of DOMAIN_SEEDS) {
    assert.ok(
      VALID_ROLLOUT_STRATEGIES.includes(seed.rolloutStrategy as "manual" | "canary" | "shadow" | "supervised_auto"),
      `${seed.domainId}: invalid rolloutStrategy "${seed.rolloutStrategy}"`,
    );
  }
});

test("each seed has a correctly structured latencyProfile", () => {
  for (const seed of DOMAIN_SEEDS) {
    const lp = seed.latencyProfile;
    assert.ok(typeof lp === "object", `${seed.domainId}: latencyProfile must be an object`);
    assert.ok(
      VALID_LATENCY_TIERS.includes(lp.tier as typeof VALID_LATENCY_TIERS[number]),
      `${seed.domainId}: invalid latency tier "${lp.tier}"`,
    );
    assert.ok(
      typeof lp.targetResponseMinutes === "number" && lp.targetResponseMinutes > 0,
      `${seed.domainId}: targetResponseMinutes must be a positive number`,
    );
    assert.ok(
      typeof lp.maxResponseMinutes === "number" && lp.maxResponseMinutes > 0,
      `${seed.domainId}: maxResponseMinutes must be a positive number`,
    );
    assert.ok(
      lp.targetResponseMinutes <= lp.maxResponseMinutes,
      `${seed.domainId}: targetResponseMinutes must not exceed maxResponseMinutes`,
    );
    assert.ok(
      VALID_DATA_SENSITIVITY.includes(lp.dataSensitivity as typeof VALID_DATA_SENSITIVITY[number]),
      `${seed.domainId}: invalid dataSensitivity "${lp.dataSensitivity}"`,
    );
  }
});

test("each seed has a correctly structured ownershipProfile", () => {
  for (const seed of DOMAIN_SEEDS) {
    const op = seed.ownershipProfile;
    assert.ok(typeof op === "object", `${seed.domainId}: ownershipProfile must be an object`);
    assert.ok(typeof op.divisionId === "string" && op.divisionId.length > 0, `${seed.domainId}: divisionId must be a non-empty string`);
    assert.ok(typeof op.ownerTeam === "string" && op.ownerTeam.length > 0, `${seed.domainId}: ownerTeam must be a non-empty string`);
    assert.ok(typeof op.escalationTeam === "string" && op.escalationTeam.length > 0, `${seed.domainId}: escalationTeam must be a non-empty string`);
  }
});

test("each seed has non-empty array fields (taskTypes, tags, workflowStages, requiredTools)", () => {
  for (const seed of DOMAIN_SEEDS) {
    assert.ok(seed.taskTypes.length > 0, `${seed.domainId}: taskTypes must not be empty`);
    assert.ok(seed.tags.length > 0, `${seed.domainId}: tags must not be empty`);
    assert.ok(seed.workflowStages.length > 0, `${seed.domainId}: workflowStages must not be empty`);
    assert.ok(seed.requiredTools.length > 0, `${seed.domainId}: requiredTools must not be empty`);
  }
});

test("seed array properties are frozen (readonly enforcement)", () => {
  const firstSeed = DOMAIN_SEEDS[0]!;
  assert.throws(
    () => ((firstSeed as DomainSeed & { taskTypes: string[] }).taskTypes).push("new"),
    /Cannot add property/,
    "taskTypes should be frozen",
  );
  assert.throws(
    () => ((firstSeed as DomainSeed & { tags: string[] }).tags).push("new"),
    /Cannot add property/,
    "tags should be frozen",
  );
  assert.throws(
    () => ((firstSeed as DomainSeed & { requiredTools: string[] }).requiredTools).push("new"),
    /Cannot add property/,
    "requiredTools should be frozen",
  );
});

test("all legacyDomainIds reference valid legacy aliases", () => {
  const VALID_LEGACY_IDS = [
    "data-processing",
    "enterprise-knowledge-base",
    "quantitative-trading",
    "advertising-promotion",
    "sales",
    "security",
    "data-analytics",
    "finance",
    "online-livestream",
    "medical-health",
    "supply-chain-logistics",
    "education-training",
    "advertising-creative",
    "game-development",
    "marketing-brand",
  ];
  for (const seed of DOMAIN_SEEDS) {
    for (const legacyId of seed.legacyDomainIds) {
      assert.ok(
        VALID_LEGACY_IDS.includes(legacyId),
        `${seed.domainId}: invalid legacyDomainId "${legacyId}"`,
      );
    }
  }
});

// =============================================================================
// 3. Domain baseline initialization
// =============================================================================

test("VERTICAL_DOMAIN_BASELINES is derived from DOMAIN_SEEDS with 31 entries", () => {
  assert.equal(VERTICAL_DOMAIN_BASELINES.length, 31, "should have same count as DOMAIN_SEEDS");
});

test("each baseline has the correct domainId matching its seed", () => {
  for (const baseline of VERTICAL_DOMAIN_BASELINES) {
    const matchingSeed = DOMAIN_SEEDS.find((s) => s.domainId === baseline.domainId);
    assert.ok(matchingSeed !== undefined, `No seed found for domainId: ${baseline.domainId}`);
    assert.equal(baseline.phase, matchingSeed.phase, `${baseline.domainId}: phase mismatch`);
    assert.equal(baseline.displayName, matchingSeed.displayName, `${baseline.domainId}: displayName mismatch`);
    assert.equal(baseline.ownerOrgNodeId, matchingSeed.ownerOrgNodeId, `${baseline.domainId}: ownerOrgNodeId mismatch`);
  }
});

test("each baseline has a valid riskProfile derived from seed riskLevel", () => {
  for (const baseline of VERTICAL_DOMAIN_BASELINES) {
    assert.ok(
      VALID_RISK_LEVELS.includes(baseline.riskProfile.defaultRiskLevel as DomainRiskLevel),
      `${baseline.domainId}: invalid defaultRiskLevel in riskProfile`,
    );
    assert.ok(baseline.riskProfile.profileId.includes(baseline.domainId), `${baseline.domainId}: profileId should include domainId`);
  }
});

test("each baseline has a valid governancePolicy with matching domainId", () => {
  for (const baseline of VERTICAL_DOMAIN_BASELINES) {
    assert.equal(baseline.governancePolicy.domainId, baseline.domainId, `${baseline.domainId}: governancePolicy domainId mismatch`);
    assert.ok(
      VALID_ROLLOUT_STRATEGIES.includes(baseline.governancePolicy.rollout.strategy as "manual" | "canary" | "shadow" | "supervised_auto"),
      `${baseline.domainId}: invalid rollout strategy in governancePolicy`,
    );
  }
});

test("each baseline has a latencyProfile matching its seed", () => {
  for (const baseline of VERTICAL_DOMAIN_BASELINES) {
    const seed = DOMAIN_SEEDS.find((s) => s.domainId === baseline.domainId)!;
    assert.equal(baseline.latencyProfile.tier, seed.latencyProfile.tier, `${baseline.domainId}: latencyProfile tier mismatch`);
    assert.equal(baseline.latencyProfile.targetResponseMinutes, seed.latencyProfile.targetResponseMinutes, `${baseline.domainId}: targetResponseMinutes mismatch`);
    assert.equal(baseline.latencyProfile.maxResponseMinutes, seed.latencyProfile.maxResponseMinutes, `${baseline.domainId}: maxResponseMinutes mismatch`);
    assert.equal(baseline.latencyProfile.dataSensitivity, seed.latencyProfile.dataSensitivity, `${baseline.domainId}: dataSensitivity mismatch`);
  }
});

test("each baseline has workflowSpecialization with non-empty stageNames", () => {
  for (const baseline of VERTICAL_DOMAIN_BASELINES) {
    assert.ok(baseline.workflowSpecialization.workflowTemplateId.includes(baseline.domainId), `${baseline.domainId}: workflowTemplateId should include domainId`);
    assert.ok(baseline.workflowSpecialization.stageNames.length > 0, `${baseline.domainId}: stageNames must not be empty`);
    assert.deepEqual(baseline.workflowSpecialization.stageNames, baseline.definition.workflows[0]?.steps.map((s) => s.stepName), `${baseline.domainId}: stageNames should match workflow steps`);
  }
});

test("each baseline has toolingSpecialization with required and optional tools", () => {
  for (const baseline of VERTICAL_DOMAIN_BASELINES) {
    const seed = DOMAIN_SEEDS.find((s) => s.domainId === baseline.domainId)!;
    assert.deepEqual(baseline.toolingSpecialization.requiredToolNames, seed.requiredTools, `${baseline.domainId}: requiredToolNames mismatch`);
    assert.deepEqual(baseline.toolingSpecialization.optionalToolNames, seed.optionalTools, `${baseline.domainId}: optionalToolNames mismatch`);
    assert.deepEqual(baseline.toolingSpecialization.externalAdapterIds, seed.externalAdapters, `${baseline.domainId}: externalAdapterIds mismatch`);
  }
});

test("each baseline has evalSpecialization with correct blocking and advisory metrics", () => {
  for (const baseline of VERTICAL_DOMAIN_BASELINES) {
    const seed = DOMAIN_SEEDS.find((s) => s.domainId === baseline.domainId)!;
    assert.deepEqual(baseline.evalSpecialization.blockingMetricIds, seed.blockingMetrics, `${baseline.domainId}: blockingMetricIds mismatch`);
    assert.deepEqual(baseline.evalSpecialization.advisoryMetricIds, seed.advisoryMetrics, `${baseline.domainId}: advisoryMetricIds mismatch`);
  }
});

test("bootstrapVerticalDomainBaselines returns expected structure with all domains activated", () => {
  const result = bootstrapVerticalDomainBaselines();
  assert.ok(result.domainRegistry, "should return a domainRegistry");
  assert.ok(Array.isArray(result.baselines), "baselines should be an array");
  assert.ok(Array.isArray(result.reviews), "reviews should be an array");
  assert.ok(Array.isArray(result.onboardingChecklists), "onboardingChecklists should be an array");
  assert.ok(Array.isArray(result.governancePolicies), "governancePolicies should be an array");
  assert.ok(Array.isArray(result.activatedDomainIds), "activatedDomainIds should be an array");
  assert.equal(result.activatedDomainIds.length, 31, "all 31 domains should be activated");
  assert.equal(result.baselines.length, 31, "baselines should have 31 entries");
  assert.equal(result.governancePolicies.length, 31, "governancePolicies should have 31 entries");
});

test("listVerticalDomainBaselines returns all 31 baselines", () => {
  const baselines = listVerticalDomainBaselines();
  assert.equal(baselines.length, 31);
});

test("listVerticalDomainIds returns all 31 domain IDs", () => {
  const ids = listVerticalDomainIds();
  assert.equal(ids.length, 31);
  for (const id of ids) {
    assert.ok(VALID_DOMAIN_IDS.includes(id as VerticalDomainId), `invalid domainId: ${id}`);
  }
});

test("getVerticalDomainBaseline returns a baseline for each seed domainId", () => {
  for (const seed of DOMAIN_SEEDS) {
    const baseline = getVerticalDomainBaseline(seed.domainId);
    assert.ok(baseline !== undefined, `no baseline found for ${seed.domainId}`);
    assert.equal(baseline.domainId, seed.domainId);
  }
});

test("getVerticalDomainBaseline throws for unknown domainId", () => {
  assert.throws(() => getVerticalDomainBaseline("nonexistent-domain" as VerticalDomainId), /vertical_domain.not_found/);
});

test("listVerticalDomainBaselinesByPhase returns seeds for each phase", () => {
  for (const phase of VALID_PHASES) {
    const baselines = listVerticalDomainBaselinesByPhase(phase);
    assert.ok(baselines.length > 0, `no baselines found for phase ${phase}`);
    for (const baseline of baselines) {
      assert.equal(baseline.phase, phase, `phase mismatch for ${baseline.domainId}`);
    }
  }
});

// =============================================================================
// 4. Seed version compatibility
// =============================================================================

test("resolveCanonicalVerticalDomainId resolves canonical IDs to themselves", () => {
  for (const domainId of VALID_DOMAIN_IDS) {
    const resolved = resolveCanonicalVerticalDomainId(domainId);
    assert.equal(resolved, domainId, `${domainId} should resolve to itself`);
  }
});

test("resolveCanonicalVerticalDomainId resolves legacy IDs to canonical IDs", () => {
  const legacyToCanonical: Record<string, string> = {
    "data-processing": "data-engineering",
    "enterprise-knowledge-base": "knowledge-base",
    "quantitative-trading": "quant-trading",
    "advertising-promotion": "advertising",
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
    const resolved = resolveCanonicalVerticalDomainId(legacyId as keyof typeof legacyToCanonical);
    assert.equal(resolved, canonicalId, `${legacyId} should resolve to ${canonicalId}, got ${resolved}`);
  }
});

test("resolveCanonicalVerticalDomainId returns null for unknown IDs", () => {
  assert.equal(resolveCanonicalVerticalDomainId("unknown-domain-xyz"), null);
});

test("seeds with critical riskLevel have shadow rolloutStrategy", () => {
  for (const seed of DOMAIN_SEEDS) {
    if (seed.riskLevel === "critical") {
      assert.equal(
        seed.rolloutStrategy,
        "shadow",
        `${seed.domainId}: critical risk domains must use shadow rolloutStrategy, got ${seed.rolloutStrategy}`,
      );
    }
  }
});

test("seeds with regulated dataSensitivity have restrictedDataClasses containing regulated or sensitive", () => {
  for (const seed of DOMAIN_SEEDS) {
    if (seed.latencyProfile.dataSensitivity === "regulated") {
      const hasRestricted = seed.restrictedDataClasses.some((c) => c === "regulated" || c === "sensitive");
      assert.ok(
        hasRestricted,
        `${seed.domainId}: regulated domains should have "regulated" or "sensitive" in restrictedDataClasses`,
      );
    }
  }
});

test("critical risk domains have restricted securityLevel in derived baselines", () => {
  for (const baseline of VERTICAL_DOMAIN_BASELINES) {
    if (baseline.riskProfile.defaultRiskLevel === "critical") {
      assert.equal(
        baseline.definition.capabilities.securityLevel,
        "restricted",
        `${baseline.domainId}: critical risk domains should have securityLevel "restricted"`,
      );
    }
  }
});
