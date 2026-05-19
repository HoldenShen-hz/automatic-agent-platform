import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { STRIDE_CATEGORIES, ThreatMatrixRegistry, defaultThreatMatrixRegistry, listThreatsByCategory, validateThreatMatrix, } from "../../../../../src/platform/control-plane/iam/threat-model/index.js";
test("STRIDE framework exposes six canonical categories", () => {
    assert.deepEqual(STRIDE_CATEGORIES, [
        "SPOOFING",
        "TAMPERING",
        "REPUDIATION",
        "INFORMATION_DISCLOSURE",
        "DENIAL_OF_SERVICE",
        "ELEVATION_OF_PRIVILEGE",
    ]);
});
test("default threat matrix registry covers all STRIDE categories", () => {
    const matrix = defaultThreatMatrixRegistry.getMatrix();
    const validation = validateThreatMatrix(matrix);
    assert.equal(validation.valid, true);
    assert.deepEqual(validation.missingCategories, []);
    assert.equal(matrix.entries.length, 6);
});
test("ThreatMatrixRegistry lists category-specific threats", () => {
    const registry = new ThreatMatrixRegistry();
    const threats = registry.listByCategory("INFORMATION_DISCLOSURE");
    assert.equal(threats.length, 1);
    assert.ok(threats[0]?.implementationRefs.some((ref) => ref.includes("field-encryption.ts")));
});
test("listThreatsByCategory mirrors registry matrix behavior", () => {
    const matrix = defaultThreatMatrixRegistry.getMatrix();
    const threats = listThreatsByCategory(matrix, "DENIAL_OF_SERVICE");
    assert.equal(threats.length, 1);
    assert.equal(threats[0]?.category, "DENIAL_OF_SERVICE");
});
test("security threat inventory file documents all STRIDE dimensions", () => {
    const file = JSON.parse(readFileSync("/Users/holden/Project/automatic_agent/automatic_agent_platform/config/security/threat-matrix.json", "utf8"));
    for (const category of STRIDE_CATEGORIES) {
        assert.ok(category in file.dimensions);
    }
});
//# sourceMappingURL=stride-framework.test.js.map