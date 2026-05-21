/**
 * Comprehensive Tests: SAML Index Module
 *
 * Tests SAMLProviderConfigSchema validation, buildSamlAudience,
 * and SAML signature constants.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  SamlProviderConfigSchema,
  buildSamlAudience,
  SAML_SIGNATURE_ALGORITHMS,
  type SamlProviderConfig,
} from "../../../../../src/org-governance/sso-scim/saml/index.js";

function createValidProvider(): SamlProviderConfig {
  return {
    providerId: "test-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC:DD:EE:FF",
    entityId: "https://app.example.com/saml/metadata",
    acsUrl: "https://app.example.com/saml/acs",
    allowedAudiences: ["https://app.example.com:saml"],
    allowUnsignedAssertions: false,
    allowIdpInitiated: false,
    unsafeAllowUnsignedAssertionsReason: "test reason",
    attributeMapping: { email: "mail", name: "displayName" },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SamlProviderConfigSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("SamlProviderConfigSchema parses valid complete config", () => {
  const result = SamlProviderConfigSchema.safeParse(createValidProvider());
  assert.equal(result.success, true);
});

test("SamlProviderConfigSchema parses minimal config without optional fields", () => {
  const minimal: SamlProviderConfig = {
    providerId: "minimal-idp",
    entryPoint: "https://idp.example.com/saml",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
  };

  const result = SamlProviderConfigSchema.safeParse(minimal);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.providerId, "minimal-idp");
    assert.equal(result.data.allowUnsignedAssertions, false);
    assert.equal(result.data.allowIdpInitiated, false);
  }
});

test("SamlProviderConfigSchema rejects empty providerId", () => {
  const config = { ...createValidProvider(), providerId: "" };
  const result = SamlProviderConfigSchema.safeParse(config);
  assert.equal(result.success, false);
});

test("SamlProviderConfigSchema rejects empty entryPoint", () => {
  const config = { ...createValidProvider(), entryPoint: "" };
  const result = SamlProviderConfigSchema.safeParse(config);
  assert.equal(result.success, false);
});

test("SamlProviderConfigSchema rejects empty issuer", () => {
  const config = { ...createValidProvider(), issuer: "" };
  const result = SamlProviderConfigSchema.safeParse(config);
  assert.equal(result.success, false);
});

test("SamlProviderConfigSchema rejects empty certificateFingerprint", () => {
  const config = { ...createValidProvider(), certificateFingerprint: "" };
  const result = SamlProviderConfigSchema.safeParse(config);
  assert.equal(result.success, false);
});

test("SamlProviderConfigSchema accepts optional entityId", () => {
  const config: SamlProviderConfig = {
    providerId: "test-idp",
    entryPoint: "https://idp.example.com/saml",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    entityId: "https://custom-entity.com",
  };

  const result = SamlProviderConfigSchema.safeParse(config);
  assert.equal(result.success, true);
});

test("SamlProviderConfigSchema accepts optional acsUrl", () => {
  const config: SamlProviderConfig = {
    providerId: "test-idp",
    entryPoint: "https://idp.example.com/saml",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    acsUrl: "https://custom-acs.example.com/saml/acs",
  };

  const result = SamlProviderConfigSchema.safeParse(config);
  assert.equal(result.success, true);
});

test("SamlProviderConfigSchema accepts optional allowedAudiences array", () => {
  const config: SamlProviderConfig = {
    providerId: "test-idp",
    entryPoint: "https://idp.example.com/saml",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowedAudiences: ["audience1", "audience2"],
  };

  const result = SamlProviderConfigSchema.safeParse(config);
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.allowedAudiences, ["audience1", "audience2"]);
  }
});

test("SamlProviderConfigSchema rejects allowUnsignedAssertions without reason", () => {
  const config = {
    ...createValidProvider(),
    allowUnsignedAssertions: true,
    unsafeAllowUnsignedAssertionsReason: undefined,
  };

  const result = SamlProviderConfigSchema.safeParse(config);
  assert.equal(result.success, false);
});

test("SamlProviderConfigSchema accepts allowUnsignedAssertions with sufficient reason", () => {
  const config = {
    ...createValidProvider(),
    allowUnsignedAssertions: true,
    unsafeAllowUnsignedAssertionsReason: "Testing environment only - not for production use",
  };

  const result = SamlProviderConfigSchema.safeParse(config);
  assert.equal(result.success, true);
});

test("SamlProviderConfigSchema rejects allowUnsignedAssertions with short reason", () => {
  const config = {
    ...createValidProvider(),
    allowUnsignedAssertions: true,
    unsafeAllowUnsignedAssertionsReason: "short", // Less than 8 characters
  };

  const result = SamlProviderConfigSchema.safeParse(config);
  assert.equal(result.success, false);
});

test("SamlProviderConfigSchema accepts optional attributeMapping", () => {
  const config: SamlProviderConfig = {
    providerId: "test-idp",
    entryPoint: "https://idp.example.com/saml",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    attributeMapping: { email: "mail", name: "cn", role: "memberOf" },
  };

  const result = SamlProviderConfigSchema.safeParse(config);
  assert.equal(result.success, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// buildSamlAudience Tests
// ─────────────────────────────────────────────────────────────────────────────

test("buildSamlAudience constructs audience from issuer and providerId", () => {
  const provider = createValidProvider();
  const audience = buildSamlAudience(provider);

  assert.equal(audience, "https://idp.example.com:test-idp");
});

test("buildSamlAudience works with minimal provider", () => {
  const provider: SamlProviderConfig = {
    providerId: "minimal",
    entryPoint: "https://idp.example.com/saml",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
  };

  const audience = buildSamlAudience(provider);

  assert.equal(audience, "https://idp.example.com:minimal");
});

test("buildSamlAudience handles different issuer formats", () => {
  const provider: SamlProviderConfig = {
    providerId: "test",
    entryPoint: "https://idp.test.co.uk/saml",
    issuer: "https://idp.test.co.uk",
    certificateFingerprint: "AA:BB:CC",
  };

  const audience = buildSamlAudience(provider);

  assert.equal(audience, "https://idp.test.co.uk:test");
});

test("buildSamlAudience with special characters in issuer", () => {
  const provider: SamlProviderConfig = {
    providerId: "special-idp",
    entryPoint: "https://idp.example.com/saml",
    issuer: "https://idp.example.com:8443",
    certificateFingerprint: "AA:BB:CC",
  };

  const audience = buildSamlAudience(provider);

  assert.equal(audience, "https://idp.example.com:8443:special-idp");
});

// ─────────────────────────────────────────────────────────────────────────────
// SAML_SIGNATURE_ALGORITHMS Tests
// ─────────────────────────────────────────────────────────────────────────────

test("SAML_SIGNATURE_ALGORITHMS contains exactly one algorithm", () => {
  assert.equal(SAML_SIGNATURE_ALGORITHMS.length, 1);
});

test("SAML_SIGNATURE_ALGORITHMS contains rsa-sha256", () => {
  assert.ok(SAML_SIGNATURE_ALGORITHMS.includes("http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"));
});

test("SAML_SIGNATURE_ALGORITHMS is readonly tuple", () => {
  // This tests the type-level readonly tuple
  const algorithms: readonly string[] = SAML_SIGNATURE_ALGORITHMS;
  assert.ok(Array.isArray(algorithms));
});

// ─────────────────────────────────────────────────────────────────────────────
// Type Inference Tests
// ─────────────────────────────────────────────────────────────────────────────

test("SamlProviderConfig type correctly infers from schema", () => {
  const config: SamlProviderConfig = {
    providerId: "typed-idp",
    entryPoint: "https://idp.example.com/saml",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
    allowIdpInitiated: false,
  };

  assert.equal(config.providerId, "typed-idp");
  assert.equal(config.allowUnsignedAssertions, false);
  assert.equal(config.allowIdpInitiated, false);
});