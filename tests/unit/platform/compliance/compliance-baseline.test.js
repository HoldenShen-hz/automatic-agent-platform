import assert from "node:assert/strict";
import test from "node:test";
import * as cryptoShredding from "../../../../src/platform/compliance/crypto-shredding/index.js";
import * as dataResidency from "../../../../src/platform/compliance/data-residency/index.js";
import * as encryption from "../../../../src/platform/compliance/encryption/index.js";
import { listComplianceCapabilityBaselines, resolveComplianceCapabilityBaseline, } from "../../../../src/platform/compliance/compliance-baseline.js";
import * as erasure from "../../../../src/platform/compliance/erasure/index.js";
import * as lineage from "../../../../src/platform/compliance/lineage/index.js";
test("compliance baseline covers canonical data-governance services", () => {
    const baselines = listComplianceCapabilityBaselines();
    assert.deepEqual(baselines.map((item) => item.capabilityId), ["crypto-shredding", "data-residency", "encryption", "erasure", "lineage"]);
    assert.equal(resolveComplianceCapabilityBaseline("lineage").entryModule, "src/platform/compliance/lineage/index.ts");
});
test("compliance baseline service names resolve from canonical submodule exports", () => {
    const exportsByCapabilityId = {
        "crypto-shredding": cryptoShredding,
        "data-residency": dataResidency,
        encryption,
        erasure,
        lineage,
    };
    for (const baseline of listComplianceCapabilityBaselines()) {
        const exportedModule = exportsByCapabilityId[baseline.capabilityId];
        for (const serviceName of baseline.baselineServices) {
            assert.equal(serviceName in exportedModule, true, `expected ${serviceName} to be exported by ${baseline.entryModule}`);
        }
    }
});
//# sourceMappingURL=compliance-baseline.test.js.map