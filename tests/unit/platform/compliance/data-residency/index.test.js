import assert from "node:assert/strict";
import test from "node:test";
import { DataResidencyPolicyService } from "../../../../../src/platform/compliance/data-residency/index.js";
test("DataResidencyPolicyService requires redaction before restricted cross-region transfer", () => {
    const service = new DataResidencyPolicyService();
    const result = service.decideTransfer({
        policy: {
            tenantId: "tenant_a",
            allowedRegions: ["cn-shanghai", "cn-beijing"],
            restrictedClassifications: ["confidential", "restricted"],
            allowRedactedTransfer: true,
        },
        sourceRegion: "cn-shanghai",
        targetRegion: "cn-beijing",
        classification: "restricted",
    });
    assert.equal(result.decision, "require_redaction");
});
//# sourceMappingURL=index.test.js.map