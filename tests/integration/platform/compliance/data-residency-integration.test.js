import assert from "node:assert/strict";
import test from "node:test";

import { DataResidencyPolicyService } from "../../../../src/platform/compliance/data-residency/index.js";

test("DataResidencyPolicyService allows same-region transfer regardless of classification", () => {
  const service = new DataResidencyPolicyService();

  const result = service.decideTransfer({
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["us-east-1", "eu-west-1"],
      restrictedClassifications: ["confidential", "restricted"],
      allowRedactedTransfer: true,
    },
    sourceRegion: "us-east-1",
    targetRegion: "us-east-1",
    classification: "restricted",
  });

  assert.equal(result.decision, "allow");
  assert.equal(result.reason, "same_region");
});

test("DataResidencyPolicyService denies transfer to non-allowed region", () => {
  const service = new DataResidencyPolicyService();

  const result = service.decideTransfer({
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["us-east-1", "eu-west-1"],
      restrictedClassifications: ["confidential", "restricted"],
      allowRedactedTransfer: true,
    },
    sourceRegion: "us-east-1",
    targetRegion: "ap-southeast-1",
    classification: "public",
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.reason, "target_region_not_allowed");
});

test("DataResidencyPolicyService denies restricted classification to non-allowed region", () => {
  const service = new DataResidencyPolicyService();

  const result = service.decideTransfer({
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["us-east-1"],
      restrictedClassifications: ["confidential", "restricted"],
      allowRedactedTransfer: false,
    },
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    classification: "restricted",
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.reason, "restricted_data_residency_block");
});

test("DataResidencyPolicyService allows redacted restricted data when policy permits", () => {
  const service = new DataResidencyPolicyService();

  const result = service.decideTransfer({
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["eu-west-1"],
      restrictedClassifications: ["confidential", "restricted"],
      allowRedactedTransfer: true,
    },
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    classification: "restricted",
    redacted: true,
  });

  assert.equal(result.decision, "allow");
  assert.equal(result.reason, "restricted_data_redacted");
});

test("DataResidencyPolicyService requires redaction for restricted data when allowRedactedTransfer is true", () => {
  const service = new DataResidencyPolicyService();

  const result = service.decideTransfer({
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["eu-west-1"],
      restrictedClassifications: ["confidential", "restricted"],
      allowRedactedTransfer: true,
    },
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    classification: "restricted",
    redacted: false,
  });

  assert.equal(result.decision, "require_redaction");
  assert.equal(result.reason, "restricted_data_requires_redaction");
});

test("DataResidencyPolicyService denies confidential classification to non-allowed region", () => {
  const service = new DataResidencyPolicyService();

  const result = service.decideTransfer({
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["us-east-1"],
      restrictedClassifications: ["confidential", "restricted"],
      allowRedactedTransfer: true,
    },
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    classification: "confidential",
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.reason, "restricted_data_residency_block");
});

test("DataResidencyPolicyService allows public content to allowed regions", () => {
  const service = new DataResidencyPolicyService();

  const result = service.decideTransfer({
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["us-east-1", "eu-west-1"],
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

test("DataResidencyPolicyService allows internal content to allowed regions", () => {
  const service = new DataResidencyPolicyService();

  const result = service.decideTransfer({
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["us-east-1", "eu-west-1"],
      restrictedClassifications: ["confidential", "restricted"],
      allowRedactedTransfer: false,
    },
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    classification: "internal",
  });

  assert.equal(result.decision, "allow");
  assert.equal(result.reason, "policy_allowed");
});

test("DataResidencyPolicyService result contains correct region information", () => {
  const service = new DataResidencyPolicyService();

  const result = service.decideTransfer({
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["eu-west-1"],
      restrictedClassifications: ["confidential", "restricted"],
      allowRedactedTransfer: true,
    },
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    classification: "public",
  });

  assert.equal(result.sourceRegion, "us-east-1");
  assert.equal(result.targetRegion, "eu-west-1");
});

test("DataResidencyPolicyService with empty restricted classifications allows all levels", () => {
  const service = new DataResidencyPolicyService();

  const result = service.decideTransfer({
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["eu-west-1"],
      restrictedClassifications: [],
      allowRedactedTransfer: false,
    },
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    classification: "restricted",
  });

  assert.equal(result.decision, "allow");
  assert.equal(result.reason, "policy_allowed");
});

test("DataResidencyPolicyService treats non-redacted as requiring redaction when allowRedactedTransfer is true", () => {
  const service = new DataResidencyPolicyService();

  const result = service.decideTransfer({
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["eu-west-1"],
      restrictedClassifications: ["confidential"],
      allowRedactedTransfer: true,
    },
    sourceRegion: "us-east-1",
    targetRegion: "eu-west-1",
    classification: "confidential",
    redacted: undefined, // Not provided
  });

  assert.equal(result.decision, "require_redaction");
});

test("DataResidencyPolicyService result reason is consistent for same-region transfers", () => {
  const service = new DataResidencyPolicyService();

  const result1 = service.decideTransfer({
    policy: {
      tenantId: "tenant-001",
      allowedRegions: ["us-east-1"],
      restrictedClassifications: ["restricted"],
      allowRedactedTransfer: false,
    },
    sourceRegion: "us-east-1",
    targetRegion: "us-east-1",
    classification: "restricted",
  });

  const result2 = service.decideTransfer({
    policy: {
      tenantId: "tenant-002",
      allowedRegions: ["us-east-1"],
      restrictedClassifications: ["restricted"],
      allowRedactedTransfer: false,
    },
    sourceRegion: "us-east-1",
    targetRegion: "us-east-1",
    classification: "public",
  });

  assert.equal(result1.decision, "allow");
  assert.equal(result2.decision, "allow");
  assert.equal(result1.reason, "same_region");
  assert.equal(result2.reason, "same_region");
});
