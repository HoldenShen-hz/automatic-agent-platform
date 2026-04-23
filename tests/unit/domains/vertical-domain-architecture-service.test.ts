import assert from "node:assert/strict";
import test from "node:test";

import { VerticalDomainArchitectureService } from "../../../src/domains/vertical-domain-architecture-service.js";

test("vertical domain architecture service exposes authoritative architecture records for all 31 domains", () => {
  const service = new VerticalDomainArchitectureService();
  const records = service.listVerticalDomainArchitectures();

  assert.equal(records.length, 31);
  assert.equal(records.every((record) => record.architectureSections.length === 8), true);
  assert.equal(records.every((record) => record.configPath.endsWith(`${record.domainId}.json`)), true);
});

test("vertical domain architecture service resolves legacy aliases into canonical architecture views", () => {
  const service = new VerticalDomainArchitectureService();
  const record = service.getVerticalDomainArchitecture("quantitative-trading");

  assert.equal(record.domainId, "quant-trading");
  assert.equal(record.legacyDomainIds.includes("quantitative-trading"), true);
  assert.equal(record.workflow.stageNames.length >= 4, true);
  assert.equal(record.tooling.requiredToolNames.length >= 1, true);
});

test("vertical domain architecture service materializes healthcare architecture sections", () => {
  const service = new VerticalDomainArchitectureService();
  const record = service.getVerticalDomainArchitecture("healthcare");

  assert.equal(record.risk.defaultRiskLevel, "critical");
  assert.equal(record.latency.dataSensitivity, "regulated");
  assert.equal(record.knowledgeNamespaces.length > 0, true);
  assert.equal(record.architectureSections.some((section) => section.sectionId === "risk"), true);
  assert.equal(record.architectureSections.some((section) => section.sectionId === "ownership"), true);
});
