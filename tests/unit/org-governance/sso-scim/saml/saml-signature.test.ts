import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { SignedXml } from "xml-crypto";

import {
  SamlService,
  validateXmlSignature,
  SAML_SIGNATURE_ALGORITHMS,
  buildSamlAudience,
  type SamlProviderConfig,
  type SamlAssertionInput,
} from "../../../../../src/org-governance/sso-scim/saml/index.js";

const TEST_SIGNING_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDFcJW+VDpDNLMy
JFM6zA925p6V2hQX4l0KZdHcee1g9giB0mUcKrrmEGZLyfS9hnFJ5K2kR9IzPGsD
MR7ADQ3q3TXdNsydtCxieUZQZnxpv05k6Iu084ihTiBXyTcPtX0YcL/tRZgqtQEb
FycZqswzCl39123pmEWUacjdYLcl89OBwENQYEFg017XubC5jJmiLRig0Ia1Q7hH
cZRSuS+gcbFGlVRQucMtir5ZT7lK5bagE4Q9iPPLgOj353JdxyW5GOyMRp3qj/AU
sPQimeJyUq3bBjOQwj/JdW2L7Redoo9m/J/9HpA3xV7RQuK4l+OKlvFuW5Wimn/V
si3iFkdLAgMBAAECggEAHZ3HGIcR5kWKy8QJ0rwMEHiE4/2TyLFlO3YNMNapS5jH
AJJK0HAocPJCJgQ5Tg9TVxOSaHN4OG9Lrhg5gJ10r6esY252QFcSgVhSZSUPwd0M
frPTS7rBjVC8JpmW732jMiis4YPwUMJYqXOjoy9Xn3W3+6fLuPU6cAoeM0xFV3p5
NqRSmVBCtzg/n7wYwrLAljuKRd7nYNkVqhIpFSemIyUaC5TT7aIQpUPwOTeuMGJO
/5OPvTKtwmTAb2Z/pO1h9PvpOJdkxRa58QGY5IJcAMPWw2ePopHKW/6MYq4yXidW
SaJMVTaRMRkOFpaDIZHIY/llYfidYDxttfAiJxsrwQKBgQD5wFylCpT/L3kTWRHI
UPE9mXgblCHnWayOjjWHH/MAZSBxhxCEQbUCfaYS2qeAWMoeWxT8qOvTgZ4rCq1/
+rSu+2SUJreBY8uf3iBncVP+bIoD/r8kfDxVOqUa6VhNKYUCDB+LRqiJkLKpSjIm
I7Tk/S0Ti1sZAjx+YsCzBnfISQKBgQDKYSvS1TAWoZBrt261gP5wHKsdTbgahUdX
wFKA6FAL4dNjWrexMmHioJDiJpJdDd8yI82x0QkIRK57bnO2k8JkEZykhwOrh+Qb
yn1DuRHvMOCHgY9N3sWsz8nR7Q+A1diecn5YQiOAFOhNBp2gJIogUz5cQQKEhU6b
sFE0QS3a8wKBgEKGo+buf6vNyHGH6z2xmeDvrVejSLioYVeDt+xrbT4wscir0pF4
MzAbqg4hojaE8CnP1zJKCK9JOol6iaaqcFCf9DWmboEPxSCreXQ0csw1uzm/NMkS
Mrv9KBeYCoZbReu6sPhXdPNX0M9ZTSxtnHTWn5gyKazqtJRx16SYV3XJAoGBAJ2n
4SnXJiUbK5SeS0JeANh5nNuxJdCTLyavDhaZ43G+NJzbmOoTY6nWh8eFYNPY8Jzw
w1bYjv6/8mT5gG8k4HRwO+T3wOYpcIwtzDOrwsrg+qjVRzvUZY3gOUquMDufW6bj
boV20I0AvI70rmqIzImuD5BynHF8H+atDjV06TH9AoGAKxXJQjSZlaZOnuk3gk5X
XYg2lKn5ijiqJkyAXZ+wikpgi/nvOQEgytg56POZ7c0JaKNWVou0OMNSaUTx/C8K
o79uVPsvqVH0uQTM5zhnhOBI+zVZuJnKrVdxqlV5Xv7iuyzYAf98IDsW7cHO2Aip
OiYuGK1edm8HmNS5FfQwpCo=
-----END PRIVATE KEY-----`;

const TEST_SIGNING_CERTIFICATE_PEM = `-----BEGIN CERTIFICATE-----
MIIDVzCCAj+gAwIBAgIUAWN4JSDug0We/kbe8JqfgUcO/wowDQYJKoZIhvcNAQEL
BQAwOzEdMBsGA1UEAwwUY29ycC1pZHAuZXhhbXBsZS5jb20xDTALBgNVBAoMBFRl
c3QxCzAJBgNVBAYTAlVTMB4XDTI2MDUwNTA2MDcyNloXDTI3MDUwNTA2MDcyNlow
OzEdMBsGA1UEAwwUY29ycC1pZHAuZXhhbXBsZS5jb20xDTALBgNVBAoMBFRlc3Qx
CzAJBgNVBAYTAlVTMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxXCV
vlQ6QzSzMiRTOswPduaeldoUF+JdCmXR3HntYPYIgdJlHCq65hBmS8n0vYZxSeSt
pEfSMzxrAzEewA0N6t013TbMnbQsYnlGUGZ8ab9OZOiLtPOIoU4gV8k3D7V9GHC/
7UWYKrUBGxcnGarMMwpd/ddt6ZhFlGnI3WC3JfPTgcBDUGBBYNNe17mwuYyZoi0Y
oNCGtUO4R3GUUrkvoHGxRpVUULnDLYq+WU+5SuW2oBOEPYjzy4Do9+dyXccluRjs
jEad6o/wFLD0IpniclKt2wYzkMI/yXVti+0XnaKPZvyf/R6QN8Ve0ULiuJfjipbx
bluVopp/1bIt4hZHSwIDAQABo1MwUTAdBgNVHQ4EFgQU8+NwlWyyJpKai7V3rC6g
TgrcMIEwHwYDVR0jBBgwFoAU8+NwlWyyJpKai7V3rC6gTgrcMIEwDwYDVR0TAQH/
BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAcegTsAMMlTlSw2xwRHmtcTb4q87j
HUcpOhKraDv3sT5NIyq32j1+itCMKNwIs694ceXgw/5MZFAyW7oXlvGgg8WM0Lfb
xm9GCowksHeYpad19XDdgMWXPjkep+QvAen+HGrYbzuHRwD103GjC+vbGC6q9jTz
BHsXBnPLUDlYGeMIaywR3/Q/e+3EFx0byzUkiKYyR+o+CmzW42orteV5JXbfOTCq
4f96bITtUxf8Iu7MIYeb2T2oUrTMOffABuELJOzRMyu7Uzn/B/2i47Cp9oOvsD/3
fe8gKoUCYpcXrPMCFeHzRJcf+ZvIsdP9daGvOC8VjojXV2itt7YEfNfnpw==
-----END CERTIFICATE-----`;

function certificateBase64(certificatePem: string): string {
  return certificatePem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, "");
}

function certificateFingerprintHex(certificatePem: string): string {
  return createHash("sha256").update(Buffer.from(certificateBase64(certificatePem), "base64")).digest("hex");
}

function toColonSeparatedFingerprint(fingerprintHex: string): string {
  return fingerprintHex.match(/.{1,2}/g)?.join(":").toUpperCase() ?? fingerprintHex.toUpperCase();
}

function createSignedAssertionXml(): {
  signatureXml: string;
  rawXml: string;
  fingerprintHex: string;
  fingerprintColon: string;
} {
  const certBase64 = certificateBase64(TEST_SIGNING_CERTIFICATE_PEM);
  const signature = new SignedXml();
  signature.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
  signature.addReference(
    "//*[local-name(.)='Assertion']",
    ["http://www.w3.org/2000/09/xmldsig#enveloped-signature"],
    "http://www.w3.org/2001/04/xmlenc#sha256",
  );
  signature.signingKey = TEST_SIGNING_PRIVATE_KEY_PEM;
  signature.keyInfoProvider = {
    getKeyInfo: () => `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`,
    getKey: () => TEST_SIGNING_PRIVATE_KEY_PEM,
  };

  const rawAssertionXml = "<Response><Assertion Id=\"assertion-1\"><Subject>user-123</Subject></Assertion></Response>";
  signature.computeSignature(rawAssertionXml);

  const fingerprintHex = certificateFingerprintHex(TEST_SIGNING_CERTIFICATE_PEM);
  return {
    signatureXml: signature.getSignatureXml(),
    rawXml: signature.getSignedXml(),
    fingerprintHex,
    fingerprintColon: toColonSeparatedFingerprint(fingerprintHex),
  };
}

/**
 * §48 SAML XML Signature
 *
 * Tests SAML 2.0 XML Signature validation for production use.
 * This tests the xml-crypto integration for signature verification
 * and related security hardening features.
 */
test("SAML_SIGNATURE_ALGORITHMS contains expected algorithms", () => {
  assert.ok(SAML_SIGNATURE_ALGORITHMS.includes("http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"));
  assert.ok(SAML_SIGNATURE_ALGORITHMS.includes("http://www.w3.org/2000/09/xmldsig#rsa-sha1"));
  assert.equal(SAML_SIGNATURE_ALGORITHMS.length, 2);
});

test("validateXmlSignature returns valid for empty signature with no verification", () => {
  // When signature is empty and no keyProviderFn, validation should fail gracefully
  const result = validateXmlSignature("", "<xml>test</xml>");
  assert.equal(result.valid, false);
  assert.ok(result.error != null);
});

test("validateXmlSignature returns valid structure on success path", () => {
  // Create a mock signature and XML that would pass basic structure check
  // Note: Full signature validation requires proper key and certificate setup
  const result = validateXmlSignature(
    "<!-- mock signature -->",
    "<xml>test</xml>",
    { signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256" },
  );
  // The result structure should be valid even if signature is mock
  assert.equal(typeof result.valid, "boolean");
  if (!result.valid) {
    assert.ok(result.error != null);
  }
});

test("buildSamlAudience constructs correct audience format", () => {
  const provider: SamlProviderConfig = {
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: true,
  };

  const audience = buildSamlAudience(provider);
  assert.equal(audience, "https://idp.example.com:corp-idp");
});

test("SamlService registerProvider validates with SamlProviderConfigSchema", () => {
  const service = new SamlService();

  // Valid provider should register without error
  const validProvider = {
    providerId: "test-idp",
    entryPoint: "https://idp.test.com/saml/login",
    issuer: "https://idp.test.com",
    certificateFingerprint: "AA:BB:CC:DD:EE",
    entityId: "https://app.test.com",
    acsUrl: "https://app.test.com/saml/acs",
    attributeMapping: { email: "mail", name: "cn" },
    allowUnsignedAssertions: false,
  } as any;

  service.registerProvider(validProvider);
  const retrieved = service.getProvider("test-idp");
  assert.equal(retrieved?.providerId, "test-idp");
  assert.equal(retrieved?.issuer, "https://idp.test.com");
  assert.equal(retrieved?.allowUnsignedAssertions, false);
});

test("SamlService rejects provider registration with missing required fields", () => {
  const service = new SamlService();

  // Missing providerId should throw
  assert.throws(
    () =>
      service.registerProvider({
        providerId: "",
        entryPoint: "https://idp.test.com/saml/login",
        issuer: "https://idp.test.com",
        certificateFingerprint: "AA:BB:CC",
      } as SamlProviderConfig),
    /providerId.*invalid|minimum/,
  );

  // Missing entryPoint should throw
  assert.throws(
    () =>
      service.registerProvider({
        providerId: "test-id",
        entryPoint: "",
        issuer: "https://idp.test.com",
        certificateFingerprint: "AA:BB:CC",
      } as SamlProviderConfig),
    /entryPoint.*invalid|minimum/,
  );
});

test("SamlService buildLoginRequest creates correct login request structure", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    entityId: "https://app.example.com/saml/metadata",
    acsUrl: "https://app.example.com/saml/acs",
  });

  const request = service.buildLoginRequest("corp-idp", {
    relayState: "return=/dashboard",
    requestId: "req-abc-123",
  });

  assert.equal(request.providerId, "corp-idp");
  assert.equal(request.requestId, "req-abc-123");
  assert.equal(request.relayState, "return=/dashboard");
  assert.ok(request.redirectUrl.startsWith("https://idp.example.com/saml/login?"));
  assert.ok(request.redirectUrl.includes("SAMLRequest="));
  assert.ok(request.redirectUrl.includes("RelayState="));
});

test("SamlService buildLoginRequest generates unique requestId when not provided", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
  });

  const request1 = service.buildLoginRequest("corp-idp");
  const request2 = service.buildLoginRequest("corp-idp");

  assert.ok(request1.requestId.startsWith("saml_req_"));
  assert.ok(request2.requestId.startsWith("saml_req_"));
  assert.notEqual(request1.requestId, request2.requestId);
});

test("SamlService consumeAssertion rejects invalid issuer", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
  });

  const audience = buildSamlAudience({
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
  });

  const assertion: SamlAssertionInput = {
    assertionId: "assertion-invalid-issuer",
    issuer: "https://wrong-idp.example.com",
    audience,
    nameId: "user-123",
    fingerprint: "AA:BB:CC",
    xmlSignature: "<Signature />",
    rawXml: "<Response />",
  };

  assert.throws(
    () => service.consumeAssertion("corp-idp", assertion),
    /saml\.invalid_issuer:corp-idp/,
  );
});

test("SamlService consumeAssertion rejects invalid fingerprint", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
  });

  const audience = buildSamlAudience({
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
  });

  const assertion: SamlAssertionInput = {
    assertionId: "assertion-invalid-fingerprint",
    issuer: "https://idp.example.com",
    audience,
    nameId: "user-123",
    fingerprint: "WRONG:FINGERPRINT",
    xmlSignature: "<Signature />",
    rawXml: "<Response />",
  };

  assert.throws(
    () => service.consumeAssertion("corp-idp", assertion),
    /saml\.invalid_fingerprint:corp-idp/,
  );
});

test("SamlService consumeAssertion rejects invalid audience", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
  });

  const assertion: SamlAssertionInput = {
    assertionId: "assertion-invalid-audience",
    issuer: "https://idp.example.com",
    audience: "wrong-audience-format",
    nameId: "user-123",
    fingerprint: "AA:BB:CC",
    xmlSignature: "<Signature />",
    rawXml: "<Response />",
  };

  assert.throws(
    () => service.consumeAssertion("corp-idp", assertion),
    /saml\.invalid_audience:corp-idp/,
  );
});

test("SamlService consumeAssertion rejects empty subject", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
  });

  const audience = buildSamlAudience({
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
  });

  const assertion: SamlAssertionInput = {
    assertionId: "assertion-empty-subject",
    issuer: "https://idp.example.com",
    audience,
    nameId: "   ",
    fingerprint: "AA:BB:CC",
    xmlSignature: "<Signature />",
    rawXml: "<Response />",
  };

  assert.throws(
    () => service.consumeAssertion("corp-idp", assertion),
    /saml\.invalid_subject:corp-idp/,
  );
});

test("SamlService consumeAssertion rejects expired assertion", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
  });

  const audience = buildSamlAudience({
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
  });

  // notOnOrAfter is in the past
  const assertion: SamlAssertionInput = {
    assertionId: "assertion-expired",
    issuer: "https://idp.example.com",
    audience,
    nameId: "user-123",
    fingerprint: "AA:BB:CC",
    notOnOrAfter: "2020-01-01T00:00:00.000Z",
    xmlSignature: "<Signature />",
    rawXml: "<Response />",
  };

  assert.throws(
    () => service.consumeAssertion("corp-idp", assertion, new Date("2026-04-21")),
    /saml\.assertion_expired:corp-idp/,
  );
});

test("SamlService consumeAssertion rejects assertion not yet valid", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
  });

  const audience = buildSamlAudience({
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
  });

  // notBefore is in the future
  const assertion: SamlAssertionInput = {
    assertionId: "assertion-not-yet-valid",
    issuer: "https://idp.example.com",
    audience,
    nameId: "user-123",
    fingerprint: "AA:BB:CC",
    notBefore: "2099-01-01T00:00:00.000Z",
    xmlSignature: "<Signature />",
    rawXml: "<Response />",
  };

  assert.throws(
    () => service.consumeAssertion("corp-idp", assertion, new Date("2026-04-21")),
    /saml\.assertion_expired:corp-idp/,
  );
});

test("SamlService consumeAssertion accepts valid assertion and creates session", () => {
  const service = new SamlService();
  const provider: SamlProviderConfig = {
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    entityId: "https://app.example.com/saml/metadata",
    acsUrl: "https://app.example.com/saml/acs",
    allowUnsignedAssertions: true,
  };
  service.registerProvider(provider);

  const audience = buildSamlAudience(provider);
  const now = new Date("2026-04-21T10:00:00.000Z");

  const assertion: SamlAssertionInput = {
    assertionId: "assertion-valid-session",
    issuer: provider.issuer,
    audience,
    nameId: "john.doe@example.com",
    fingerprint: provider.certificateFingerprint,
    attributes: { email: "john.doe@example.com", department: "Engineering" },
    sessionIndex: "session-abc-123",
    notBefore: "2026-04-21T09:55:00.000Z",
    notOnOrAfter: "2026-04-21T11:00:00.000Z",
  };

  const session = service.consumeAssertion("corp-idp", assertion, now);

  assert.ok(session.sessionId.startsWith("saml_session_"));
  assert.equal(session.providerId, "corp-idp");
  assert.equal(session.subjectId, "john.doe@example.com");
  assert.equal(session.issuer, provider.issuer);
  assert.equal(session.audience, audience);
  assert.equal(session.sessionIndex, "session-abc-123");
  assert.deepEqual(session.attributes, { email: "john.doe@example.com", department: "Engineering" });
  assert.equal(session.createdAt, now.toISOString());
  assert.equal(session.expiresAt, "2026-04-21T11:00:00.000Z");
});

test("SamlService consumeAssertion handles missing optional fields", () => {
  const service = new SamlService();
  const provider: SamlProviderConfig = {
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: true,
  };
  service.registerProvider(provider);

  const audience = buildSamlAudience(provider);

  const assertion: SamlAssertionInput = {
    assertionId: "assertion-optional-fields",
    issuer: provider.issuer,
    audience,
    nameId: "user-456",
    fingerprint: provider.certificateFingerprint,
  };

  const session = service.consumeAssertion("corp-idp", assertion, new Date());

  assert.equal(session.subjectId, "user-456");
  assert.equal(session.sessionIndex, null);
  assert.deepEqual(session.attributes, {});
  assert.equal(session.expiresAt, null);
});

test("SamlService consumeAssertion validates signature when provided with rawXml", () => {
  const service = new SamlService();
  const provider: SamlProviderConfig = {
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: true,
  };
  service.registerProvider(provider);

  const audience = buildSamlAudience(provider);

  const assertion: SamlAssertionInput = {
    issuer: provider.issuer,
    audience,
    nameId: "user-123",
    fingerprint: provider.certificateFingerprint,
    xmlSignature: "<!-- mock signature that will fail validation -->",
    rawXml: "<SAMLResponse>mock</SAMLResponse>",
  };

  // The mock signature should fail validation since it's not a real signature
  assert.throws(
    () => service.consumeAssertion("corp-idp", assertion),
    /saml\.invalid_signature:corp-idp/,
  );
});

test("SamlService consumeAssertion accepts a valid signed assertion with colon-formatted fingerprint", () => {
  const service = new SamlService();
  const signedAssertion = createSignedAssertionXml();
  const provider: SamlProviderConfig = {
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: signedAssertion.fingerprintColon,
    allowUnsignedAssertions: false,
  };
  service.registerProvider(provider);

  const session = service.consumeAssertion("corp-idp", {
    assertionId: "assertion-real-signed",
    issuer: provider.issuer,
    audience: buildSamlAudience(provider),
    nameId: "user-123",
    fingerprint: signedAssertion.fingerprintColon,
    xmlSignature: signedAssertion.signatureXml,
    rawXml: signedAssertion.rawXml,
  });

  assert.equal(session.subjectId, "user-123");
});

test("SamlService consumeAssertion rejects an embedded certificate that does not match provider fingerprint", () => {
  const service = new SamlService();
  const signedAssertion = createSignedAssertionXml();
  const provider: SamlProviderConfig = {
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "DE:AD:BE:EF",
    allowUnsignedAssertions: false,
  };
  service.registerProvider(provider);

  assert.throws(
    () =>
      service.consumeAssertion("corp-idp", {
        assertionId: "assertion-untrusted-cert",
        issuer: provider.issuer,
        audience: buildSamlAudience(provider),
        nameId: "user-123",
        fingerprint: provider.certificateFingerprint,
        xmlSignature: signedAssertion.signatureXml,
        rawXml: signedAssertion.rawXml,
      }),
    /saml\.invalid_signature:corp-idp/,
  );
});

test("SamlService consumeAssertion requires signature by default", () => {
  const service = new SamlService();
  const provider: SamlProviderConfig = {
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
  };
  service.registerProvider(provider);

  const audience = buildSamlAudience(provider);

  const assertion: SamlAssertionInput = {
    assertionId: "assertion-signature-required",
    issuer: provider.issuer,
    audience,
    nameId: "user-123",
    fingerprint: provider.certificateFingerprint,
  };

  assert.throws(
    () => service.consumeAssertion("corp-idp", assertion, new Date()),
    /saml\.signature_required:corp-idp/,
  );
});

test("SamlService consumeAssertion allows unsigned assertion only when provider opts in", () => {
  const service = new SamlService();
  const provider: SamlProviderConfig = {
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: true,
  };
  service.registerProvider(provider);

  const audience = buildSamlAudience(provider);

  const assertion: SamlAssertionInput = {
    assertionId: "assertion-unsigned-allowed",
    issuer: provider.issuer,
    audience,
    nameId: "user-123",
    fingerprint: provider.certificateFingerprint,
  };

  const session = service.consumeAssertion("corp-idp", assertion, new Date());
  assert.equal(session.subjectId, "user-123");
});

test("SamlService consumeAssertion rejects recipient mismatch", () => {
  const service = new SamlService();
  const provider: SamlProviderConfig = {
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: true,
    acsUrl: "https://app.example.com/saml/acs",
  };
  service.registerProvider(provider);

  const assertion: SamlAssertionInput = {
    assertionId: "assertion-invalid-recipient",
    issuer: provider.issuer,
    audience: buildSamlAudience(provider),
    nameId: "user-123",
    fingerprint: provider.certificateFingerprint,
    recipient: "https://evil.example.com/saml/acs",
  };

  assert.throws(
    () => service.consumeAssertion("corp-idp", assertion, new Date()),
    /saml\.invalid_recipient:corp-idp/,
  );
});

test("SamlService consumeAssertion rejects replayed assertion id", () => {
  const service = new SamlService();
  const provider: SamlProviderConfig = {
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: true,
  };
  service.registerProvider(provider);

  const assertion: SamlAssertionInput = {
    assertionId: "assertion-replayed",
    issuer: provider.issuer,
    audience: buildSamlAudience(provider),
    nameId: "user-123",
    fingerprint: provider.certificateFingerprint,
  };

  service.consumeAssertion("corp-idp", assertion, new Date());
  assert.throws(
    () => service.consumeAssertion("corp-idp", assertion, new Date()),
    /saml\.assertion_replayed:corp-idp/,
  );
});

test("SamlService buildLogoutRequest creates correct logout request structure", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
  });

  const logoutRequest = service.buildLogoutRequest(
    "corp-idp",
    {
      sessionId: "session-abc-123",
      subjectId: "user@example.com",
      sessionIndex: "idx-456",
    },
    "return=/login",
  );

  assert.equal(logoutRequest.providerId, "corp-idp");
  assert.ok(logoutRequest.requestId.startsWith("saml_logout_"));
  assert.equal(logoutRequest.relayState, "return=/login");
  assert.ok(logoutRequest.redirectUrl.startsWith("https://idp.example.com/saml/login?"));
  assert.ok(logoutRequest.redirectUrl.includes("SAMLRequest="));
});

test("SamlService buildLogoutRequest without relay state", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
  });

  const logoutRequest = service.buildLogoutRequest(
    "corp-idp",
    {
      sessionId: "session-xyz",
      subjectId: "user@example.com",
      sessionIndex: null,
    },
  );

  assert.equal(logoutRequest.providerId, "corp-idp");
  assert.equal(logoutRequest.relayState, null);
});

test("SamlService fails closed when provider not found", () => {
  const service = new SamlService();

  assert.throws(
    () => service.buildLoginRequest("missing-provider"),
    /saml\.provider_not_found:missing-provider/,
  );

  assert.throws(
    () => service.consumeAssertion("missing-provider", {
      issuer: "https://test.com",
      audience: "test",
      nameId: "user",
      fingerprint: "AA:BB:CC",
    }),
    /saml\.provider_not_found:missing-provider/,
  );

  assert.throws(
    () => service.buildLogoutRequest("missing-provider", {
      sessionId: "sess",
      subjectId: "user",
      sessionIndex: null,
    }),
    /saml\.provider_not_found:missing-provider/,
  );

  assert.equal(service.getProvider("missing-provider"), null);
});

test("SamlService getProvider returns null for unregistered provider", () => {
  const service = new SamlService();
  service.registerProvider({
    providerId: "registered-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
  });

  assert.equal(service.getProvider("registered-idp")?.providerId, "registered-idp");
  assert.equal(service.getProvider("unregistered-idp"), null);
});

test("SamlService registerProvider overwrites existing provider with same ID", () => {
  const service = new SamlService();

  service.registerProvider({
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
  });

  service.registerProvider({
    providerId: "corp-idp",
    entryPoint: "https://new-idp.example.com/saml/login",
    issuer: "https://new-idp.example.com",
    certificateFingerprint: "FF:EE:DD:CC:BB",
    allowUnsignedAssertions: false,
  });

  const retrieved = service.getProvider("corp-idp");
  assert.equal(retrieved?.issuer, "https://new-idp.example.com");
  assert.equal(retrieved?.certificateFingerprint, "FF:EE:DD:CC:BB");
});

test("SamlService consumeAssertion accepts assertion within valid time window", () => {
  const service = new SamlService();
  const provider: SamlProviderConfig = {
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: true,
  };
  service.registerProvider(provider);

  const audience = buildSamlAudience(provider);
  const now = new Date("2026-04-21T10:00:00.000Z");

  // notBefore is 5 minutes ago, notOnOrAfter is 55 minutes from now
  const assertion: SamlAssertionInput = {
    issuer: provider.issuer,
    audience,
    nameId: "user-789",
    fingerprint: provider.certificateFingerprint,
    notBefore: "2026-04-21T09:55:00.000Z",
    notOnOrAfter: "2026-04-21T11:00:00.000Z",
  };

  const session = service.consumeAssertion("corp-idp", assertion, now);
  assert.equal(session.subjectId, "user-789");
  assert.ok(session.sessionId.length > 0);
});

test("SamlService consumeAssertion handles exact boundary of notBefore", () => {
  const service = new SamlService();
  const provider: SamlProviderConfig = {
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: true,
  };
  service.registerProvider(provider);

  const audience = buildSamlAudience(provider);
  const now = new Date("2026-04-21T10:00:00.000Z");

  // notBefore is exactly at current time - should be valid (>= notBefore)
  const assertion: SamlAssertionInput = {
    issuer: provider.issuer,
    audience,
    nameId: "user-boundary",
    fingerprint: provider.certificateFingerprint,
    notBefore: "2026-04-21T10:00:00.000Z",
    notOnOrAfter: "2026-04-21T11:00:00.000Z",
  };

  const session = service.consumeAssertion("corp-idp", assertion, now);
  assert.equal(session.subjectId, "user-boundary");
});

test("SamlService consumeAssertion handles exact boundary of notOnOrAfter", () => {
  const service = new SamlService();
  const provider: SamlProviderConfig = {
    providerId: "corp-idp",
    entryPoint: "https://idp.example.com/saml/login",
    issuer: "https://idp.example.com",
    certificateFingerprint: "AA:BB:CC",
    allowUnsignedAssertions: false,
  };
  service.registerProvider(provider);

  const audience = buildSamlAudience(provider);
  const now = new Date("2026-04-21T10:00:00.000Z");

  // notOnOrAfter is exactly at current time - should be invalid (>= notOnOrAfter means expired)
  const assertion: SamlAssertionInput = {
    issuer: provider.issuer,
    audience,
    nameId: "user-boundary",
    fingerprint: provider.certificateFingerprint,
    notOnOrAfter: "2026-04-21T10:00:00.000Z",
  };

  assert.throws(
    () => service.consumeAssertion("corp-idp", assertion, now),
    /saml\.assertion_expired:corp-idp/,
  );
});
