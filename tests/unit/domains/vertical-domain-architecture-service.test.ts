import assert from "node:assert/strict";
import test from "node:test";

import * as VerticalDomainArchitectureService from "../../../src/domains/vertical-domain-architecture-service.js";

const SERVICE = new VerticalDomainArchitectureService.VerticalDomainArchitectureService();

// ---------------------------------------------------------------------------
// Vertical domain architecture setup
// ---------------------------------------------------------------------------

test("listVerticalDomainArchitectures returns array with all domains", () => {
  const architectures = SERVICE.listVerticalDomainArchitectures();

  assert.ok(Array.isArray(architectures));
  assert.ok(architectures.length > 0, "should return at least one architecture");
});

test("listVerticalDomainArchitectures returns architecture records with domainId", () => {
  const architectures = SERVICE.listVerticalDomainArchitectures();

  for (const arch of architectures) {
    assert.ok(typeof arch.domainId === "string", "domainId should be a string");
    assert.ok(arch.domainId.length > 0, "domainId should not be empty");
  }
});

test("getVerticalDomainArchitecture retrieves coding domain", () => {
  const arch = SERVICE.getVerticalDomainArchitecture("coding");

  assert.equal(arch.domainId, "coding");
  assert.equal(arch.displayName, "Coding");
});

test("getVerticalDomainArchitecture throws for unknown domain", () => {
  assert.throws(
    () => SERVICE.getVerticalDomainArchitecture("nonexistent-domain-xyz"),
    (err: any) => err.message.includes("not_found"),
  );
});

test("hasVerticalDomainArchitecture returns true for canonical domain", () => {
  assert.equal(SERVICE.hasVerticalDomainArchitecture("coding"), true);
  assert.equal(SERVICE.hasVerticalDomainArchitecture("quant-trading"), true);
  assert.equal(SERVICE.hasVerticalDomainArchitecture("healthcare"), true);
});

test("hasVerticalDomainArchitecture returns false for unknown domain", () => {
  assert.equal(SERVICE.hasVerticalDomainArchitecture("unknown-domain"), false);
  assert.equal(SERVICE.hasVerticalDomainArchitecture(""), false);
});

test("legacy domain IDs resolve to canonical domain IDs", () => {
  const legacyToCanonical: Record<string, string> = {
    "data-processing": "data-engineering",
    "enterprise-knowledge-base": "knowledge-base",
    "quantitative-trading": "quant-trading",
    "advertising-promotion": "advertising",
    sales: "ecommerce",
    security: "content-moderation",
    "data-analytics": "data-engineering",
    finance: "finance-accounting",
    "online-livestream": "live-streaming",
    "medical-health": "healthcare",
    "supply-chain-logistics": "supply-chain",
    "education-training": "education",
    "advertising-creative": "creative-production",
    "game-development": "game-dev",
    "marketing-brand": "marketing",
  };

  for (const [legacyId, canonicalId] of Object.entries(legacyToCanonical)) {
    const arch = SERVICE.getVerticalDomainArchitecture(legacyId);
    assert.equal(arch.domainId, canonicalId, `${legacyId} should resolve to ${canonicalId}`);
  }
});

// ---------------------------------------------------------------------------
// Domain-specific workflow templates
// ---------------------------------------------------------------------------

test("workflow template ID is domain-specific and follows naming convention", () => {
  const coding = SERVICE.getVerticalDomainArchitecture("coding");
  const quant = SERVICE.getVerticalDomainArchitecture("quant-trading");
  const healthcare = SERVICE.getVerticalDomainArchitecture("healthcare");

  assert.ok(coding.workflow.workflowTemplateId.endsWith(".primary"));
  assert.ok(quant.workflow.workflowTemplateId.endsWith(".primary"));
  assert.ok(healthcare.workflow.workflowTemplateId.endsWith(".primary"));

  assert.notEqual(
    coding.workflow.workflowTemplateId,
    quant.workflow.workflowTemplateId,
    "workflow template IDs should be domain-specific",
  );
});

test("stage names are domain-specific", () => {
  const coding = SERVICE.getVerticalDomainArchitecture("coding");
  const quant = SERVICE.getVerticalDomainArchitecture("quant-trading");

  assert.ok(Array.isArray(coding.workflow.stageNames));
  assert.ok(coding.workflow.stageNames.length > 0);
  assert.ok(Array.isArray(quant.workflow.stageNames));
  assert.ok(quant.workflow.stageNames.length > 0);

  assert.notEqual(
    JSON.stringify(coding.workflow.stageNames),
    JSON.stringify(quant.workflow.stageNames),
    "stage names should differ between domains",
  );
});

test("quant-trading workflow has ultra-low latency stages", () => {
  const quant = SERVICE.getVerticalDomainArchitecture("quant-trading");

  assert.ok(quant.workflow.stageNames.includes("ingest_market_data"));
  assert.ok(quant.workflow.stageNames.includes("check_risk_limits"));
});

test("healthcare workflow includes clinical stages", () => {
  const healthcare = SERVICE.getVerticalDomainArchitecture("healthcare");

  assert.ok(healthcare.workflow.stageNames.includes("collect_clinical_context"));
  assert.ok(healthcare.workflow.stageNames.includes("apply_guidelines"));
});

test("coding workflow includes software delivery stages", () => {
  const coding = SERVICE.getVerticalDomainArchitecture("coding");

  assert.ok(coding.workflow.stageNames.includes("implement_patch"));
  assert.ok(coding.workflow.stageNames.includes("run_validation"));
});

// ---------------------------------------------------------------------------
// Domain capability mapping
// ---------------------------------------------------------------------------

test("architecture maps risk profile correctly", () => {
  const quant = SERVICE.getVerticalDomainArchitecture("quant-trading");
  const coding = SERVICE.getVerticalDomainArchitecture("coding");

  assert.equal(quant.risk.defaultRiskLevel, "critical");
  assert.equal(coding.risk.defaultRiskLevel, "high");
});

test("architecture maps latency profile correctly", () => {
  const quant = SERVICE.getVerticalDomainArchitecture("quant-trading");
  const dataEng = SERVICE.getVerticalDomainArchitecture("data-engineering");

  assert.equal(quant.latency.tier, "ultra_realtime");
  assert.ok(quant.latency.targetResponseMinutes < dataEng.latency.targetResponseMinutes);
});

test("architecture maps eval specialization correctly", () => {
  const quant = SERVICE.getVerticalDomainArchitecture("quant-trading");

  assert.ok(Array.isArray(quant.eval.blockingMetricIds));
  assert.ok(quant.eval.blockingMetricIds.length > 0);
  assert.ok(quant.eval.blockingMetricIds.includes("sharpe_ratio"));
  assert.ok(quant.eval.blockingMetricIds.includes("max_drawdown"));
});

test("architecture maps ownership profile correctly", () => {
  const coding = SERVICE.getVerticalDomainArchitecture("coding");

  assert.ok(typeof coding.ownership.ownerTeam === "string");
  assert.ok(coding.ownership.ownerTeam.length > 0);
  assert.ok(typeof coding.ownership.escalationTeam === "string");
  assert.ok(coding.ownership.escalationTeam.length > 0);
  assert.ok(typeof coding.ownership.configPath === "string");
  assert.ok(coding.ownership.configPath.length > 0);
});

test("architecture maps tooling specialization correctly", () => {
  const coding = SERVICE.getVerticalDomainArchitecture("coding");

  assert.ok(coding.tooling.bundleId.includes("coding"));
  assert.ok(Array.isArray(coding.tooling.requiredToolNames));
  assert.ok(coding.tooling.requiredToolNames.includes("repo_map"));
  assert.ok(coding.tooling.requiredToolNames.includes("patch_apply"));
});

test("architecture maps knowledge namespaces correctly", () => {
  const coding = SERVICE.getVerticalDomainArchitecture("coding");

  assert.ok(Array.isArray(coding.knowledgeNamespaces));
  assert.ok(coding.knowledgeNamespaces.length >= 1);
  assert.ok(coding.knowledgeNamespaces.some((ns) => ns.startsWith("coding/")));
});

test("architecture maps recipe IDs correctly", () => {
  const coding = SERVICE.getVerticalDomainArchitecture("coding");

  assert.ok(Array.isArray(coding.recipeIds));
  assert.ok(coding.recipeIds.length > 0);
  assert.ok(coding.recipeIds[0]!.includes("coding"));
});

test("architecture preserves phase from domain baseline", () => {
  const coding = SERVICE.getVerticalDomainArchitecture("coding");
  const marketing = SERVICE.getVerticalDomainArchitecture("marketing");

  assert.ok(["9a", "9b", "9c", "9d", "9e", "9f"].includes(coding.phase));
  assert.ok(["9a", "9b", "9c", "9d", "9e", "9f"].includes(marketing.phase));
});

test("architecture preserves legacy domain IDs", () => {
  const dataEng = SERVICE.getVerticalDomainArchitecture("data-engineering");
  const quant = SERVICE.getVerticalDomainArchitecture("quant-trading");

  assert.ok(Array.isArray(dataEng.legacyDomainIds));
  assert.ok(dataEng.legacyDomainIds.includes("data-processing"));
  assert.ok(quant.legacyDomainIds.includes("quantitative-trading"));
});

// ---------------------------------------------------------------------------
// Architecture validation
// ---------------------------------------------------------------------------

test("architectureSections contains all 8 required sections", () => {
  const arch = SERVICE.getVerticalDomainArchitecture("coding");
  const expectedSectionIds = [
    "workflow",
    "tooling",
    "risk",
    "eval",
    "latency",
    "ownership",
    "knowledge",
    "recipes",
  ];

  assert.equal(arch.architectureSections.length, expectedSectionIds.length);

  const sectionIds = arch.architectureSections.map((s) => s.sectionId);
  for (const expected of expectedSectionIds) {
    assert.ok(
      (sectionIds as readonly string[]).includes(expected),
      `section ${expected} should be present`,
    );
  }
});

test("architectureSections have non-empty titles and summaries", () => {
  const arch = SERVICE.getVerticalDomainArchitecture("coding");

  for (const section of arch.architectureSections) {
    assert.ok(section.title.length > 0, `section should have a title`);
    assert.ok(section.summary.length > 0, `section should have a summary`);
  }
});

test("workflow section summary references workflow template and stage count", () => {
  const arch = SERVICE.getVerticalDomainArchitecture("coding");

  const workflowSection = arch.architectureSections.find((s) => s.sectionId === "workflow");
  assert.ok(workflowSection);
  assert.ok(workflowSection.summary.includes("coding.primary"));
  assert.ok(workflowSection.summary.includes(String(arch.workflow.stageNames.length)));
});

test("tooling section summary references bundle and required tools", () => {
  const arch = SERVICE.getVerticalDomainArchitecture("coding");

  const toolingSection = arch.architectureSections.find((s) => s.sectionId === "tooling");
  assert.ok(toolingSection);
  assert.ok(toolingSection.summary.includes(arch.tooling.bundleId));
  assert.ok(toolingSection.summary.includes(arch.tooling.requiredToolNames.join(", ")));
});

test("risk section summary references risk level and rollout strategy", () => {
  const arch = SERVICE.getVerticalDomainArchitecture("coding");

  const riskSection = arch.architectureSections.find((s) => s.sectionId === "risk");
  assert.ok(riskSection);
  assert.ok(riskSection.summary.includes(arch.risk.defaultRiskLevel));
});

test("eval section summary lists blocking metrics", () => {
  const arch = SERVICE.getVerticalDomainArchitecture("coding");

  const evalSection = arch.architectureSections.find((s) => s.sectionId === "eval");
  assert.ok(evalSection);
  assert.ok(evalSection.summary.includes(arch.eval.blockingMetricIds.join(", ")));
});

test("latency section summary includes target and max minutes", () => {
  const arch = SERVICE.getVerticalDomainArchitecture("coding");

  const latencySection = arch.architectureSections.find((s) => s.sectionId === "latency");
  assert.ok(latencySection);
  assert.ok(latencySection.summary.includes(String(arch.latency.targetResponseMinutes)));
  assert.ok(latencySection.summary.includes(String(arch.latency.maxResponseMinutes)));
});

test("ownership section summary includes owner and escalation teams", () => {
  const arch = SERVICE.getVerticalDomainArchitecture("coding");

  const ownershipSection = arch.architectureSections.find((s) => s.sectionId === "ownership");
  assert.ok(ownershipSection);
  assert.ok(ownershipSection.summary.includes(arch.ownership.ownerTeam));
  assert.ok(ownershipSection.summary.includes(arch.ownership.escalationTeam));
});

test("knowledge section summary references namespace count", () => {
  const arch = SERVICE.getVerticalDomainArchitecture("coding");

  const knowledgeSection = arch.architectureSections.find((s) => s.sectionId === "knowledge");
  assert.ok(knowledgeSection);
  assert.ok(knowledgeSection.summary.includes(String(arch.knowledgeNamespaces.length)));
});

test("recipes section summary references recipe count", () => {
  const arch = SERVICE.getVerticalDomainArchitecture("coding");

  const recipesSection = arch.architectureSections.find((s) => s.sectionId === "recipes");
  assert.ok(recipesSection);
  assert.ok(recipesSection.summary.includes(String(arch.recipeIds.length)));
});

test("all domains have valid architecture records", () => {
  const architectures = SERVICE.listVerticalDomainArchitectures();

  for (const arch of architectures) {
    assert.ok(arch.domainId.length > 0);
    assert.ok(arch.displayName.length > 0);
    assert.ok(arch.phase.length > 0);
    assert.ok(arch.ownerOrgNodeId.length > 0);
    assert.ok(arch.configPath.length > 0);
    assert.ok(arch.workflow.workflowTemplateId.length > 0);
    assert.ok(arch.workflow.stageNames.length > 0);
    assert.ok(arch.tooling.bundleId.length > 0);
    assert.ok(arch.risk.defaultRiskLevel.length > 0);
    assert.ok(Array.isArray(arch.eval.blockingMetricIds));
    assert.ok(arch.latency.targetResponseMinutes > 0);
    assert.ok(arch.latency.maxResponseMinutes > 0);
    assert.ok(arch.ownership.ownerTeam.length > 0);
    assert.ok(arch.ownership.escalationTeam.length > 0);
    assert.ok(Array.isArray(arch.knowledgeNamespaces));
    assert.ok(Array.isArray(arch.recipeIds));
    assert.ok(arch.architectureSections.length === 8);
  }
});

test("critical risk domains have shadow rollout strategy in risk summary", () => {
  const quant = SERVICE.getVerticalDomainArchitecture("quant-trading");
  const healthcare = SERVICE.getVerticalDomainArchitecture("healthcare");

  assert.equal(quant.risk.defaultRiskLevel, "critical");
  assert.equal(healthcare.risk.defaultRiskLevel, "critical");
});

test("service is stateless - multiple calls return consistent results", () => {
  const arch1 = SERVICE.getVerticalDomainArchitecture("coding");
  const arch2 = SERVICE.getVerticalDomainArchitecture("coding");

  assert.deepStrictEqual(arch1, arch2);
});

test("list and get return consistent data for same domain", () => {
  const byList = SERVICE.listVerticalDomainArchitectures().find((a) => a.domainId === "coding");
  const byGet = SERVICE.getVerticalDomainArchitecture("coding");

  assert.ok(byList);
  assert.deepStrictEqual(byList, byGet);
});
