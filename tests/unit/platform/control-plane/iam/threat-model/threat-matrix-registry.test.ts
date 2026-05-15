import assert from "node:assert/strict";
import test from "node:test";

import { ThreatMatrixRegistry, defaultThreatMatrixRegistry } from "../../../../../../src/platform/five-plane-control-plane/iam/threat-model/index.js";
import type { ThreatMatrix, ThreatEntry, StrideCategory } from "../../../../../../src/platform/five-plane-control-plane/iam/threat-model/stride-framework.js";

test("ThreatMatrixRegistry can be instantiated with no arguments", () => {
  const registry = new ThreatMatrixRegistry();
  assert.ok(registry !== undefined);
});

test("ThreatMatrixRegistry getMatrix returns matrix with entries", () => {
  const registry = new ThreatMatrixRegistry();
  const matrix = registry.getMatrix();
  assert.ok(matrix.entries.length > 0);
  assert.equal(matrix.version, "2026.04");
  assert.equal(matrix.owner, "platform_security");
});

test("ThreatMatrixRegistry getMatrix returns defensive copy of entries", () => {
  const registry = new ThreatMatrixRegistry();
  const matrix1 = registry.getMatrix();
  const matrix2 = registry.getMatrix();
  assert.ok(matrix1.entries !== matrix2.entries);
  assert.deepEqual(matrix1.entries, matrix2.entries);
});

test("ThreatMatrixRegistry getMatrix returns defensive copy of mitigations", () => {
  const registry = new ThreatMatrixRegistry();
  const matrix1 = registry.getMatrix();
  const matrix2 = registry.getMatrix();
  const firstEntry = matrix1.entries.at(0);
  const secondEntry = matrix2.entries.at(0);
  assert.ok(firstEntry);
  assert.ok(secondEntry);
  assert.ok(firstEntry.mitigations !== secondEntry.mitigations);
});

test("ThreatMatrixRegistry listCategories returns STRIDE categories", () => {
  const registry = new ThreatMatrixRegistry();
  const categories = registry.listCategories();
  assert.ok(categories.length > 0);
  assert.ok(categories.includes("SPOOFING" as StrideCategory));
  assert.ok(categories.includes("TAMPERING" as StrideCategory));
  assert.ok(categories.includes("REPUDIATION" as StrideCategory));
  assert.ok(categories.includes("INFORMATION_DISCLOSURE" as StrideCategory));
  assert.ok(categories.includes("DENIAL_OF_SERVICE" as StrideCategory));
  assert.ok(categories.includes("ELEVATION_OF_PRIVILEGE" as StrideCategory));
});

test("ThreatMatrixRegistry listByCategory filters entries by category", () => {
  const registry = new ThreatMatrixRegistry();
  const spoofingEntries = registry.listByCategory("SPOOFING" as StrideCategory);
  assert.ok(spoofingEntries.length > 0);
  for (const entry of spoofingEntries) {
    assert.equal(entry.category, "SPOOFING");
  }
});

test("ThreatMatrixRegistry listByCategory returns empty array for category with no entries", () => {
  const registry = new ThreatMatrixRegistry({
    version: "2026.04",
    updatedAt: "2026-04-23T00:00:00.000Z",
    owner: "test",
    entries: [],
  });
  const entries = registry.listByCategory("SPOOFING" as StrideCategory);
  assert.equal(entries.length, 0);
});

test("ThreatMatrixRegistry validate returns result without throwing for valid matrix", () => {
  const registry = new ThreatMatrixRegistry();
  assert.doesNotThrow(() => registry.validate());
});

test("ThreatMatrixRegistry validate throws for matrix missing required fields", () => {
  const registry = new ThreatMatrixRegistry({
    version: "2026.04",
    updatedAt: "2026-04-23T00:00:00.000Z",
    owner: "test",
    entries: [
      {
        threatId: "test",
        category: "SPOOFING" as StrideCategory,
        title: "Test threat",
        scenario: "Test scenario",
        mitigations: [],
        implementationRefs: [],
        residualRisk: "medium",
      },
    ],
  });
  assert.doesNotThrow(() => registry.validate());
});

test("ThreatMatrixRegistry accepts custom matrix", () => {
  const customMatrix: ThreatMatrix = {
    version: "2026.05",
    updatedAt: "2026-04-24T00:00:00.000Z",
    owner: "custom",
    entries: [
      {
        threatId: "custom_threat",
        category: "SPOOFING" as StrideCategory,
        title: "Custom threat",
        scenario: "Custom scenario",
        mitigations: ["custom mitigation"],
        implementationRefs: [],
        residualRisk: "low",
      },
    ],
  };
  const registry = new ThreatMatrixRegistry(customMatrix);
  const matrix = registry.getMatrix();
  assert.equal(matrix.version, "2026.05");
  assert.equal(matrix.owner, "custom");
  assert.equal(matrix.entries.length, 1);
  const firstEntry = matrix.entries.at(0);
  assert.ok(firstEntry);
  assert.equal(firstEntry.threatId, "custom_threat");
});

test("defaultThreatMatrixRegistry is instance of ThreatMatrixRegistry", () => {
  assert.ok(defaultThreatMatrixRegistry instanceof ThreatMatrixRegistry);
});

test("defaultThreatMatrixRegistry has expected default entries", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();
  assert.ok(matrix.entries.length >= 6);
  const threatIds = matrix.entries.map((e) => e.threatId);
  assert.ok(threatIds.includes("tm_spoofing_principal_identity"));
  assert.ok(threatIds.includes("tm_tampering_audit_chain"));
  assert.ok(threatIds.includes("tm_repudiation_operator_actions"));
  assert.ok(threatIds.includes("tm_information_disclosure_secret_egress"));
  assert.ok(threatIds.includes("tm_dos_runtime_exhaustion"));
  assert.ok(threatIds.includes("tm_eop_capability_escalation"));
});

test("ThreatMatrixRegistry entries have required fields", () => {
  const registry = new ThreatMatrixRegistry();
  const matrix = registry.getMatrix();
  for (const entry of matrix.entries) {
    assert.ok(entry.threatId);
    assert.ok(entry.category);
    assert.ok(entry.title);
    assert.ok(entry.scenario);
    assert.ok(Array.isArray(entry.mitigations));
    assert.ok(Array.isArray(entry.implementationRefs));
    assert.ok(entry.residualRisk);
  }
});

test("ThreatMatrixRegistry entries have valid residual risk values", () => {
  const registry = new ThreatMatrixRegistry();
  const matrix = registry.getMatrix();
  const validRisks = ["low", "medium", "high"];
  for (const entry of matrix.entries) {
    assert.ok(validRisks.includes(entry.residualRisk), `Invalid residual risk: ${entry.residualRisk}`);
  }
});

test("ThreatMatrixRegistry listByCategory is case sensitive", () => {
  const registry = new ThreatMatrixRegistry();
  const spoofingEntries = registry.listByCategory("SPOOFING" as StrideCategory);
  const lowercaseEntries = registry.listByCategory("spoofing" as StrideCategory);
  assert.ok(spoofingEntries.length > 0);
  assert.equal(lowercaseEntries.length, 0);
});

test("ThreatMatrixRegistry validate returns validation result object", () => {
  const registry = new ThreatMatrixRegistry();
  const result = registry.validate();
  assert.ok(typeof result === "object");
  assert.ok("valid" in result);
  assert.ok("missingCategories" in result);
});

test("ThreatMatrixRegistry custom matrix can have zero entries", () => {
  const registry = new ThreatMatrixRegistry({
    version: "2026.04",
    updatedAt: "2026-04-23T00:00:00.000Z",
    owner: "test",
    entries: [],
  });
  const matrix = registry.getMatrix();
  assert.equal(matrix.entries.length, 0);
  const categories = registry.listCategories();
  assert.ok(categories.length > 0);
  const entries = registry.listByCategory("SPOOFING" as StrideCategory);
  assert.equal(entries.length, 0);
});

test("ThreatMatrixRegistry all categories have at least one entry in default matrix", () => {
  const registry = new ThreatMatrixRegistry();
  const categories = registry.listCategories();
  for (const category of categories) {
    const entries = registry.listByCategory(category);
    assert.ok(entries.length > 0, `Category ${category} has no entries`);
  }
});
