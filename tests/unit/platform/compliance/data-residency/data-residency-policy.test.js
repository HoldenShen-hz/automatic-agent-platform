import assert from "node:assert/strict";
import test from "node:test";
import { DataResidencyPolicyService } from "../../../../../src/platform/compliance/data-residency/index.js";
test("DataResidencyPolicyService decidesTransfer allows same region transfers", () => {
    const service = new DataResidencyPolicyService();
    const result = service.decideTransfer({
        policy: {
            tenantId: "tenant_a",
            allowedRegions: ["us-east-1", "us-west-2"],
            restrictedClassifications: ["confidential", "restricted"],
            allowRedactedTransfer: false,
        },
        sourceRegion: "us-east-1",
        targetRegion: "us-east-1",
        classification: "public",
    });
    assert.equal(result.decision, "allow");
    assert.equal(result.reason, "same_region");
});
test("DataResidencyPolicyService denies transfer to non-allowed region", () => {
    const service = new DataResidencyPolicyService();
    const result = service.decideTransfer({
        policy: {
            tenantId: "tenant_a",
            allowedRegions: ["us-east-1", "us-west-2"],
            restrictedClassifications: ["confidential", "restricted"],
            allowRedactedTransfer: false,
        },
        sourceRegion: "us-east-1",
        targetRegion: "eu-west-1",
        classification: "public",
    });
    assert.equal(result.decision, "deny");
    assert.equal(result.reason, "target_region_not_allowed");
});
test("DataResidencyPolicyService denies internal classification to non-allowed region", () => {
    const service = new DataResidencyPolicyService();
    const result = service.decideTransfer({
        policy: {
            tenantId: "tenant_a",
            allowedRegions: ["us-east-1", "us-west-2"],
            restrictedClassifications: ["confidential", "restricted"],
            allowRedactedTransfer: false,
        },
        sourceRegion: "us-east-1",
        targetRegion: "eu-west-1",
        classification: "internal",
    });
    // cross-region transfer to non-allowed region is denied regardless of classification
    // restrictedClassifications only affects transfers within allowed regions
    assert.equal(result.decision, "deny");
    assert.equal(result.reason, "target_region_not_allowed");
});
test("DataResidencyPolicyService allows internal classification to allowed region", () => {
    const service = new DataResidencyPolicyService();
    const result = service.decideTransfer({
        policy: {
            tenantId: "tenant_a",
            allowedRegions: ["us-east-1", "us-west-2", "eu-west-1"],
            restrictedClassifications: ["confidential", "restricted"],
            allowRedactedTransfer: false,
        },
        sourceRegion: "us-east-1",
        targetRegion: "eu-west-1",
        classification: "internal",
    });
    // internal is not in restrictedClassifications, so it's allowed to allowed regions
    assert.equal(result.decision, "allow");
    assert.equal(result.reason, "policy_allowed");
});
test("DataResidencyPolicyService denies confidential classification without redaction", () => {
    const service = new DataResidencyPolicyService();
    const result = service.decideTransfer({
        policy: {
            tenantId: "tenant_a",
            allowedRegions: ["us-east-1", "us-west-2"],
            restrictedClassifications: ["confidential", "restricted"],
            allowRedactedTransfer: false,
        },
        sourceRegion: "us-east-1",
        targetRegion: "us-west-2",
        classification: "confidential",
    });
    assert.equal(result.decision, "deny");
    assert.equal(result.reason, "restricted_data_residency_block");
});
test("DataResidencyPolicyService allows confidential classification with redaction when allowed", () => {
    const service = new DataResidencyPolicyService();
    const result = service.decideTransfer({
        policy: {
            tenantId: "tenant_a",
            allowedRegions: ["us-east-1", "us-west-2"],
            restrictedClassifications: ["confidential", "restricted"],
            allowRedactedTransfer: true,
        },
        sourceRegion: "us-east-1",
        targetRegion: "us-west-2",
        classification: "confidential",
        redacted: true,
    });
    assert.equal(result.decision, "allow");
    assert.equal(result.reason, "restricted_data_redacted");
});
test("DataResidencyPolicyService requires redaction for confidential without redaction when allowed", () => {
    const service = new DataResidencyPolicyService();
    const result = service.decideTransfer({
        policy: {
            tenantId: "tenant_a",
            allowedRegions: ["us-east-1", "us-west-2"],
            restrictedClassifications: ["confidential", "restricted"],
            allowRedactedTransfer: true,
        },
        sourceRegion: "us-east-1",
        targetRegion: "us-west-2",
        classification: "confidential",
        redacted: false,
    });
    assert.equal(result.decision, "require_redaction");
    assert.equal(result.reason, "restricted_data_requires_redaction");
});
test("DataResidencyPolicyService denies restricted classification cross-region", () => {
    const service = new DataResidencyPolicyService();
    const result = service.decideTransfer({
        policy: {
            tenantId: "tenant_a",
            allowedRegions: ["us-east-1", "us-west-2"],
            restrictedClassifications: ["confidential", "restricted"],
            allowRedactedTransfer: true,
        },
        sourceRegion: "us-east-1",
        targetRegion: "us-west-2",
        classification: "restricted",
    });
    assert.equal(result.decision, "require_redaction");
});
test("DataResidencyPolicyService allows restricted with redaction when policy allows", () => {
    const service = new DataResidencyPolicyService();
    const result = service.decideTransfer({
        policy: {
            tenantId: "tenant_a",
            allowedRegions: ["us-east-1", "us-west-2"],
            restrictedClassifications: ["confidential", "restricted"],
            allowRedactedTransfer: true,
        },
        sourceRegion: "us-east-1",
        targetRegion: "us-west-2",
        classification: "restricted",
        redacted: true,
    });
    assert.equal(result.decision, "allow");
    assert.equal(result.reason, "restricted_data_redacted");
});
test("DataResidencyPolicyService result includes source and target regions", () => {
    const service = new DataResidencyPolicyService();
    const result = service.decideTransfer({
        policy: {
            tenantId: "tenant_a",
            allowedRegions: ["us-east-1", "us-west-2"],
            restrictedClassifications: ["confidential"],
            allowRedactedTransfer: false,
        },
        sourceRegion: "us-east-1",
        targetRegion: "us-west-2",
        classification: "internal",
    });
    assert.equal(result.sourceRegion, "us-east-1");
    assert.equal(result.targetRegion, "us-west-2");
});
test("DataResidencyPolicyService allows public classification cross-region", () => {
    const service = new DataResidencyPolicyService();
    const result = service.decideTransfer({
        policy: {
            tenantId: "tenant_a",
            allowedRegions: ["us-east-1", "us-west-2", "eu-west-1"],
            restrictedClassifications: ["confidential", "restricted"],
            allowRedactedTransfer: false,
        },
        sourceRegion: "us-east-1",
        targetRegion: "eu-west-1",
        classification: "public",
    });
    assert.equal(result.decision, "allow");
    assert.equal(result.reason, "policy_allowed");
});
test("DataResidencyPolicyService handles empty allowed regions", () => {
    const service = new DataResidencyPolicyService();
    const result = service.decideTransfer({
        policy: {
            tenantId: "tenant_a",
            allowedRegions: [],
            restrictedClassifications: [],
            allowRedactedTransfer: false,
        },
        sourceRegion: "us-east-1",
        targetRegion: "us-west-2",
        classification: "public",
    });
    // All cross-region transfers denied when region not in allowed list
    assert.equal(result.decision, "deny");
});
test("DataResidencyPolicyService handles empty restricted classifications", () => {
    const service = new DataResidencyPolicyService();
    const result = service.decideTransfer({
        policy: {
            tenantId: "tenant_a",
            allowedRegions: ["us-east-1", "us-west-2"],
            restrictedClassifications: [],
            allowRedactedTransfer: false,
        },
        sourceRegion: "us-east-1",
        targetRegion: "us-west-2",
        classification: "confidential",
    });
    // No restricted classifications means confidential is allowed
    assert.equal(result.decision, "allow");
});
//# sourceMappingURL=data-residency-policy.test.js.map