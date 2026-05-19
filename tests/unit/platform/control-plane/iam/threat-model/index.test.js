/**
 * Unit tests for IAM Threat Model
 * Tests stride-framework.ts and threat-matrix-registry.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { STRIDE_CATEGORIES, validateThreatMatrix, listThreatsByCategory, } from "../../../../../../src/platform/control-plane/iam/threat-model/stride-framework.js";
import { ThreatMatrixRegistry, defaultThreatMatrixRegistry, } from "../../../../../../src/platform/control-plane/iam/threat-model/threat-matrix-registry.js";
// ============================================================================
// STRIDE Framework Tests
// ============================================================================
test("STRIDE_CATEGORIES contains all 6 categories", () => {
    assert.equal(STRIDE_CATEGORIES.length, 6);
    assert.ok(STRIDE_CATEGORIES.includes("SPOOFING"));
    assert.ok(STRIDE_CATEGORIES.includes("TAMPERING"));
    assert.ok(STRIDE_CATEGORIES.includes("REPUDIATION"));
    assert.ok(STRIDE_CATEGORIES.includes("INFORMATION_DISCLOSURE"));
    assert.ok(STRIDE_CATEGORIES.includes("DENIAL_OF_SERVICE"));
    assert.ok(STRIDE_CATEGORIES.includes("ELEVATION_OF_PRIVILEGE"));
});
test("validateThreatMatrix returns valid for complete matrix", () => {
    const matrix = {
        version: "1.0",
        updatedAt: "2026-01-01T00:00:00.000Z",
        owner: "security-team",
        entries: [
            {
                threatId: "threat_1",
                category: "SPOOFING",
                title: "Test threat",
                scenario: "Test scenario",
                mitigations: ["mitigation 1"],
                implementationRefs: ["src/file.ts"],
                residualRisk: "low",
            },
            {
                threatId: "threat_2",
                category: "TAMPERING",
                title: "Test threat",
                scenario: "Test scenario",
                mitigations: ["mitigation 1"],
                implementationRefs: ["src/file.ts"],
                residualRisk: "low",
            },
            {
                threatId: "threat_3",
                category: "REPUDIATION",
                title: "Test threat",
                scenario: "Test scenario",
                mitigations: ["mitigation 1"],
                implementationRefs: ["src/file.ts"],
                residualRisk: "low",
            },
            {
                threatId: "threat_4",
                category: "INFORMATION_DISCLOSURE",
                title: "Test threat",
                scenario: "Test scenario",
                mitigations: ["mitigation 1"],
                implementationRefs: ["src/file.ts"],
                residualRisk: "low",
            },
            {
                threatId: "threat_5",
                category: "DENIAL_OF_SERVICE",
                title: "Test threat",
                scenario: "Test scenario",
                mitigations: ["mitigation 1"],
                implementationRefs: ["src/file.ts"],
                residualRisk: "low",
            },
            {
                threatId: "threat_6",
                category: "ELEVATION_OF_PRIVILEGE",
                title: "Test threat",
                scenario: "Test scenario",
                mitigations: ["mitigation 1"],
                implementationRefs: ["src/file.ts"],
                residualRisk: "low",
            },
        ],
    };
    const result = validateThreatMatrix(matrix);
    assert.equal(result.valid, true);
    assert.equal(result.missingCategories.length, 0);
});
test("validateThreatMatrix returns missing categories for incomplete matrix", () => {
    const matrix = {
        version: "1.0",
        updatedAt: "2026-01-01T00:00:00.000Z",
        owner: "security-team",
        entries: [
            {
                threatId: "threat_1",
                category: "SPOOFING",
                title: "Test threat",
                scenario: "Test scenario",
                mitigations: ["mitigation 1"],
                implementationRefs: ["src/file.ts"],
                residualRisk: "low",
            },
        ],
    };
    const result = validateThreatMatrix(matrix);
    assert.equal(result.valid, false);
    assert.ok(result.missingCategories.includes("TAMPERING"));
    assert.ok(result.missingCategories.includes("REPUDIATION"));
    assert.ok(result.missingCategories.includes("INFORMATION_DISCLOSURE"));
    assert.ok(result.missingCategories.includes("DENIAL_OF_SERVICE"));
    assert.ok(result.missingCategories.includes("ELEVATION_OF_PRIVILEGE"));
});
test("listThreatsByCategory filters correctly", () => {
    const matrix = {
        version: "1.0",
        updatedAt: "2026-01-01T00:00:00.000Z",
        owner: "security-team",
        entries: [
            {
                threatId: "threat_1",
                category: "SPOOFING",
                title: "Spoofing threat 1",
                scenario: "Test scenario",
                mitigations: ["mitigation 1"],
                implementationRefs: ["src/file.ts"],
                residualRisk: "low",
            },
            {
                threatId: "threat_2",
                category: "SPOOFING",
                title: "Spoofing threat 2",
                scenario: "Test scenario",
                mitigations: ["mitigation 1"],
                implementationRefs: ["src/file.ts"],
                residualRisk: "medium",
            },
            {
                threatId: "threat_3",
                category: "TAMPERING",
                title: "Tampering threat",
                scenario: "Test scenario",
                mitigations: ["mitigation 1"],
                implementationRefs: ["src/file.ts"],
                residualRisk: "high",
            },
        ],
    };
    const spoofingThreats = listThreatsByCategory(matrix, "SPOOFING");
    assert.equal(spoofingThreats.length, 2);
    assert.ok(spoofingThreats.every((t) => t.category === "SPOOFING"));
    const tamperingThreats = listThreatsByCategory(matrix, "TAMPERING");
    assert.equal(tamperingThreats.length, 1);
    assert.equal(tamperingThreats[0].threatId, "threat_3");
});
test("listThreatsByCategory returns empty array for category with no threats", () => {
    const matrix = {
        version: "1.0",
        updatedAt: "2026-01-01T00:00:00.000Z",
        owner: "security-team",
        entries: [
            {
                threatId: "threat_1",
                category: "SPOOFING",
                title: "Test threat",
                scenario: "Test scenario",
                mitigations: ["mitigation 1"],
                implementationRefs: ["src/file.ts"],
                residualRisk: "low",
            },
        ],
    };
    const dosThreats = listThreatsByCategory(matrix, "DENIAL_OF_SERVICE");
    assert.equal(dosThreats.length, 0);
});
// ============================================================================
// ThreatMatrixRegistry Tests
// ============================================================================
test("ThreatMatrixRegistry initializes with default matrix", () => {
    const registry = new ThreatMatrixRegistry();
    const matrix = registry.getMatrix();
    assert.equal(matrix.version, "2026.04");
    assert.equal(matrix.owner, "platform_security");
    assert.ok(matrix.entries.length > 0);
});
test("ThreatMatrixRegistry getMatrix returns defensive copy", () => {
    const registry = new ThreatMatrixRegistry();
    const matrix1 = registry.getMatrix();
    const matrix2 = registry.getMatrix();
    // Should be equal but not same reference
    assert.deepEqual(matrix1, matrix2);
    matrix1.entries.push({
        threatId: "new_threat",
        category: "SPOOFING",
        title: "New threat",
        scenario: "New scenario",
        mitigations: [],
        implementationRefs: [],
        residualRisk: "low",
    });
    const matrix3 = registry.getMatrix();
    assert.notEqual(matrix3.entries.length, matrix1.entries.length);
});
test("ThreatMatrixRegistry listCategories returns all STRIDE categories", () => {
    const registry = new ThreatMatrixRegistry();
    const categories = registry.listCategories();
    assert.deepEqual(categories, STRIDE_CATEGORIES);
});
test("ThreatMatrixRegistry listByCategory filters entries", () => {
    const registry = new ThreatMatrixRegistry();
    const spoofingThreats = registry.listByCategory("SPOOFING");
    assert.ok(spoofingThreats.length > 0);
    assert.ok(spoofingThreats.every((t) => t.category === "SPOOFING"));
});
test("ThreatMatrixRegistry listByCategory returns empty for missing category", () => {
    const customMatrix = {
        version: "1.0",
        updatedAt: "2026-01-01T00:00:00.000Z",
        owner: "test",
        entries: [
            {
                threatId: "spoof_1",
                category: "SPOOFING",
                title: "Test",
                scenario: "Test",
                mitigations: [],
                implementationRefs: [],
                residualRisk: "low",
            },
        ],
    };
    const registry = new ThreatMatrixRegistry(customMatrix);
    const tamperingThreats = registry.listByCategory("TAMPERING");
    assert.equal(tamperingThreats.length, 0);
});
test("ThreatMatrixRegistry validate checks completeness", () => {
    const registry = new ThreatMatrixRegistry();
    const result = registry.validate();
    // Default matrix should have all categories
    assert.equal(result.valid, true);
    assert.equal(result.missingCategories.length, 0);
});
test("ThreatMatrixRegistry custom matrix can be incomplete", () => {
    const customMatrix = {
        version: "1.0",
        updatedAt: "2026-01-01T00:00:00.000Z",
        owner: "test",
        entries: [
            {
                threatId: "spoof_1",
                category: "SPOOFING",
                title: "Test",
                scenario: "Test",
                mitigations: [],
                implementationRefs: [],
                residualRisk: "low",
            },
        ],
    };
    const registry = new ThreatMatrixRegistry(customMatrix);
    const result = registry.validate();
    assert.equal(result.valid, false);
    assert.ok(result.missingCategories.includes("TAMPERING"));
});
test("defaultThreatMatrixRegistry is pre-configured", () => {
    assert.ok(defaultThreatMatrixRegistry instanceof ThreatMatrixRegistry);
    const matrix = defaultThreatMatrixRegistry.getMatrix();
    assert.ok(matrix.entries.length >= 6); // At least one per category
});
test("ThreatMatrixRegistry entries contain required fields from default", () => {
    const registry = new ThreatMatrixRegistry();
    const entries = registry.getMatrix().entries;
    for (const entry of entries) {
        assert.ok(entry.threatId);
        assert.ok(entry.category);
        assert.ok(entry.title);
        assert.ok(entry.scenario);
        assert.ok(Array.isArray(entry.mitigations));
        assert.ok(Array.isArray(entry.implementationRefs));
        assert.ok(entry.residualRisk);
    }
});
test("ThreatMatrixRegistry default entries cover all STRIDE categories", () => {
    const registry = new ThreatMatrixRegistry();
    const entries = registry.getMatrix().entries;
    const categories = new Set(entries.map((e) => e.category));
    for (const cat of STRIDE_CATEGORIES) {
        assert.ok(categories.has(cat), `Missing category: ${cat}`);
    }
});
test("ThreatMatrixRegistry getMatrix returns correct structure", () => {
    const registry = new ThreatMatrixRegistry();
    const matrix = registry.getMatrix();
    assert.ok(matrix.version);
    assert.ok(matrix.updatedAt);
    assert.ok(matrix.owner);
    assert.ok(Array.isArray(matrix.entries));
});
//# sourceMappingURL=index.test.js.map