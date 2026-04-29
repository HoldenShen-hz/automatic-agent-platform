/**
 * ARCH-P0-3: §11.8 STRIDE 威胁模型完全缺失
 *
 * Unit tests for STRIDE threat model (6 dimensions).
 * Verifies that StrideCategory enum defines 6 STRIDE dimensions and
 * ThreatMatrix has entries for all 6 dimensions with at least one mitigation each.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { STRIDE_CATEGORIES, validateThreatMatrix, listThreatsByCategory, type StrideCategory, type ThreatMatrix } from "../../../../../src/platform/five-plane-control-plane/iam/threat-model/stride-framework.js";
import { ThreatMatrixRegistry, defaultThreatMatrixRegistry } from "../../../../../src/platform/five-plane-control-plane/iam/threat-model/threat-matrix-registry.js";

test("[ARCH-P0-3] StrideCategory enum defines 6 STRIDE dimensions", () => {
  const categories = Object.values(STRIDE_CATEGORIES);
  assert.equal(categories.length, 6, "STRIDE must have exactly 6 categories");
  assert.ok(categories.includes("SPOOFING"), "Missing SPOOFING");
  assert.ok(categories.includes("TAMPERING"), "Missing TAMPERING");
  assert.ok(categories.includes("REPUDIATION"), "Missing REPUDIATION");
  assert.ok(categories.includes("INFORMATION_DISCLOSURE"), "Missing INFORMATION_DISCLOSURE");
  assert.ok(categories.includes("DENIAL_OF_SERVICE"), "Missing DENIAL_OF_SERVICE");
  assert.ok(categories.includes("ELEVATION_OF_PRIVILEGE"), "Missing ELEVATION_OF_PRIVILEGE");
});

test("[ARCH-P0-3] StrideCategory type accepts all 6 category values", () => {
  const spoofing: StrideCategory = "SPOOFING";
  assert.equal(spoofing, "SPOOFING");

  const tampering: StrideCategory = "TAMPERING";
  assert.equal(tampering, "TAMPERING");

  const repudiation: StrideCategory = "REPUDIATION";
  assert.equal(repudiation, "REPUDIATION");

  const infoDisclosure: StrideCategory = "INFORMATION_DISCLOSURE";
  assert.equal(infoDisclosure, "INFORMATION_DISCLOSURE");

  const dos: StrideCategory = "DENIAL_OF_SERVICE";
  assert.equal(dos, "DENIAL_OF_SERVICE");

  const eop: StrideCategory = "ELEVATION_OF_PRIVILEGE";
  assert.equal(eop, "ELEVATION_OF_PRIVILEGE");
});

test("[ARCH-P0-3] ThreatMatrix has entries for all 6 STRIDE dimensions", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();
  const coveredCategories = new Set(matrix.entries.map((e) => e.category));

  for (const cat of STRIDE_CATEGORIES) {
    assert.ok(coveredCategories.has(cat), `No threat entry for ${cat}`);
  }
});

test("[ARCH-P0-3] each STRIDE dimension has at least one mitigation", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();

  for (const cat of STRIDE_CATEGORIES) {
    const entries = matrix.entries.filter((e) => e.category === cat);
    assert.ok(entries.length > 0, `${cat} must have at least one threat entry`);

    const hasMitigation = entries.some((e) => e.mitigations.length > 0);
    assert.ok(hasMitigation, `${cat} must have at least one mitigation`);
  }
});

test("[ARCH-P0-3] validateThreatMatrix returns valid for complete matrix", () => {
  const matrix: ThreatMatrix = {
    version: "1.0",
    updatedAt: "2026-01-01T00:00:00.000Z",
    owner: "test",
    entries: STRIDE_CATEGORIES.map((cat, i) => ({
      threatId: `threat_${i}`,
      category: cat,
      title: `Test threat for ${cat}`,
      scenario: "Test scenario",
      mitigations: ["test mitigation"],
      implementationRefs: ["src/test.ts"],
      residualRisk: "medium" as const,
    })),
  };

  const result = validateThreatMatrix(matrix);

  assert.equal(result.valid, true, "Matrix should be valid when all categories present");
  assert.deepEqual(result.missingCategories, [], "No categories should be missing");
});

test("[ARCH-P0-3] validateThreatMatrix detects missing categories", () => {
  const matrix: ThreatMatrix = {
    version: "1.0",
    updatedAt: "2026-01-01T00:00:00.000Z",
    owner: "test",
    entries: [
      {
        threatId: "threat_1",
        category: "SPOOFING" as StrideCategory,
        title: "Test threat",
        scenario: "Test scenario",
        mitigations: ["mit1"],
        implementationRefs: ["src/test.ts"],
        residualRisk: "low" as const,
      },
    ],
  };

  const result = validateThreatMatrix(matrix);

  assert.equal(result.valid, false, "Matrix should be invalid when categories are missing");
  assert.ok(result.missingCategories.length > 0, "Should have missing categories");
  assert.ok(result.missingCategories.includes("TAMPERING"), "TAMPERING should be missing");
  assert.ok(result.missingCategories.includes("REPUDIATION"), "REPUDIATION should be missing");
  assert.ok(result.missingCategories.includes("INFORMATION_DISCLOSURE"), "INFORMATION_DISCLOSURE should be missing");
  assert.ok(result.missingCategories.includes("DENIAL_OF_SERVICE"), "DENIAL_OF_SERVICE should be missing");
  assert.ok(result.missingCategories.includes("ELEVATION_OF_PRIVILEGE"), "ELEVATION_OF_PRIVILEGE should be missing");
});

test("[ARCH-P0-3] ThreatMatrixRegistry can be instantiated with default matrix", () => {
  const registry = new ThreatMatrixRegistry();
  assert.ok(registry !== undefined);
  assert.ok(registry.getMatrix() !== undefined);
});

test("[ARCH-P0-3] ThreatMatrixRegistry listCategories returns all STRIDE categories", () => {
  const registry = new ThreatMatrixRegistry();
  const categories = registry.listCategories();

  assert.equal(categories.length, 6);
  assert.deepEqual(categories, STRIDE_CATEGORIES);
});

test("[ARCH-P0-3] ThreatMatrixRegistry listByCategory returns entries for category", () => {
  const registry = new ThreatMatrixRegistry();

  const spoofingEntries = registry.listByCategory("SPOOFING" as StrideCategory);
  assert.ok(spoofingEntries.length > 0, "SPOOFING should have entries");
  for (const entry of spoofingEntries) {
    assert.equal(entry.category, "SPOOFING");
  }

  const tamperingEntries = registry.listByCategory("TAMPERING" as StrideCategory);
  assert.ok(tamperingEntries.length > 0, "TAMPERING should have entries");
  for (const entry of tamperingEntries) {
    assert.equal(entry.category, "TAMPERING");
  }
});

test("[ARCH-P0-3] ThreatMatrixRegistry validate returns validation result", () => {
  const registry = new ThreatMatrixRegistry();
  const result = registry.validate();

  assert.ok(typeof result === "object");
  assert.ok("valid" in result);
  assert.ok("missingCategories" in result);
  assert.equal(result.valid, true, "Default registry should be valid");
  assert.deepEqual(result.missingCategories, []);
});

test("[ARCH-P0-3] defaultThreatMatrixRegistry is instance of ThreatMatrixRegistry", () => {
  assert.ok(defaultThreatMatrixRegistry instanceof ThreatMatrixRegistry);
});

test("[ARCH-P0-3] defaultThreatMatrixRegistry has expected default entries", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();
  assert.ok(matrix.entries.length >= 6, "Should have at least 6 entries");

  const threatIds = matrix.entries.map((e) => e.threatId);
  assert.ok(threatIds.includes("tm_spoofing_principal_identity"), "Missing tm_spoofing_principal_identity");
  assert.ok(threatIds.includes("tm_tampering_audit_chain"), "Missing tm_tampering_audit_chain");
  assert.ok(threatIds.includes("tm_repudiation_operator_actions"), "Missing tm_repudiation_operator_actions");
  assert.ok(threatIds.includes("tm_information_disclosure_secret_egress"), "Missing tm_information_disclosure_secret_egress");
  assert.ok(threatIds.includes("tm_dos_runtime_exhaustion"), "Missing tm_dos_runtime_exhaustion");
  assert.ok(threatIds.includes("tm_eop_capability_escalation"), "Missing tm_eop_capability_escalation");
});

test("[ARCH-P0-3] listThreatsByCategory returns correct entries", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();

  const spoofingThreats = listThreatsByCategory(matrix, "SPOOFING" as StrideCategory);
  assert.ok(spoofingThreats.length > 0);
  assert.ok(spoofingThreats.every((t) => t.category === "SPOOFING"));

  const tamperingThreats = listThreatsByCategory(matrix, "TAMPERING" as StrideCategory);
  assert.ok(tamperingThreats.length > 0);
  assert.ok(tamperingThreats.every((t) => t.category === "TAMPERING"));
});

test("[ARCH-P0-3] listThreatsByCategory returns empty for non-existent category", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();

  const nonExistent = listThreatsByCategory(matrix, "NON_EXISTENT" as StrideCategory);
  assert.equal(nonExistent.length, 0);
});

test("[ARCH-P0-3] each threat entry has required fields", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();

  for (const entry of matrix.entries) {
    assert.ok(entry.threatId, "Entry must have threatId");
    assert.ok(entry.category, "Entry must have category");
    assert.ok(entry.title, "Entry must have title");
    assert.ok(entry.scenario, "Entry must have scenario");
    assert.ok(Array.isArray(entry.mitigations), "Entry must have mitigations array");
    assert.ok(Array.isArray(entry.implementationRefs), "Entry must have implementationRefs array");
    assert.ok(entry.residualRisk, "Entry must have residualRisk");
  }
});

test("[ARCH-P0-3] all entries have valid residual risk levels", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();
  const validRisks = ["low", "medium", "high"];

  for (const entry of matrix.entries) {
    assert.ok(
      validRisks.includes(entry.residualRisk),
      `Invalid residual risk "${entry.residualRisk}" for threat ${entry.threatId}`,
    );
  }
});

test("[ARCH-P0-3] all entries have at least one implementation reference", () => {
  const matrix = defaultThreatMatrixRegistry.getMatrix();

  for (const entry of matrix.entries) {
    assert.ok(entry.implementationRefs.length > 0, `Entry ${entry.threatId} must have at least one implementation reference`);
  }
});

test("[ARCH-P0-3] ThreatMatrixRegistry accepts custom matrix", () => {
  const customMatrix: ThreatMatrix = {
    version: "2026.05",
    updatedAt: "2026-04-29T00:00:00.000Z",
    owner: "custom",
    entries: [
      {
        threatId: "custom_threat",
        category: "SPOOFING" as StrideCategory,
        title: "Custom threat",
        scenario: "Custom scenario",
        mitigations: ["custom mitigation"],
        implementationRefs: ["src/custom.ts"],
        residualRisk: "low",
      },
    ],
  };

  const registry = new ThreatMatrixRegistry(customMatrix);
  const matrix = registry.getMatrix();

  assert.equal(matrix.version, "2026.05");
  assert.equal(matrix.owner, "custom");
  assert.equal(matrix.entries.length, 1);
});

test("[ARCH-P0-3] custom matrix with missing categories is invalid", () => {
  const customMatrix: ThreatMatrix = {
    version: "2026.05",
    updatedAt: "2026-04-29T00:00:00.000Z",
    owner: "custom",
    entries: [
      {
        threatId: "custom_threat",
        category: "SPOOFING" as StrideCategory,
        title: "Custom threat",
        scenario: "Custom scenario",
        mitigations: ["custom mitigation"],
        implementationRefs: ["src/custom.ts"],
        residualRisk: "low",
      },
    ],
  };

  const registry = new ThreatMatrixRegistry(customMatrix);
  const result = registry.validate();

  assert.equal(result.valid, false);
  assert.ok(result.missingCategories.length > 0);
});

test("[ARCH-P0-3] getMatrix returns defensive copy of matrix entries", () => {
  const registry = new ThreatMatrixRegistry();
  const matrix1 = registry.getMatrix();
  const matrix2 = registry.getMatrix();

  assert.ok(matrix1.entries !== matrix2.entries, "Should return different entry arrays");
  assert.deepEqual(matrix1.entries, matrix2.entries, "Entry content should be equal");
});