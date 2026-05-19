import assert from "node:assert/strict";
import test from "node:test";
import { DataResidencyPolicyService } from "../../../../src/platform/compliance/data-residency/index.js";
// Helper to create a residency policy with defaults
function createPolicy(overrides = {}) {
    return {
        tenantId: "tenant_1",
        allowedRegions: ["us-east-1", "eu-west-1"],
        restrictedClassifications: ["confidential", "restricted"],
        allowRedactedTransfer: true,
        ...overrides,
    };
}
// Helper to create a transfer input
function createTransferInput(overrides = {}) {
    return {
        policy: createPolicy(),
        sourceRegion: "us-east-1",
        targetRegion: "eu-west-1",
        classification: "internal",
        redacted: false,
        ...overrides,
    };
}
test("decideTransfer allows same region transfer", () => {
    const service = new DataResidencyPolicyService();
    const input = createTransferInput({ sourceRegion: "us-east-1", targetRegion: "us-east-1" });
    const result = service.decideTransfer(input);
    assert.equal(result.decision, "allow");
    assert.equal(result.reason, "same_region");
    assert.equal(result.sourceRegion, "us-east-1");
    assert.equal(result.targetRegion, "us-east-1");
});
test("decideTransfer denies transfer to non-allowed region", () => {
    const service = new DataResidencyPolicyService();
    const input = createTransferInput({ targetRegion: "ap-south-1" });
    const result = service.decideTransfer(input);
    assert.equal(result.decision, "deny");
    assert.equal(result.reason, "target_region_not_allowed");
});
test("decideTransfer allows public classification to allowed region", () => {
    const service = new DataResidencyPolicyService();
    const input = createTransferInput({ classification: "public" });
    const result = service.decideTransfer(input);
    assert.equal(result.decision, "allow");
    assert.equal(result.reason, "policy_allowed");
});
test("decideTransfer allows internal classification to allowed region", () => {
    const service = new DataResidencyPolicyService();
    const input = createTransferInput({ classification: "internal" });
    const result = service.decideTransfer(input);
    assert.equal(result.decision, "allow");
    assert.equal(result.reason, "policy_allowed");
});
test("decideTransfer denies confidential classification without redaction when allowRedactedTransfer is false", () => {
    const service = new DataResidencyPolicyService();
    const input = createTransferInput({
        policy: createPolicy({ allowRedactedTransfer: false }),
        classification: "confidential",
        redacted: false,
    });
    const result = service.decideTransfer(input);
    assert.equal(result.decision, "deny");
    assert.equal(result.reason, "restricted_data_residency_block");
});
test("decideTransfer allows confidential classification with redaction when allowRedactedTransfer is true", () => {
    const service = new DataResidencyPolicyService();
    const input = createTransferInput({
        classification: "confidential",
        redacted: true,
    });
    const result = service.decideTransfer(input);
    assert.equal(result.decision, "allow");
    assert.equal(result.reason, "restricted_data_redacted");
});
test("decideTransfer requires redaction for confidential when allowRedactedTransfer is true but not redacted", () => {
    const service = new DataResidencyPolicyService();
    const input = createTransferInput({
        classification: "confidential",
        redacted: false,
    });
    const result = service.decideTransfer(input);
    assert.equal(result.decision, "require_redaction");
    assert.equal(result.reason, "restricted_data_requires_redaction");
});
test("decideTransfer denies restricted classification without redaction", () => {
    const service = new DataResidencyPolicyService();
    const input = createTransferInput({
        classification: "restricted",
        redacted: false,
    });
    const result = service.decideTransfer(input);
    assert.equal(result.decision, "require_redaction");
    assert.equal(result.reason, "restricted_data_requires_redaction");
});
test("decideTransfer allows restricted classification with redaction when allowRedactedTransfer is true", () => {
    const service = new DataResidencyPolicyService();
    const input = createTransferInput({
        classification: "restricted",
        redacted: true,
    });
    const result = service.decideTransfer(input);
    assert.equal(result.decision, "allow");
    assert.equal(result.reason, "restricted_data_redacted");
});
test("decideTransfer uses default redacted false when not provided", () => {
    const service = new DataResidencyPolicyService();
    const input = createTransferInput({
        classification: "confidential",
        // redacted is undefined
    });
    const result = service.decideTransfer(input);
    assert.equal(result.decision, "require_redaction");
});
test("decideTransfer handles empty allowedRegions", () => {
    const service = new DataResidencyPolicyService();
    const input = createTransferInput({
        policy: createPolicy({ allowedRegions: [] }),
    });
    const result = service.decideTransfer(input);
    assert.equal(result.decision, "deny");
    assert.equal(result.reason, "target_region_not_allowed");
});
test("decideTransfer handles empty restrictedClassifications", () => {
    const service = new DataResidencyPolicyService();
    const input = createTransferInput({
        policy: createPolicy({ restrictedClassifications: [] }),
        classification: "confidential",
    });
    const result = service.decideTransfer(input);
    assert.equal(result.decision, "allow");
    assert.equal(result.reason, "policy_allowed");
});
//# sourceMappingURL=data-residency.test.js.map