import assert from "node:assert/strict";
import test from "node:test";

import {
  SamlService,
  SamlProviderConfigSchema,
  buildSamlAudience,
  validateXmlSignature,
  type SamlProviderConfig,
  type SamlAssertionInput,
} from "../../../../src/org-governance/sso-scim/saml/index.js";

function createTestProvider(overrides: Partial<SamlProviderConfig> = {}): SamlProviderConfig {
  const providerId = overrides.providerId ?? "test-idp";
  const issuer = overrides.issuer ?? "https://idp.example.com";
  const allowUnsignedAssertions = overrides.allowUnsignedAssertions ?? true;
  return {
    providerId,
    entryPoint: "https://idp.example.com/saml/login",
    issuer,
    certificateFingerprint: "AA:BB:CC:DD:EE",
    entityId: "https://app.example.com/saml/metadata",
    acsUrl: "https://app.example.com/saml/acs",
    allowedAudiences: overrides.allowedAudiences ?? [`${issuer}:${providerId}`],
    allowUnsignedAssertions,
    allowIdpInitiated: overrides.allowIdpInitiated ?? true,
    ...(allowUnsignedAssertions ? { unsafeAllowUnsignedAssertionsReason: "test coverage for unsigned assertions" } : {}),
    attributeMapping: { email: "mail", name: "displayName" },
    ...overrides,
  };
}

test("SamlProviderConfigSchema validates required fields", () => {
  const valid = {
    providerId: "provider-1",
    entryPoint: "https://idp.example.com/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    entityId: "https://app.example.com",
  };

  const result = SamlProviderConfigSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("SamlProviderConfigSchema rejects missing required fields", () => {
  const invalid = {
    providerId: "",
    entryPoint: "",
    issuer: "",
    certificateFingerprint: "",
  };

  const result = SamlProviderConfigSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("SamlService registers and retrieves provider configuration", () => {
  const service = new SamlService();
  const provider = createTestProvider({ providerId: "acme-idp" });

  service.registerProvider(provider);

  const retrieved = service.getProvider("acme-idp");
  assert.ok(retrieved);
  assert.equal(retrieved!.providerId, "acme-idp");
  assert.equal(retrieved!.issuer, provider.issuer);
  assert.equal(retrieved!.certificateFingerprint, provider.certificateFingerprint);
});

test("SamlService returns null for non-existent provider", () => {
  const service = new SamlService();

  const retrieved = service.getProvider("non-existent");
  assert.equal(retrieved, null);
});

test("SamlService builds login request with default values", () => {
  const service = new SamlService();
  service.registerProvider(createTestProvider());

  const request = service.buildLoginRequest("test-idp");

  assert.equal(request.providerId, "test-idp");
  assert.ok(request.requestId.startsWith("saml_req_"));
  assert.ok(request.redirectUrl.startsWith("https://idp.example.com/saml/login?"));
  assert.ok(request.audience.includes("https://idp.example.com"));
  assert.equal(request.relayState, null);
});

test("SamlService builds login request with custom request ID", () => {
  const service = new SamlService();
  service.registerProvider(createTestProvider());

  const request = service.buildLoginRequest("test-idp", { requestId: "custom-req-123" });

  assert.equal(request.requestId, "custom-req-123");
});

test("SamlService builds login request with relay state", () => {
  const service = new SamlService();
  service.registerProvider(createTestProvider());

  const request = service.buildLoginRequest("test-idp", { relayState: "/dashboard" });

  assert.equal(request.relayState, "/dashboard");
  const redirect = new URL(request.redirectUrl);
  assert.equal(redirect.searchParams.get("RelayState"), "/dashboard");
});

test("SamlService consumes valid assertion with all fields", () => {
  const service = new SamlService();
  const provider = createTestProvider();
  service.registerProvider(provider);

  const now = new Date("2026-04-24T12:00:00.000Z");
  const assertion: SamlAssertionInput = {
    assertionId: "assertion-123",
    issuer: provider.issuer,
    audience: buildSamlAudience(provider),
    nameId: "user@example.com",
    fingerprint: provider.certificateFingerprint,
    attributes: { email: "user@example.com", role: "admin" },
    sessionIndex: "session-idx-1",
    notBefore: "2026-04-24T11:55:00.000Z",
    notOnOrAfter: "2026-04-24T13:00:00.000Z",
    ...(provider.acsUrl ? { recipient: provider.acsUrl } : {}),
  };

  const session = service.consumeAssertion("test-idp", assertion, now);

  assert.ok(session.sessionId.startsWith("saml_session_"));
  assert.equal(session.providerId, "test-idp");
  assert.equal(session.subjectId, "user@example.com");
  assert.equal(session.issuer, provider.issuer);
  assert.equal(session.audience, buildSamlAudience(provider));
  assert.equal(session.sessionIndex, "session-idx-1");
  assert.equal(session.attributes.role, "admin");
  assert.equal(session.expiresAt, "2026-04-24T13:00:00.000Z");
});

test("SamlService consumes assertion with unsigned allowed", () => {
  const service = new SamlService();
  const provider = createTestProvider({ allowUnsignedAssertions: true });
  service.registerProvider(provider);

  const now = new Date("2026-04-24T12:00:00.000Z");
  const assertion: SamlAssertionInput = {
    issuer: provider.issuer,
    audience: buildSamlAudience(provider),
    nameId: "user@example.com",
    fingerprint: provider.certificateFingerprint,
  };

  const session = service.consumeAssertion("test-idp", assertion, now);

  assert.equal(session.subjectId, "user@example.com");
});

test("SamlService rejects assertion with wrong issuer", () => {
  const service = new SamlService();
  const provider = createTestProvider();
  service.registerProvider(provider);

  const now = new Date("2026-04-24T12:00:00.000Z");
  const assertion: SamlAssertionInput = {
    issuer: "https://wrong-idp.example.com",
    audience: buildSamlAudience(provider),
    nameId: "user@example.com",
    fingerprint: provider.certificateFingerprint,
  };

  assert.throws(
    () => service.consumeAssertion("test-idp", assertion, now),
    /saml\.invalid_issuer/,
  );
});

test("SamlService rejects assertion with wrong fingerprint", () => {
  const service = new SamlService();
  const provider = createTestProvider();
  service.registerProvider(provider);

  const now = new Date("2026-04-24T12:00:00.000Z");
  const assertion: SamlAssertionInput = {
    issuer: provider.issuer,
    audience: buildSamlAudience(provider),
    nameId: "user@example.com",
    fingerprint: "WRONG:FINGERPRINT",
  };

  assert.throws(
    () => service.consumeAssertion("test-idp", assertion, now),
    /saml\.invalid_fingerprint/,
  );
});

test("SamlService rejects assertion with invalid audience", () => {
  const service = new SamlService();
  const provider = createTestProvider();
  service.registerProvider(provider);

  const now = new Date("2026-04-24T12:00:00.000Z");
  const assertion: SamlAssertionInput = {
    issuer: provider.issuer,
    audience: "https://evil.example.com",
    nameId: "user@example.com",
    fingerprint: provider.certificateFingerprint,
  };

  assert.throws(
    () => service.consumeAssertion("test-idp", assertion, now),
    /saml\.invalid_audience/,
  );
});

test("SamlService rejects assertion with empty subject", () => {
  const service = new SamlService();
  const provider = createTestProvider();
  service.registerProvider(provider);

  const now = new Date("2026-04-24T12:00:00.000Z");
  const assertion: SamlAssertionInput = {
    issuer: provider.issuer,
    audience: buildSamlAudience(provider),
    nameId: "   ",
    fingerprint: provider.certificateFingerprint,
  };

  assert.throws(
    () => service.consumeAssertion("test-idp", assertion, now),
    /saml\.invalid_subject/,
  );
});

test("SamlService rejects expired assertion", () => {
  const service = new SamlService();
  const provider = createTestProvider();
  service.registerProvider(provider);

  const now = new Date("2026-04-24T14:00:00.000Z");
  const assertion: SamlAssertionInput = {
    issuer: provider.issuer,
    audience: buildSamlAudience(provider),
    nameId: "user@example.com",
    fingerprint: provider.certificateFingerprint,
    notOnOrAfter: "2026-04-24T13:00:00.000Z",
  };

  assert.throws(
    () => service.consumeAssertion("test-idp", assertion, now),
    /saml\.assertion_expired/,
  );
});

test("SamlService rejects assertion not yet valid", () => {
  const service = new SamlService();
  const provider = createTestProvider();
  service.registerProvider(provider);

  const now = new Date("2026-04-24T11:00:00.000Z");
  const assertion: SamlAssertionInput = {
    issuer: provider.issuer,
    audience: buildSamlAudience(provider),
    nameId: "user@example.com",
    fingerprint: provider.certificateFingerprint,
    notBefore: "2026-04-24T12:00:00.000Z",
  };

  assert.throws(
    () => service.consumeAssertion("test-idp", assertion, now),
    /saml\.assertion_expired/,
  );
});

test("SamlService rejects replayed assertion", () => {
  const service = new SamlService();
  const provider = createTestProvider();
  service.registerProvider(provider);

  const now = new Date("2026-04-24T12:00:00.000Z");
  const assertion: SamlAssertionInput = {
    assertionId: "assertion-replay-test",
    issuer: provider.issuer,
    audience: buildSamlAudience(provider),
    nameId: "user@example.com",
    fingerprint: provider.certificateFingerprint,
  };

  service.consumeAssertion("test-idp", assertion, now);

  assert.throws(
    () => service.consumeAssertion("test-idp", assertion, now),
    /saml\.assertion_replayed/,
  );
});

test("SamlService rejects assertion with wrong recipient", () => {
  const service = new SamlService();
  const provider = createTestProvider();
  service.registerProvider(provider);

  const now = new Date("2026-04-24T12:00:00.000Z");
  const assertion: SamlAssertionInput = {
    issuer: provider.issuer,
    audience: buildSamlAudience(provider),
    nameId: "user@example.com",
    fingerprint: provider.certificateFingerprint,
    recipient: "https://wrong-recipient.example.com/saml/acs",
  };

  assert.throws(
    () => service.consumeAssertion("test-idp", assertion, now),
    /saml\.invalid_recipient/,
  );
});

test("SamlService requires signature when allowUnsignedAssertions is false", () => {
  const service = new SamlService();
  const provider = createTestProvider({ allowUnsignedAssertions: false });
  service.registerProvider(provider);

  const now = new Date("2026-04-24T12:00:00.000Z");
  const assertion: SamlAssertionInput = {
    issuer: provider.issuer,
    audience: buildSamlAudience(provider),
    nameId: "user@example.com",
    fingerprint: provider.certificateFingerprint,
  };

  assert.throws(
    () => service.consumeAssertion("test-idp", assertion, now),
    /saml\.signature_required/,
  );
});

test("SamlService builds logout request", () => {
  const service = new SamlService();
  service.registerProvider(createTestProvider());

  const request = service.buildLogoutRequest(
    "test-idp",
    {
      sessionId: "session-123",
      subjectId: "user@example.com",
      sessionIndex: "idx-456",
    },
    "/logout-return",
  );

  assert.equal(request.providerId, "test-idp");
  assert.ok(request.requestId.startsWith("saml_logout_"));
  assert.equal(request.relayState, "/logout-return");
  assert.ok(request.redirectUrl.includes("SAMLRequest="));
});

test("SamlService throws for missing provider on login", () => {
  const service = new SamlService();

  assert.throws(
    () => service.buildLoginRequest("non-existent"),
    /saml\.provider_not_found/,
  );
});

test("SamlService throws for missing provider on logout", () => {
  const service = new SamlService();

  assert.throws(
    () => service.buildLogoutRequest("non-existent", {
      sessionId: "session-123",
      subjectId: "user@example.com",
      sessionIndex: null,
    }),
    /saml\.provider_not_found/,
  );
});

test("SamlService throws for missing provider on consume", () => {
  const service = new SamlService();

  const now = new Date("2026-04-24T12:00:00.000Z");
  const assertion: SamlAssertionInput = {
    issuer: "https://idp.example.com",
    audience: "audience",
    nameId: "user@example.com",
    fingerprint: "AA:BB:CC",
  };

  assert.throws(
    () => service.consumeAssertion("non-existent", assertion, now),
    /saml\.provider_not_found/,
  );
});

test("buildSamlAudience constructs correct audience string", () => {
  const provider = createTestProvider();

  const audience = buildSamlAudience(provider);

  assert.equal(audience, `${provider.issuer}:${provider.providerId}`);
});

test("validateXmlSignature returns invalid for malformed signature", () => {
  const result = validateXmlSignature(
    "<invalid>signature</invalid>",
    "<xml>document</xml>",
  );

  assert.equal(result.valid, false);
  assert.ok(result.error);
});

test("validateXmlSignature accepts custom key provider function", () => {
  const result = validateXmlSignature(
    "<signature>test</signature>",
    "<xml>doc</xml>",
    {
      keyProviderFn: (keyInfo) => "mock-public-key",
    },
  );

  // Should return invalid since the signature is not real
  assert.equal(result.valid, false);
});
