import assert from "node:assert/strict";
import test from "node:test";
import { ComplianceCaseOrchestrationService, DataLineageService, DataResidencyPolicyService, ErasurePlanningService, FieldEncryptionService, } from "../../../../src/platform/compliance/index.js";
test("platform compliance barrel exposes orchestration and support services", () => {
    assert.equal(typeof ComplianceCaseOrchestrationService, "function");
    assert.equal(typeof DataResidencyPolicyService, "function");
    assert.equal(typeof FieldEncryptionService, "function");
    assert.equal(typeof ErasurePlanningService, "function");
    assert.equal(typeof DataLineageService, "function");
});
//# sourceMappingURL=index.test.js.map