import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolve } from "path";

const srcPath = resolve(fileURLToPath(import.meta.url), "../../../../src/domains/vertical-domain-architecture-service.js");
const mod = await import(srcPath);

test("VerticalDomainArchitectureService.listVerticalDomainArchitectures returns array", () => {
  const service = new mod.VerticalDomainArchitectureService();

  const architectures = service.listVerticalDomainArchitectures();

  assert.ok(Array.isArray(architectures));
});

test("VerticalDomainArchitectureService.listVerticalDomainArchitectures returns non-empty array", () => {
  const service = new mod.VerticalDomainArchitectureService();

  const architectures = service.listVerticalDomainArchitectures();

  assert.ok(architectures.length > 0);
});

test("VerticalDomainArchitectureService.getVerticalDomainArchitecture returns architecture for coding domain", () => {
  const service = new mod.VerticalDomainArchitectureService();

  const architecture = service.getVerticalDomainArchitecture("coding");

  assert.equal(architecture.domainId, "coding");
  assert.ok(architecture.displayName.length > 0);
});

test("VerticalDomainArchitectureService.hasVerticalDomainArchitecture returns true for known domain", () => {
  const service = new mod.VerticalDomainArchitectureService();

  assert.equal(service.hasVerticalDomainArchitecture("coding"), true);
});

test("VerticalDomainArchitectureService.hasVerticalDomainArchitecture returns false for unknown domain", () => {
  const service = new mod.VerticalDomainArchitectureService();

  assert.equal(service.hasVerticalDomainArchitecture("nonexistent-domain"), false);
});

test("VerticalDomainArchitectureService returns architecture with all required fields", () => {
  const service = new mod.VerticalDomainArchitectureService();

  const architecture = service.getVerticalDomainArchitecture("coding");

  assert.ok(architecture.domainId);
  assert.ok(Array.isArray(architecture.legacyDomainIds));
  assert.ok(architecture.displayName);
  assert.ok(architecture.phase);
  assert.ok(architecture.ownerOrgNodeId);
  assert.ok(architecture.workflow);
  assert.ok(architecture.tooling);
  assert.ok(architecture.risk);
  assert.ok(architecture.eval);
  assert.ok(architecture.latency);
  assert.ok(architecture.ownership);
  assert.ok(Array.isArray(architecture.knowledgeNamespaces));
  assert.ok(Array.isArray(architecture.recipeIds));
  assert.ok(Array.isArray(architecture.architectureSections));
});

test("VerticalDomainArchitectureService.architectureSections contain expected sections", () => {
  const service = new mod.VerticalDomainArchitectureService();

  const architecture = service.getVerticalDomainArchitecture("coding");

  const sectionIds = architecture.architectureSections.map(s => s.sectionId);

  assert.ok(sectionIds.includes("workflow"));
  assert.ok(sectionIds.includes("tooling"));
  assert.ok(sectionIds.includes("risk"));
  assert.ok(sectionIds.includes("eval"));
  assert.ok(sectionIds.includes("latency"));
  assert.ok(sectionIds.includes("ownership"));
  assert.ok(sectionIds.includes("knowledge"));
  assert.ok(sectionIds.includes("recipes"));
});

test("VerticalDomainArchitectureService.architectureSections have title and summary", () => {
  const service = new mod.VerticalDomainArchitectureService();

  const architecture = service.getVerticalDomainArchitecture("coding");

  for (const section of architecture.architectureSections) {
    assert.ok(section.title.length > 0);
    assert.ok(section.summary.length > 0);
  }
});

test("VerticalDomainArchitectureService.workflow has workflowTemplateId and stageNames", () => {
  const service = new mod.VerticalDomainArchitectureService();

  const architecture = service.getVerticalDomainArchitecture("coding");

  assert.ok(architecture.workflow.workflowTemplateId);
  assert.ok(Array.isArray(architecture.workflow.stageNames));
});

test("VerticalDomainArchitectureService.tooling has bundleId and requiredToolNames", () => {
  const service = new mod.VerticalDomainArchitectureService();

  const architecture = service.getVerticalDomainArchitecture("coding");

  assert.ok(architecture.tooling.bundleId);
  assert.ok(Array.isArray(architecture.tooling.requiredToolNames));
});

test("VerticalDomainArchitectureService.risk has defaultRiskLevel", () => {
  const service = new mod.VerticalDomainArchitectureService();

  const architecture = service.getVerticalDomainArchitecture("coding");

  assert.ok(architecture.risk.defaultRiskLevel);
});

test("VerticalDomainArchitectureService.eval has blockingMetricIds", () => {
  const service = new mod.VerticalDomainArchitectureService();

  const architecture = service.getVerticalDomainArchitecture("coding");

  assert.ok(Array.isArray(architecture.eval.blockingMetricIds));
});

test("VerticalDomainArchitectureService.latency has targetResponseMinutes and maxResponseMinutes", () => {
  const service = new mod.VerticalDomainArchitectureService();

  const architecture = service.getVerticalDomainArchitecture("coding");

  assert.ok(typeof architecture.latency.targetResponseMinutes === "number");
  assert.ok(typeof architecture.latency.maxResponseMinutes === "number");
});

test("VerticalDomainArchitectureService.ownership has ownerTeam and escalationTeam", () => {
  const service = new mod.VerticalDomainArchitectureService();

  const architecture = service.getVerticalDomainArchitecture("coding");

  assert.ok(architecture.ownership.ownerTeam);
  assert.ok(architecture.ownership.escalationTeam);
  assert.ok(architecture.ownership.configPath);
});
