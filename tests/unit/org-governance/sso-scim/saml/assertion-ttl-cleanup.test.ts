import assert from "node:assert/strict";
import test from "node:test";

import { SamlService } from "../../../../../src/org-governance/sso-scim/saml/index.js";

function createService(): SamlService {
  const service = new SamlService();
  service.registerProvider({
    providerId: "okta",
    entryPoint: "https://okta.example.com/sso",
    issuer: "https://issuer.example.com",
    certificateFingerprint: "ABC123",
    allowUnsignedAssertions: true,
  });
  return service;
}

function createAssertion(assertionId: string) {
  return {
    assertionId,
    issuer: "https://issuer.example.com",
    audience: "https://issuer.example.com:okta",
    nameId: "user@example.com",
    fingerprint: "ABC123",
  };
}

test("consumeAssertion expires replay markers after TTL cleanup", () => {
  const service = createService();
  const firstUse = new Date("2026-05-01T00:00:00.000Z");
  const afterTtl = new Date("2026-05-01T00:06:00.000Z");

  service.consumeAssertion("okta", createAssertion("assertion-1"), firstUse);

  assert.doesNotThrow(() => {
    service.consumeAssertion("okta", createAssertion("assertion-1"), afterTtl);
  });
});
