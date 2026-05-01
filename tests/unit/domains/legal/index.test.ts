import assert from "node:assert/strict";
import test from "node:test";

import {
  LegalTaskTypeSchema,
  LEGAL_DOMAIN_PRESET,
  LegalDomainPreset,
  requiresLegalReview,
  LEGAL_COMPLIANCE_GUARDRAILS,
  validateLegalCompliance,
  type LegalComplianceContext,
} from "../../../../src/domains/legal/index.js";

test("LegalTaskTypeSchema accepts valid task types", () => {
  const types = ["review", "redline", "advise"] as const;
  for (const type of types) {
    const result = LegalTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("LegalTaskTypeSchema rejects invalid task types", () => {
  const result = LegalTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("LEGAL_DOMAIN_PRESET has correct structure", () => {
  assert.equal(LEGAL_DOMAIN_PRESET.domainId, "legal");
  assert.ok(Array.isArray(LEGAL_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(Array.isArray(LEGAL_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(Array.isArray(LEGAL_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Array.isArray(LEGAL_DOMAIN_PRESET.reviewRequiredTaskTypes));
});

test("LEGAL_DOMAIN_PRESET has correct required capabilities", () => {
  assert.deepEqual(LEGAL_DOMAIN_PRESET.requiredCapabilities, ["review", "redline", "advise"]);
});

test("LEGAL_DOMAIN_PRESET has correct review required task types", () => {
  assert.deepEqual(LEGAL_DOMAIN_PRESET.reviewRequiredTaskTypes, ["redline", "advise"]);
});

test("requiresLegalReview returns true for redline task type", () => {
  assert.equal(requiresLegalReview("redline"), true);
});

test("requiresLegalReview returns true for advise task type", () => {
  assert.equal(requiresLegalReview("advise"), true);
});

test("requiresLegalReview returns false for review task type", () => {
  assert.equal(requiresLegalReview("review"), false);
});

// =============================================================================
// Legal Compliance Guardrails Tests
// =============================================================================

test("LEGAL_COMPLIANCE_GUARDRAILS has required jurisdictions", () => {
  assert.deepEqual(LEGAL_COMPLIANCE_GUARDRAILS.requiredJurisdictions, ["US", "EU", "UK"]);
});

test("LEGAL_COMPLIANCE_GUARDRAILS requires privilege check", () => {
  assert.equal(LEGAL_COMPLIANCE_GUARDRAILS.privilegeCheckRequired, true);
});

test("LEGAL_COMPLIANCE_GUARDRAILS requires confidentiality check", () => {
  assert.equal(LEGAL_COMPLIANCE_GUARDRAILS.confidentialityCheckRequired, true);
});

test("LEGAL_COMPLIANCE_GUARDRAILS minimum clearance level is confidential", () => {
  assert.equal(LEGAL_COMPLIANCE_GUARDRAILS.minimumClearanceLevel, "confidential");
});

test("LEGAL_COMPLIANCE_GUARDRAILS is frozen", () => {
  assert.ok(Object.isFrozen(LEGAL_COMPLIANCE_GUARDRAILS));
  assert.ok(Object.isFrozen(LEGAL_COMPLIANCE_GUARDRAILS.requiredJurisdictions));
});

// =============================================================================
// validateLegalCompliance Tests
// =============================================================================

test("validateLegalCompliance returns true for valid compliant context", () => {
  const context: LegalComplianceContext = {
    jurisdiction: "US",
    hasPrivilege: true,
    confidentialityLevel: "confidential",
  };
  assert.equal(validateLegalCompliance(context), true);
});

test("validateLegalCompliance returns true for EU jurisdiction with restricted level", () => {
  const context: LegalComplianceContext = {
    jurisdiction: "EU",
    hasPrivilege: true,
    confidentialityLevel: "restricted",
  };
  assert.equal(validateLegalCompliance(context), true);
});

test("validateLegalCompliance returns false for unsupported jurisdiction", () => {
  const context: LegalComplianceContext = {
    jurisdiction: "XX",
    hasPrivilege: true,
    confidentialityLevel: "restricted",
  };
  assert.equal(validateLegalCompliance(context), false);
});

test("validateLegalCompliance returns false when privilege is required but not present", () => {
  const context: LegalComplianceContext = {
    jurisdiction: "US",
    hasPrivilege: false,
    confidentialityLevel: "confidential",
  };
  assert.equal(validateLegalCompliance(context), false);
});

test("validateLegalCompliance returns false when confidentiality level is too low", () => {
  const context: LegalComplianceContext = {
    jurisdiction: "US",
    hasPrivilege: true,
    confidentialityLevel: "public",
  };
  assert.equal(validateLegalCompliance(context), false);
});

test("validateLegalCompliance returns false for internal level (below confidential)", () => {
  const context: LegalComplianceContext = {
    jurisdiction: "UK",
    hasPrivilege: true,
    confidentialityLevel: "internal",
  };
  assert.equal(validateLegalCompliance(context), false);
});

test("validateLegalCompliance returns true for restricted level (above confidential)", () => {
  const context: LegalComplianceContext = {
    jurisdiction: "UK",
    hasPrivilege: true,
    confidentialityLevel: "restricted",
  };
  assert.equal(validateLegalCompliance(context), true);
});
