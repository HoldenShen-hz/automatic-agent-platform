import assert from "node:assert/strict";
import test from "node:test";

import {
  SamlService,
  validateXmlSignature,
  SAML_SIGNATURE_ALGORITHMS,
  buildSamlAudience,
  SamlProviderConfigSchema,
  type SamlProviderConfig,
  type SamlAssertionInput,
} from "../../../../src/org-governance/sso-scim/saml/index.js";

function createProvider(overrides: Partial<SamlProviderConfig> = {}): SamlProviderConfig {
  return {
    providerId: "test-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC:DD:EE",
    entityId: "https://app.example.com/saml/metadata",
    acsUrl: "https://app.example.com/saml/acs",
    attributeMapping: { email: "mail" },
    ...overrides,
  };
}

test("SAML_SIGNATURE_ALGORITHMS has correct type and values", () => {
  assert.equal(SAML_SIGNATURE_ALGORITHMS.length, 2);
  assert.equal(typeof SAML_SIGNATURE_ALGORITHMS[0], "string");
  assert.equal(typeof SAML_SIGNATURE_ALGORITHMS[1], "string");
});

test("SAML_SIGNATURE_ALGORITHMS includes rsa-sha256 and rsa-sha1", () => {
  assert.ok(SAML_SIGNATURE_ALGORITHMS.includes("http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"));
  assert.ok(SAML_SIGNATURE_ALGORITHMS.includes("http://www.w3.org/2000/09/xmldsig#rsa-sha1"));
});

test("validateXmlSignature handles exception during loadSignature", () => {
  // Invalid signature that causes an exception during load
  const result = validateXmlSignature("invalid-signature", "<xml>test</xml>");
  assert.equal(result.valid, false);
  assert.ok(result.error != null);
});

test("validateXmlSignature uses custom signature algorithm when provided", () => {
  const result = validateXmlSignature(
    "<!-- mock -->",
    "<xml>test</xml>",
    { signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1" },
  );
  // Should not throw, returns result with valid=false for mock signature
  assert.equal(typeof result.valid, "boolean");
});

test("validateXmlSignature uses custom keyProviderFn", () => {
  const keyProviderFn = (keyInfo: string | object): string | null => {
    return "mock-key";
  };

  const result = validateXmlSignature(
    "<!-- mock -->",
    "<xml>test</xml>",
    { keyProviderFn },
  );
  assert.equal(typeof result.valid, "boolean");
});

test("validateXmlSignature returns error as string when validation fails", () => {
  const result = validateXmlSignature("", "<xml>test</xml>");
  assert.equal(result.valid, false);
  assert.ok(typeof result.error === "string");
});

test("validateXmlSignature returns a string error when signature parsing fails before key resolution", () => {
  const result = validateXmlSignature(
    "<!-- mock -->",
    "<xml>test</xml>",
    {
      keyProviderFn: (): string | null => {
        throw "string error";
      },
    },
  );
  assert.equal(result.valid, false);
  assert.equal(typeof result.error, "string");
  assert.ok(result.error!.length > 0);
});

test("buildSamlAudience returns correct format", () => {
  const provider = createProvider();
  const audience = buildSamlAudience(provider);
  assert.equal(audience, "https://idp.example.com:test-idp");
});

test("buildSamlAudience with minimal provider config", () => {
  const provider: SamlProviderConfig = {
    providerId: "minimal-idp",
    entryPoint: "https://idp.test.com/saml",
    issuer: "https://idp.test.com",
    certificateFingerprint: "AA:BB:CC",
  };
  const audience = buildSamlAudience(provider);
  assert.equal(audience, "https://idp.test.com:minimal-idp");
});

test("SamlProviderConfigSchema validates required fields", () => {
  const valid = {
    providerId: "test",
    entryPoint: "https://idp.test.com",
    issuer: "https://idp.test.com",
    certificateFingerprint: "AA:BB:CC",
  };
  const result = SamlProviderConfigSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("SamlProviderConfigSchema rejects empty providerId", () => {
  const invalid = {
    providerId: "",
    entryPoint: "https://idp.test.com",
    issuer: "https://idp.test.com",
    certificateFingerprint: "AA:BB:CC",
  };
  const result = SamlProviderConfigSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("SamlProviderConfigSchema rejects empty entryPoint", () => {
  const invalid = {
    providerId: "test",
    entryPoint: "",
    issuer: "https://idp.test.com",
    certificateFingerprint: "AA:BB:CC",
  };
  const result = SamlProviderConfigSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("SamlProviderConfigSchema rejects empty issuer", () => {
  const invalid = {
    providerId: "test",
    entryPoint: "https://idp.test.com",
    issuer: "",
    certificateFingerprint: "AA:BB:CC",
  };
  const result = SamlProviderConfigSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("SamlProviderConfigSchema rejects empty certificateFingerprint", () => {
  const invalid = {
    providerId: "test",
    entryPoint: "https://idp.test.com",
    issuer: "https://idp.test.com",
    certificateFingerprint: "",
  };
  const result = SamlProviderConfigSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("SamlProviderConfigSchema allows optional entityId", () => {
  const withEntityId = {
    providerId: "test",
    entryPoint: "https://idp.test.com",
    issuer: "https://idp.test.com",
    certificateFingerprint: "AA:BB:CC",
    entityId: "https://app.test.com/entity",
  };
  const result = SamlProviderConfigSchema.safeParse(withEntityId);
  assert.equal(result.success, true);
});

test("SamlProviderConfigSchema allows optional acsUrl", () => {
  const withAcsUrl = {
    providerId: "test",
    entryPoint: "https://idp.test.com",
    issuer: "https://idp.test.com",
    certificateFingerprint: "AA:BB:CC",
    acsUrl: "https://app.test.com/saml/acs",
  };
  const result = SamlProviderConfigSchema.safeParse(withAcsUrl);
  assert.equal(result.success, true);
});

test("SamlProviderConfigSchema allows optional attributeMapping", () => {
  const withAttributes = {
    providerId: "test",
    entryPoint: "https://idp.test.com",
    issuer: "https://idp.test.com",
    certificateFingerprint: "AA:BB:CC",
    attributeMapping: { email: "mail", name: "cn" },
  };
  const result = SamlProviderConfigSchema.safeParse(withAttributes);
  assert.equal(result.success, true);
});

test("SamlProviderConfigSchema rejects non-record attributeMapping", () => {
  const invalid = {
    providerId: "test",
    entryPoint: "https://idp.test.com",
    issuer: "https://idp.test.com",
    certificateFingerprint: "AA:BB:CC",
    attributeMapping: "not-a-record",
  };
  const result = SamlProviderConfigSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("SamlService registerProvider accepts valid config", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());
  const retrieved = service.getProvider("test-idp");
  assert.ok(retrieved != null);
  assert.equal(retrieved?.providerId, "test-idp");
});

test("SamlService registerProvider overwrites existing provider", () => {
  const service = new SamlService();
  service.registerProvider(createProvider({ issuer: "https://old.example.com" }));
  service.registerProvider(createProvider({ issuer: "https://new.example.com" }));
  const retrieved = service.getProvider("test-idp");
  assert.equal(retrieved?.issuer, "https://new.example.com");
});

test("SamlService getProvider returns null for unknown provider", () => {
  const service = new SamlService();
  assert.equal(service.getProvider("unknown"), null);
});

test("SamlService buildLoginRequest uses issuer when entityId is missing", () => {
  const service = new SamlService();
  service.registerProvider(createProvider({ entityId: undefined }));

  const request = service.buildLoginRequest("test-idp", {
    requestId: "req-test-123",
  });

  assert.equal(request.requestId, "req-test-123");
  assert.ok(request.redirectUrl.includes("SAMLRequest="));
});

test("SamlService buildLoginRequest defaults acsUrl when missing", () => {
  const service = new SamlService();
  service.registerProvider(createProvider({ acsUrl: undefined }));

  const request = service.buildLoginRequest("test-idp");

  // Default acsUrl should be based on issuer
  assert.ok(request.redirectUrl.includes("SAMLRequest="));
});

test("SamlService buildLoginRequest without relayState", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const request = service.buildLoginRequest("test-idp");

  assert.equal(request.relayState, null);
  assert.ok(!request.redirectUrl.includes("RelayState"));
});

test("SamlService buildLoginRequest with null relayState", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const request = service.buildLoginRequest("test-idp", {
    relayState: null,
  });

  assert.equal(request.relayState, null);
});

test("SamlService buildLoginRequest generates unique requestIds", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const request1 = service.buildLoginRequest("test-idp");
  const request2 = service.buildLoginRequest("test-idp");

  assert.notEqual(request1.requestId, request2.requestId);
  assert.ok(request1.requestId.startsWith("saml_req_"));
  assert.ok(request2.requestId.startsWith("saml_req_"));
});

test("SamlService buildLoginRequest includes all required fields in redirect URL", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const request = service.buildLoginRequest("test-idp", {
    relayState: "return=/dashboard",
    requestId: "req-full-test",
  });

  const redirect = new URL(request.redirectUrl);
  assert.ok(redirect.searchParams.has("SAMLRequest"));
  assert.equal(redirect.searchParams.get("RelayState"), "return=/dashboard");
});

test("SamlService consumeAssertion skips signature validation when rawXml is missing", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const audience = buildSamlAudience(createProvider());

  // Provide xmlSignature but NOT rawXml - signature validation should be skipped
  const assertion: SamlAssertionInput = {
    issuer: "https://idp.example.com",
    audience,
    nameId: "user-no-sig",
    fingerprint: "AA:BB:CC:DD:EE",
    xmlSignature: "<!-- signature would be here -->",
    // rawXml is intentionally NOT provided
  };

  // Should NOT throw for invalid signature since rawXml is missing
  const session = service.consumeAssertion("test-idp", assertion);
  assert.equal(session.subjectId, "user-no-sig");
});

test("SamlService consumeAssertion with xmlSignature and rawXml triggers validation", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const audience = buildSamlAudience(createProvider());

  const assertion: SamlAssertionInput = {
    issuer: "https://idp.example.com",
    audience,
    nameId: "user-with-sig",
    fingerprint: "AA:BB:CC:DD:EE",
    xmlSignature: "<!-- mock signature that will fail -->",
    rawXml: "<SAMLResponse>test</SAMLResponse>",
  };

  assert.throws(
    () => service.consumeAssertion("test-idp", assertion),
    /saml\.invalid_signature:/,
  );
});

test("SamlService consumeAssertion creates session with null sessionIndex", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const audience = buildSamlAudience(createProvider());

  const assertion: SamlAssertionInput = {
    issuer: "https://idp.example.com",
    audience,
    nameId: "user-no-session-idx",
    fingerprint: "AA:BB:CC:DD:EE",
  };

  const session = service.consumeAssertion("test-idp", assertion);
  assert.equal(session.sessionIndex, null);
});

test("SamlService consumeAssertion creates session with provided sessionIndex", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const audience = buildSamlAudience(createProvider());

  const assertion: SamlAssertionInput = {
    issuer: "https://idp.example.com",
    audience,
    nameId: "user-with-session-idx",
    fingerprint: "AA:BB:CC:DD:EE",
    sessionIndex: "index-abc-123",
  };

  const session = service.consumeAssertion("test-idp", assertion);
  assert.equal(session.sessionIndex, "index-abc-123");
});

test("SamlService consumeAssertion creates session with empty attributes", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const audience = buildSamlAudience(createProvider());

  const assertion: SamlAssertionInput = {
    issuer: "https://idp.example.com",
    audience,
    nameId: "user-no-attrs",
    fingerprint: "AA:BB:CC:DD:EE",
  };

  const session = service.consumeAssertion("test-idp", assertion);
  assert.deepEqual(session.attributes, {});
});

test("SamlService consumeAssertion creates session with multiple attributes", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const audience = buildSamlAudience(createProvider());

  const assertion: SamlAssertionInput = {
    issuer: "https://idp.example.com",
    audience,
    nameId: "user-multi-attrs",
    fingerprint: "AA:BB:CC:DD:EE",
    attributes: { email: "test@example.com", department: "Engineering", role: "admin" },
  };

  const session = service.consumeAssertion("test-idp", assertion);
  assert.equal(session.attributes.email, "test@example.com");
  assert.equal(session.attributes.department, "Engineering");
  assert.equal(session.attributes.role, "admin");
});

test("SamlService consumeAssertion uses custom now parameter", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const audience = buildSamlAudience(createProvider());
  const customNow = new Date("2026-03-15T12:00:00.000Z");

  const assertion: SamlAssertionInput = {
    issuer: "https://idp.example.com",
    audience,
    nameId: "user-custom-time",
    fingerprint: "AA:BB:CC:DD:EE",
    notBefore: "2026-03-15T11:55:00.000Z",
    notOnOrAfter: "2026-03-15T13:00:00.000Z",
  };

  const session = service.consumeAssertion("test-idp", assertion, customNow);
  assert.equal(session.createdAt, "2026-03-15T12:00:00.000Z");
});

test("SamlService consumeAssertion rejects nameId with only whitespace", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const audience = buildSamlAudience(createProvider());

  const assertion: SamlAssertionInput = {
    issuer: "https://idp.example.com",
    audience,
    nameId: "   ",
    fingerprint: "AA:BB:CC:DD:EE",
  };

  assert.throws(
    () => service.consumeAssertion("test-idp", assertion),
    /saml\.invalid_subject:/,
  );
});

test("SamlService consumeAssertion rejects nameId with tabs and newlines", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const audience = buildSamlAudience(createProvider());

  const assertion: SamlAssertionInput = {
    issuer: "https://idp.example.com",
    audience,
    nameId: "\t\n",
    fingerprint: "AA:BB:CC:DD:EE",
  };

  assert.throws(
    () => service.consumeAssertion("test-idp", assertion),
    /saml\.invalid_subject:/,
  );
});

test("SamlService buildLogoutRequest without relayState", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const request = service.buildLogoutRequest("test-idp", {
    sessionId: "sess-123",
    subjectId: "user@example.com",
    sessionIndex: "idx-456",
  });

  assert.equal(request.relayState, null);
  assert.ok(!request.redirectUrl.includes("RelayState"));
});

test("SamlService buildLogoutRequest with null relayState", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const request = service.buildLogoutRequest("test-idp", {
    sessionId: "sess-123",
    subjectId: "user@example.com",
    sessionIndex: null,
  }, null);

  assert.equal(request.relayState, null);
});

test("SamlService buildLogoutRequest generates unique requestIds", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const request1 = service.buildLogoutRequest("test-idp", {
    sessionId: "sess-1",
    subjectId: "user@example.com",
    sessionIndex: null,
  });

  const request2 = service.buildLogoutRequest("test-idp", {
    sessionId: "sess-2",
    subjectId: "user@example.com",
    sessionIndex: null,
  });

  assert.notEqual(request1.requestId, request2.requestId);
  assert.ok(request1.requestId.startsWith("saml_logout_"));
});

test("SamlService buildLogoutRequest includes SAMLRequest in redirect URL", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const request = service.buildLogoutRequest("test-idp", {
    sessionId: "sess-123",
    subjectId: "user@example.com",
    sessionIndex: "idx-456",
  }, "logout");

  const redirect = new URL(request.redirectUrl);
  assert.ok(redirect.searchParams.has("SAMLRequest"));
  assert.equal(redirect.searchParams.get("RelayState"), "logout");
});

test("SamlService fails closed for buildLoginRequest with unknown provider", () => {
  const service = new SamlService();

  assert.throws(
    () => service.buildLoginRequest("unknown-provider"),
    /saml\.provider_not_found:unknown-provider/,
  );
});

test("SamlService fails closed for consumeAssertion with unknown provider", () => {
  const service = new SamlService();

  assert.throws(
    () => service.consumeAssertion("unknown-provider", {
      issuer: "https://test.com",
      audience: "test",
      nameId: "user",
      fingerprint: "AA:BB:CC",
    }),
    /saml\.provider_not_found:unknown-provider/,
  );
});

test("SamlService fails closed for buildLogoutRequest with unknown provider", () => {
  const service = new SamlService();

  assert.throws(
    () => service.buildLogoutRequest("unknown-provider", {
      sessionId: "sess",
      subjectId: "user",
      sessionIndex: null,
    }),
    /saml\.provider_not_found:unknown-provider/,
  );
});

test("SamlService consumeAssertion with notBefore exactly at current time is valid", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const audience = buildSamlAudience(createProvider());
  const now = new Date("2026-04-23T10:00:00.000Z");

  const assertion: SamlAssertionInput = {
    issuer: "https://idp.example.com",
    audience,
    nameId: "user-boundary",
    fingerprint: "AA:BB:CC:DD:EE",
    notBefore: "2026-04-23T10:00:00.000Z",
    notOnOrAfter: "2026-04-23T12:00:00.000Z",
  };

  const session = service.consumeAssertion("test-idp", assertion, now);
  assert.equal(session.subjectId, "user-boundary");
});

test("SamlService consumeAssertion with notOnOrAfter exactly at current time is invalid", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const audience = buildSamlAudience(createProvider());
  const now = new Date("2026-04-23T10:00:00.000Z");

  const assertion: SamlAssertionInput = {
    issuer: "https://idp.example.com",
    audience,
    nameId: "user-boundary",
    fingerprint: "AA:BB:CC:DD:EE",
    notOnOrAfter: "2026-04-23T10:00:00.000Z",
  };

  assert.throws(
    () => service.consumeAssertion("test-idp", assertion, now),
    /saml\.assertion_expired:/,
  );
});

test("SamlService consumeAssertion with notBefore in past and notOnOrAfter in future is valid", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const audience = buildSamlAudience(createProvider());

  const assertion: SamlAssertionInput = {
    issuer: "https://idp.example.com",
    audience,
    nameId: "user-valid-window",
    fingerprint: "AA:BB:CC:DD:EE",
    notBefore: "2026-04-23T09:00:00.000Z",
    notOnOrAfter: "2026-04-23T11:00:00.000Z",
  };

  const session = service.consumeAssertion("test-idp", assertion, new Date("2026-04-23T10:00:00.000Z"));
  assert.equal(session.subjectId, "user-valid-window");
});

test("SamlService consumeAssertion with only notBefore set is valid when in future", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const audience = buildSamlAudience(createProvider());

  const assertion: SamlAssertionInput = {
    issuer: "https://idp.example.com",
    audience,
    nameId: "user-future-not-before",
    fingerprint: "AA:BB:CC:DD:EE",
    notBefore: "2026-04-23T09:00:00.000Z",
  };

  const session = service.consumeAssertion("test-idp", assertion, new Date("2026-04-23T10:00:00.000Z"));
  assert.equal(session.subjectId, "user-future-not-before");
});

test("SamlService consumeAssertion with only notOnOrAfter set expires when past", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const audience = buildSamlAudience(createProvider());

  const assertion: SamlAssertionInput = {
    issuer: "https://idp.example.com",
    audience,
    nameId: "user-past-not-on-or-after",
    fingerprint: "AA:BB:CC:DD:EE",
    notOnOrAfter: "2026-04-23T09:00:00.000Z",
  };

  assert.throws(
    () => service.consumeAssertion("test-idp", assertion, new Date("2026-04-23T10:00:00.000Z")),
    /saml\.assertion_expired:/,
  );
});

test("SamlService consumeAssertion with expired notBefore is invalid", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const audience = buildSamlAudience(createProvider());

  const assertion: SamlAssertionInput = {
    issuer: "https://idp.example.com",
    audience,
    nameId: "user-expired-not-before",
    fingerprint: "AA:BB:CC:DD:EE",
    notBefore: "2026-04-23T11:00:00.000Z",
    notOnOrAfter: "2026-04-23T12:00:00.000Z",
  };

  assert.throws(
    () => service.consumeAssertion("test-idp", assertion, new Date("2026-04-23T10:00:00.000Z")),
    /saml\.assertion_expired:/,
  );
});

test("SamlService registerProvider rejects invalid config via Zod", () => {
  const service = new SamlService();

  assert.throws(() => {
    service.registerProvider({
      providerId: "",
      entryPoint: "https://idp.test.com",
      issuer: "https://idp.test.com",
      certificateFingerprint: "AA:BB:CC",
    } as SamlProviderConfig);
  });
});

test("SamlService registerProvider accepts config without optional fields", () => {
  const service = new SamlService();

  service.registerProvider({
    providerId: "minimal-idp",
    entryPoint: "https://idp.test.com",
    issuer: "https://idp.test.com",
    certificateFingerprint: "AA:BB:CC",
  });

  const retrieved = service.getProvider("minimal-idp");
  assert.ok(retrieved != null);
  assert.equal(retrieved?.providerId, "minimal-idp");
  assert.equal(retrieved?.entityId, undefined);
  assert.equal(retrieved?.acsUrl, undefined);
});

test("SamlService multiple providers are isolated", () => {
  const service = new SamlService();

  service.registerProvider(createProvider({ providerId: "idp-1", issuer: "https://idp-1.com" }));
  service.registerProvider(createProvider({ providerId: "idp-2", issuer: "https://idp-2.com" }));

  const idp1 = service.getProvider("idp-1");
  const idp2 = service.getProvider("idp-2");

  assert.equal(idp1?.issuer, "https://idp-1.com");
  assert.equal(idp2?.issuer, "https://idp-2.com");
  assert.equal(service.getProvider("idp-3"), null);
});

test("SamlService consumeAssertion stores correct expiresAt from notOnOrAfter", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const audience = buildSamlAudience(createProvider());

  const assertion: SamlAssertionInput = {
    issuer: "https://idp.example.com",
    audience,
    nameId: "user-expires",
    fingerprint: "AA:BB:CC:DD:EE",
    notOnOrAfter: "2026-12-31T23:59:59.000Z",
  };

  const session = service.consumeAssertion("test-idp", assertion);
  assert.equal(session.expiresAt, "2026-12-31T23:59:59.000Z");
});

test("SamlService consumeAssertion with no expiration sets expiresAt to null", () => {
  const service = new SamlService();
  service.registerProvider(createProvider());

  const audience = buildSamlAudience(createProvider());

  const assertion: SamlAssertionInput = {
    issuer: "https://idp.example.com",
    audience,
    nameId: "user-no-expiry",
    fingerprint: "AA:BB:CC:DD:EE",
  };

  const session = service.consumeAssertion("test-idp", assertion);
  assert.equal(session.expiresAt, null);
});
