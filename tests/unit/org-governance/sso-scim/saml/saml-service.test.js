import assert from "node:assert/strict";
import test from "node:test";
import { SamlService, buildSamlAudience } from "../../../../../src/org-governance/sso-scim/saml/index.js";
function createProvider() {
    return {
        providerId: "corp-idp",
        entryPoint: "https://idp.example.com/saml/login",
        issuer: "https://idp.example.com",
        certificateFingerprint: "AA:BB:CC",
        entityId: "https://app.example.com/saml/metadata",
        acsUrl: "https://app.example.com/saml/acs",
        attributeMapping: {
            email: "mail",
        },
        allowUnsignedAssertions: false,
    };
}
test("SamlService builds login requests with encoded SAML payload and relay state", () => {
    const service = new SamlService();
    service.registerProvider(createProvider());
    const request = service.buildLoginRequest("corp-idp", {
        relayState: "return=/workspace",
        requestId: "req-123",
    });
    const redirect = new URL(request.redirectUrl);
    assert.equal(request.providerId, "corp-idp");
    assert.equal(request.requestId, "req-123");
    assert.equal(request.audience, buildSamlAudience(createProvider()));
    assert.equal(redirect.searchParams.get("RelayState"), "return=/workspace");
    assert.ok(redirect.searchParams.get("SAMLRequest"));
});
test("SamlService consumes a valid assertion into a session", () => {
    const service = new SamlService();
    const provider = createProvider();
    provider.allowUnsignedAssertions = true;
    service.registerProvider(provider);
    const now = new Date("2026-04-20T10:00:00.000Z");
    const session = service.consumeAssertion("corp-idp", {
        issuer: provider.issuer,
        audience: buildSamlAudience(provider),
        nameId: "user-123",
        fingerprint: provider.certificateFingerprint,
        attributes: { email: "user@example.com" },
        sessionIndex: "sess-1",
        notBefore: "2026-04-20T09:55:00.000Z",
        notOnOrAfter: "2026-04-20T11:00:00.000Z",
    }, now);
    assert.equal(session.providerId, "corp-idp");
    assert.equal(session.subjectId, "user-123");
    assert.equal(session.attributes.email, "user@example.com");
    assert.equal(session.sessionIndex, "sess-1");
});
test("SamlService rejects assertions with invalid issuer, fingerprint, audience, or subject", () => {
    const service = new SamlService();
    const provider = createProvider();
    service.registerProvider(provider);
    const audience = buildSamlAudience(provider);
    assert.throws(() => service.consumeAssertion("corp-idp", {
        issuer: "https://other-idp.example.com",
        audience,
        nameId: "user-123",
        fingerprint: provider.certificateFingerprint,
    }), /saml\.invalid_issuer:corp-idp/);
    assert.throws(() => service.consumeAssertion("corp-idp", {
        issuer: provider.issuer,
        audience,
        nameId: "user-123",
        fingerprint: "WRONG",
    }), /saml\.invalid_fingerprint:corp-idp/);
    assert.throws(() => service.consumeAssertion("corp-idp", {
        issuer: provider.issuer,
        audience: "wrong-audience",
        nameId: "user-123",
        fingerprint: provider.certificateFingerprint,
    }), /saml\.invalid_audience:corp-idp/);
    assert.throws(() => service.consumeAssertion("corp-idp", {
        issuer: provider.issuer,
        audience,
        nameId: "   ",
        fingerprint: provider.certificateFingerprint,
    }), /saml\.invalid_subject:corp-idp/);
});
test("SamlService rejects assertions outside validity window", () => {
    const service = new SamlService();
    const provider = createProvider();
    service.registerProvider(provider);
    assert.throws(() => service.consumeAssertion("corp-idp", {
        issuer: provider.issuer,
        audience: buildSamlAudience(provider),
        nameId: "user-123",
        fingerprint: provider.certificateFingerprint,
        notBefore: "2026-04-20T10:05:00.000Z",
        notOnOrAfter: "2026-04-20T11:00:00.000Z",
    }, new Date("2026-04-20T10:00:00.000Z")), /saml\.assertion_expired:corp-idp/);
    assert.throws(() => service.consumeAssertion("corp-idp", {
        issuer: provider.issuer,
        audience: buildSamlAudience(provider),
        nameId: "user-123",
        fingerprint: provider.certificateFingerprint,
        notOnOrAfter: "2026-04-20T10:00:00.000Z",
    }, new Date("2026-04-20T10:00:00.000Z")), /saml\.assertion_expired:corp-idp/);
});
test("SamlService builds logout requests for active sessions", () => {
    const service = new SamlService();
    service.registerProvider(createProvider());
    const request = service.buildLogoutRequest("corp-idp", {
        sessionId: "session-123",
        subjectId: "user-123",
        sessionIndex: "idx-123",
    }, "logout-return");
    const redirect = new URL(request.redirectUrl);
    assert.equal(request.providerId, "corp-idp");
    assert.equal(request.relayState, "logout-return");
    assert.ok(redirect.searchParams.get("SAMLRequest"));
});
test("SamlService fails closed when the provider is missing", () => {
    const service = new SamlService();
    assert.throws(() => service.buildLoginRequest("missing-provider"), /saml\.provider_not_found:missing-provider/);
    assert.equal(service.getProvider("missing-provider"), null);
});
//# sourceMappingURL=saml-service.test.js.map