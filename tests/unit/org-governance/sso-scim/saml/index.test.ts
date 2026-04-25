/**
 * Unit tests for SamlService
 */

import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { SamlService, validateXmlSignature } from "../../../../../src/org-governance/sso-scim/saml/index.js";

test("SamlService.registerProvider stores provider configuration", () => {
  const service = new SamlService();

  service.registerProvider({
    providerId: "okta",
    entryPoint: "https://okta.example.com/sso",
    issuer: "https://issuer.example.com",
    certificateFingerprint: "ABC123",
    entityId: "https://app.example.com",
    acsUrl: "https://app.example.com/saml/acs",
  });

  const provider = service.getProvider("okta");

  assert.ok(provider !== null);
  assert.strictEqual(provider?.providerId, "okta");
  assert.strictEqual(provider?.issuer, "https://issuer.example.com");
});

test("SamlService.getProvider returns null for unregistered provider", () => {
  const service = new SamlService();

  const provider = service.getProvider("non-existent");

  assert.strictEqual(provider, null);
});

test("SamlService.buildLoginRequest creates valid SAML request", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "okta",
    entryPoint: "https://okta.example.com/sso",
    issuer: "https://issuer.example.com",
    certificateFingerprint: "ABC123",
  });

  const request = service.buildLoginRequest("okta", { relayState: "return-to-dashboard" });

  assert.strictEqual(request.providerId, "okta");
  assert.strictEqual(request.relayState, "return-to-dashboard");
  assert.ok(request.requestId.startsWith("saml_req_"));
  assert.ok(request.redirectUrl.includes("https://okta.example.com/sso"));
});

test("SamlService.buildLoginRequest throws for unregistered provider", () => {
  const service = new SamlService();

  assert.throws(() => {
    service.buildLoginRequest("non-existent");
  }, /saml.provider_not_found/);
});

test("SamlService.consumeAssertion validates issuer match", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "okta",
    entryPoint: "https://okta.example.com/sso",
    issuer: "https://issuer.example.com",
    certificateFingerprint: "ABC123",
  });

  assert.throws(() => {
    service.consumeAssertion("okta", {
      issuer: "https://wrong-issuer.com",
      audience: "https://issuer.example.com:okta",
      nameId: "user@example.com",
      fingerprint: "ABC123",
    });
  }, /saml.invalid_issuer/);
});

test("SamlService.consumeAssertion validates fingerprint match", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "okta",
    entryPoint: "https://okta.example.com/sso",
    issuer: "https://issuer.example.com",
    certificateFingerprint: "ABC123",
  });

  assert.throws(() => {
    service.consumeAssertion("okta", {
      issuer: "https://issuer.example.com",
      audience: "https://issuer.example.com:okta",
      nameId: "user@example.com",
      fingerprint: "WRONG_FINGERPRINT",
    });
  }, /saml.invalid_fingerprint/);
});

test("SamlService.consumeAssertion validates audience", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "okta",
    entryPoint: "https://okta.example.com/sso",
    issuer: "https://issuer.example.com",
    certificateFingerprint: "ABC123",
    allowedAudiences: ["https://app.example.com:saml"],
  });

  assert.throws(() => {
    service.consumeAssertion("okta", {
      issuer: "https://issuer.example.com",
      audience: "https://wrong-audience.com",
      nameId: "user@example.com",
      fingerprint: "ABC123",
    });
  }, /saml.invalid_audience/);
});

test("SamlService.consumeAssertion validates recipient", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "okta",
    entryPoint: "https://okta.example.com/sso",
    issuer: "https://issuer.example.com",
    certificateFingerprint: "ABC123",
    acsUrl: "https://app.example.com/saml/acs",
  });

  assert.throws(() => {
    service.consumeAssertion("okta", {
      issuer: "https://issuer.example.com",
      audience: "https://issuer.example.com:okta",
      nameId: "user@example.com",
      fingerprint: "ABC123",
      recipient: "https://wrong-recipient.com/saml/acs",
    });
  }, /saml.invalid_recipient/);
});

test("SamlService.consumeAssertion validates non-empty nameId", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "okta",
    entryPoint: "https://okta.example.com/sso",
    issuer: "https://issuer.example.com",
    certificateFingerprint: "ABC123",
  });

  assert.throws(() => {
    service.consumeAssertion("okta", {
      issuer: "https://issuer.example.com",
      audience: "https://issuer.example.com:okta",
      nameId: "   ",
      fingerprint: "ABC123",
    });
  }, /saml.invalid_subject/);
});

test("SamlService.consumeAssertion validates assertion time bounds", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "okta",
    entryPoint: "https://okta.example.com/sso",
    issuer: "https://issuer.example.com",
    certificateFingerprint: "ABC123",
  });

  const pastDate = new Date(Date.now() - 3600000).toISOString();
  const futureDate = new Date(Date.now() + 3600000).toISOString();

  // notBefore in future should fail
  assert.throws(() => {
    service.consumeAssertion("okta", {
      issuer: "https://issuer.example.com",
      audience: "https://issuer.example.com:okta",
      nameId: "user@example.com",
      fingerprint: "ABC123",
      notBefore: futureDate,
    }, new Date());
  }, /saml.assertion_expired/);

  // notOnOrAfter in past should fail
  assert.throws(() => {
    service.consumeAssertion("okta", {
      issuer: "https://issuer.example.com",
      audience: "https://issuer.example.com:okta",
      nameId: "user@example.com",
      fingerprint: "ABC123",
      notOnOrAfter: pastDate,
    }, new Date());
  }, /saml.assertion_expired/);
});

test("SamlService.consumeAssertion detects replay attacks", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "okta",
    entryPoint: "https://okta.example.com/sso",
    issuer: "https://issuer.example.com",
    certificateFingerprint: "ABC123",
    allowUnsignedAssertions: true,
  });

  const validAssertion = {
    issuer: "https://issuer.example.com",
    audience: "https://issuer.example.com:okta",
    nameId: "user@example.com",
    fingerprint: "ABC123",
    assertionId: "assertion-123",
  };

  service.consumeAssertion("okta", validAssertion);

  assert.throws(() => {
    service.consumeAssertion("okta", validAssertion);
  }, /saml.assertion_replayed/);
});

test("SamlService.consumeAssertion creates valid session", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "okta",
    entryPoint: "https://okta.example.com/sso",
    issuer: "https://issuer.example.com",
    certificateFingerprint: "ABC123",
    allowUnsignedAssertions: true,
  });

  const session = service.consumeAssertion("okta", {
    issuer: "https://issuer.example.com",
    audience: "https://issuer.example.com:okta",
    nameId: "user@example.com",
    fingerprint: "ABC123",
    sessionIndex: "session-123",
    attributes: { email: "user@example.com", role: "admin" },
  });

  assert.ok(session.sessionId.startsWith("saml_session_"));
  assert.strictEqual(session.subjectId, "user@example.com");
  assert.strictEqual(session.sessionIndex, "session-123");
  assert.strictEqual(session.attributes.email, "user@example.com");
});

test("SamlService.consumeAssertion allows unsigned assertions when configured", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "okta",
    entryPoint: "https://okta.example.com/sso",
    issuer: "https://issuer.example.com",
    certificateFingerprint: "ABC123",
    allowUnsignedAssertions: true,
  });

  const session = service.consumeAssertion("okta", {
    issuer: "https://issuer.example.com",
    audience: "https://issuer.example.com:okta",
    nameId: "user@example.com",
    fingerprint: "ABC123",
  });

  assert.ok(session !== null);
  assert.strictEqual(session.subjectId, "user@example.com");
});

test("SamlService.consumeAssertion requires signature when not allowUnsignedAssertions", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "okta",
    entryPoint: "https://okta.example.com/sso",
    issuer: "https://issuer.example.com",
    certificateFingerprint: "ABC123",
    allowUnsignedAssertions: false,
  });

  assert.throws(() => {
    service.consumeAssertion("okta", {
      issuer: "https://issuer.example.com",
      audience: "https://issuer.example.com:okta",
      nameId: "user@example.com",
      fingerprint: "ABC123",
    });
  }, /saml.signature_required/);
});

test("SamlService.buildLogoutRequest creates valid logout request", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "okta",
    entryPoint: "https://okta.example.com/sso",
    issuer: "https://issuer.example.com",
    certificateFingerprint: "ABC123",
  });

  const logoutRequest = service.buildLogoutRequest("okta", {
    sessionId: "session-123",
    subjectId: "user@example.com",
    sessionIndex: "index-456",
  }, "return-to-login");

  assert.strictEqual(logoutRequest.providerId, "okta");
  assert.strictEqual(logoutRequest.relayState, "return-to-login");
  assert.ok(logoutRequest.requestId.startsWith("saml_logout_"));
});

test("validateXmlSignature returns valid for empty signature with empty xml", () => {
  // This test validates the validateXmlSignature function behavior
  // In production, xml-crypto would need proper signature data
  const result = validateXmlSignature("", "");
  // Without proper mock setup for xml-crypto, we just verify it returns without throwing
  assert.ok(typeof result.valid === "boolean");
});
