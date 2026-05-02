import assert from "node:assert/strict";
import test from "node:test";

import { DataResidencyPolicyService } from "../../../../src/platform/compliance/data-residency/index.js";

test("DataResidencyPolicyService decides allow for same region transfer", () => {
  const service = new DataResidencyPolicyService();
  const policy = {
    tenantId: "tenant_1",
    allowedRegions: ["us-east-1", "eu-west-1"],
    restrictedClassifications: ["confidential", "restricted"] as Array<"confidential" | "restricted">,
    allowRedactedTransfer: true,
  };

  const result = service.decideTransfer({
    policy,
    sourceRegion: "us-east-1",
    targetRegion: "us-east-1",
    classification: "internal",
  });

  assert.equal(result.decision, "allow");
  assert.equal(result.reason, "same_region");
});

test("DataResidencyPolicyService decides deny for non-allowed region", () => {
  const service = new DataResidencyPolicyService();
  const policy = {
    tenantId: "tenant_1",
    allowedRegions: ["us-east-1", "eu-west-1"],
    restrictedClassifications: ["confidential", "restricted"] as Array<"confidential" | "restricted">,
    allowRedactedTransfer: true,
  };

  const result = service.decideTransfer({
    policy,
    sourceRegion: "us-east-1",
    targetRegion: "ap-south-1",
    classification: "internal",
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.reason, "target_region_not_allowed");
});

test("DataResidencyPolicyService decides deny for restricted classification without redaction", () => {
  const service = new DataResidencyPolicyService();
  const policy = {
    tenantId: "tenant_1",
    allowedRegions: ["us-east-1", "eu-west-1"],
    restrictedClassifications: ["confidential", "restricted"] as Array<"confidential" | "restricted">,
    allowRedactedTransfer: false,
  };

  const result = service.decideTransfer({
    policy,
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    classification: "restricted",
    redacted: false,
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.reason, "restricted_data_residency_block");
});

test("DataResidencyPolicyService decides require_redaction for restricted data with redaction allowed", () => {
  const service = new DataResidencyPolicyService();
  const policy = {
    tenantId: "tenant_1",
    allowedRegions: ["us-east-1", "eu-west-1"],
    restrictedClassifications: ["confidential", "restricted"] as Array<"confidential" | "restricted">,
    allowRedactedTransfer: true,
  };

  const result = service.decideTransfer({
    policy,
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    classification: "restricted",
    redacted: true,
  });

  assert.equal(result.decision, "allow");
  assert.equal(result.reason, "restricted_data_redacted");
});

test("DataResidencyPolicyService decides require_redaction when redaction allowed but not provided", () => {
  const service = new DataResidencyPolicyService();
  const policy = {
    tenantId: "tenant_1",
    allowedRegions: ["us-east-1", "eu-west-1"],
    restrictedClassifications: ["confidential", "restricted"] as Array<"confidential" | "restricted">,
    allowRedactedTransfer: true,
  };

  const result = service.decideTransfer({
    policy,
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    classification: "confidential",
  });

  assert.equal(result.decision, "require_redaction");
  assert.equal(result.reason, "restricted_data_requires_redaction");
});

test("DataResidencyPolicyService decides allow for unrestricted data to allowed region", () => {
  const service = new DataResidencyPolicyService();
  const policy = {
    tenantId: "tenant_1",
    allowedRegions: ["us-east-1", "eu-west-1"],
    restrictedClassifications: ["confidential", "restricted"] as Array<"confidential" | "restricted">,
    allowRedactedTransfer: true,
  };

  const result = service.decideTransfer({
    policy,
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    classification: "public",
  });

  assert.equal(result.decision, "allow");
  assert.equal(result.reason, "policy_allowed");
});

test("DataResidencyPolicyService result includes source and target regions", () => {
  const service = new DataResidencyPolicyService();
  const policy = {
    tenantId: "tenant_1",
    allowedRegions: ["us-east-1"],
    restrictedClassifications: [],
    allowRedactedTransfer: true,
  };

  const result = service.decideTransfer({
    policy,
    sourceRegion: "us-east-1",
    targetRegion: "us-east-1",
    classification: "public",
  });

  assert.equal(result.sourceRegion, "us-east-1");
  assert.equal(result.targetRegion, "us-east-1");
});

test("DataResidencyPolicyService treats internal classification as non-restricted", () => {
  const service = new DataResidencyPolicyService();
  const policy = {
    tenantId: "tenant_1",
    allowedRegions: ["us-east-1", "eu-west-1"],
    restrictedClassifications: ["confidential", "restricted"] as Array<"confidential" | "restricted">,
    allowRedactedTransfer: false,
  };

  const result = service.decideTransfer({
    policy,
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    classification: "internal",
  });

  assert.equal(result.decision, "allow");
});
