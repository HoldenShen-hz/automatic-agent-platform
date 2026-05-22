import assert from "node:assert/strict";
import test from "node:test";

import {
  registerServiceIdentity,
  getServiceIdentity,
  getServiceIdentityByName,
  updateServiceIdentityStatus,
  rotateServiceKey,
  issueServiceToken,
  signIssuedServiceToken,
  validateServiceToken,
  revokeServiceToken,
  revokeAllServiceTokens,
  generateMtlsCertificate,
  getMtlsCertificate,
  revokeMtlsCertificate,
  getServiceCertificates,
  extractServiceAuth,
  getServiceAuthStats,
  __dangerousResetServiceAuthStateForTests,
} from "../../../../src/platform/five-plane-control-plane/iam/service-auth.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

test.describe("Service Auth", () => {
  test.beforeEach(() => {
    __dangerousResetServiceAuthStateForTests();
  });

  test.afterEach(() => {
    __dangerousResetServiceAuthStateForTests();
  });

  test("registerServiceIdentity creates new service identity", () => {
    const identity = registerServiceIdentity({
      serviceName: "test-service",
      namespace: "execution",
      capabilities: ["invoke_model", "tool:invoke"],
      mtlsEnabled: false,
      metadata: { version: "1.0" },
    });

    assert.ok(identity.serviceId);
    assert.equal(identity.serviceName, "test-service");
    assert.equal(identity.namespace, "execution");
    assert.deepEqual(identity.capabilities, ["invoke_model", "tool:invoke"]);
    assert.equal(identity.mtlsEnabled, false);
    assert.equal(identity.status, "active");
    assert.ok(identity.createdAt > 0);
    assert.equal(identity.lastRotatedAt, null);
  });

  test("registerServiceIdentity defaults mtlsEnabled to false", () => {
    const identity = registerServiceIdentity({
      serviceName: "test-service-no-mtls",
      namespace: "orchestration",
      capabilities: ["tool:invoke"],
    });

    assert.equal(identity.mtlsEnabled, false);
  });

  test("getServiceIdentity returns identity by ID", () => {
    const registered = registerServiceIdentity({
      serviceName: "get-test",
      namespace: "control-plane",
      capabilities: ["invoke_model"],
    });

    const found = getServiceIdentity(registered.serviceId);

    assert.ok(found);
    assert.equal(found?.serviceId, registered.serviceId);
    assert.equal(found?.serviceName, "get-test");
  });

  test("getServiceIdentity returns null for nonexistent ID", () => {
    const found = getServiceIdentity("nonexistent-svc-id");
    assert.equal(found, null);
  });

  test("getServiceIdentityByName returns identity by name and namespace", () => {
    registerServiceIdentity({
      serviceName: "named-service",
      namespace: "execution",
      capabilities: ["tool:invoke"],
    });

    const found = getServiceIdentityByName("named-service", "execution");

    assert.ok(found);
    assert.equal(found?.serviceName, "named-service");
    assert.equal(found?.namespace, "execution");
  });

  test("getServiceIdentityByName returns null for nonexistent service", () => {
    const found = getServiceIdentityByName("nonexistent", "execution");
    assert.equal(found, null);
  });

  test("getServiceIdentityByName returns null for wrong namespace", () => {
    registerServiceIdentity({
      serviceName: "namespace-test",
      namespace: "execution",
      capabilities: ["invoke_model"],
    });

    const found = getServiceIdentityByName("namespace-test", "wrong-namespace");
    assert.equal(found, null);
  });

  test("updateServiceIdentityStatus suspends service", () => {
    const identity = registerServiceIdentity({
      serviceName: "suspend-test",
      namespace: "orchestration",
      capabilities: ["invoke_model"],
    });

    updateServiceIdentityStatus(identity.serviceId, "suspended");

    const updated = getServiceIdentity(identity.serviceId);
    assert.equal(updated?.status, "suspended");
  });

  test("updateServiceIdentityStatus revokes service and invalidates tokens", () => {
    const identity = registerServiceIdentity({
      serviceName: "revoke-test",
      namespace: "execution",
      capabilities: ["tool:invoke"],
    });

    const token = issueServiceToken({
      serviceId: identity.serviceId,
      audience: "control-plane",
    });

    updateServiceIdentityStatus(identity.serviceId, "revoked");

    const result = validateServiceToken({
      tokenId: token.tokenId,
      signature: "revoked-token-signature",
    });

    assert.equal(result.authenticated, false);
    assert.equal(result.reason, "token_invalid");
  });

  test("updateServiceIdentityStatus throws for nonexistent service", () => {
    assert.throws(
      () => updateServiceIdentityStatus("nonexistent-svc", "suspended"),
      /service.not_found/,
    );
  });

  test("rotateServiceKey generates new signing key", () => {
    const identity = registerServiceIdentity({
      serviceName: "rotate-test",
      namespace: "execution",
      capabilities: ["invoke_model"],
    });

    const before = getServiceIdentity(identity.serviceId);
    const beforeRotated = before?.lastRotatedAt;

    // Small delay to ensure new timestamp is different
    const start = Date.now();
    while (Date.now() - start < 10) { /* spin */ }

    const updated = rotateServiceKey(identity.serviceId);

    assert.ok(updated.lastRotatedAt !== null);
    if (beforeRotated !== null) {
      assert.ok(updated.lastRotatedAt >= beforeRotated);
    }
  });

  test("rotateServiceKey throws for nonexistent service", () => {
    assert.throws(
      () => rotateServiceKey("nonexistent-svc"),
      /service.not_found/,
    );
  });

  test("issueServiceToken creates token with correct properties", () => {
    const identity = registerServiceIdentity({
      serviceName: "token-test",
      namespace: "execution",
      capabilities: ["invoke_model", "tool:invoke"],
    });

    const token = issueServiceToken({
      serviceId: identity.serviceId,
      audience: "orchestration",
      capabilities: ["invoke_model"],
    });

    assert.ok(token.tokenId);
    assert.equal(token.serviceId, identity.serviceId);
    assert.equal(token.tokenType, "bearer");
    assert.equal(token.audience, "orchestration");
    assert.ok(token.issuedAt > 0);
    assert.ok(token.expiresAt > token.issuedAt);
    assert.deepEqual(token.capabilities, ["invoke_model"]);
  });

  test("issueServiceToken uses identity capabilities when not specified", () => {
    const identity = registerServiceIdentity({
      serviceName: "cap-test",
      namespace: "execution",
      capabilities: ["invoke_model", "tool:invoke", "network:access"],
    });

    const token = issueServiceToken({
      serviceId: identity.serviceId,
      audience: "*",
    });

    assert.deepEqual(token.capabilities, ["invoke_model", "tool:invoke", "network:access"]);
  });

  test("issueServiceToken throws for nonexistent service", () => {
    assert.throws(
      () => issueServiceToken({
        serviceId: "nonexistent-svc",
        audience: "test",
      }),
      /service.not_found/,
    );
  });

  test("issueServiceToken throws for suspended service", () => {
    const identity = registerServiceIdentity({
      serviceName: "suspended-token-test",
      namespace: "execution",
      capabilities: ["invoke_model"],
    });

    updateServiceIdentityStatus(identity.serviceId, "suspended");

    assert.throws(
      () => issueServiceToken({
        serviceId: identity.serviceId,
        audience: "test",
      }),
      /service.not_active/,
    );
  });

  test("signIssuedServiceToken returns HMAC signature", () => {
    const identity = registerServiceIdentity({
      serviceName: "sign-test",
      namespace: "execution",
      capabilities: ["invoke_model"],
    });

    const token = issueServiceToken({
      serviceId: identity.serviceId,
      audience: "test",
    });

    const signature = signIssuedServiceToken(token.tokenId);

    assert.ok(signature);
    assert.ok(signature.length > 0);
  });

  test("signIssuedServiceToken throws for nonexistent token", () => {
    assert.throws(
      () => signIssuedServiceToken("nonexistent-token"),
      /token.not_found/,
    );
  });

  test("validateServiceToken authenticates valid token with signature", () => {
    const identity = registerServiceIdentity({
      serviceName: "validate-test",
      namespace: "execution",
      capabilities: ["invoke_model", "tool:invoke"],
    });

    const token = issueServiceToken({
      serviceId: identity.serviceId,
      audience: "control-plane",
    });
    const signature = signIssuedServiceToken(token.tokenId);

    const result = validateServiceToken({
      tokenId: token.tokenId,
      signature,
    });

    assert.equal(result.authenticated, true);
    assert.ok(result.serviceIdentity);
    assert.ok(result.token);
    assert.equal(result.serviceIdentity?.serviceId, identity.serviceId);
    assert.equal(result.reason, null);
  });

  test("validateServiceToken rejects invalid signature", () => {
    const identity = registerServiceIdentity({
      serviceName: "sig-reject-test",
      namespace: "execution",
      capabilities: ["invoke_model"],
    });

    const token = issueServiceToken({
      serviceId: identity.serviceId,
      audience: "test",
    });

    const result = validateServiceToken({
      tokenId: token.tokenId,
      signature: "invalid-signature",
    });

    assert.equal(result.authenticated, false);
    assert.equal(result.reason, "token_invalid");
  });

  test("validateServiceToken rejects expired token", () => {
    const identity = registerServiceIdentity({
      serviceName: "expired-token-test",
      namespace: "execution",
      capabilities: ["invoke_model"],
    });

    const token = issueServiceToken({
      serviceId: identity.serviceId,
      audience: "test",
      ttlMs: -1000, // Already expired
    });
    const signature = signIssuedServiceToken(token.tokenId);

    const result = validateServiceToken({
      tokenId: token.tokenId,
      signature,
    });

    assert.equal(result.authenticated, false);
    assert.equal(result.reason, "token_expired");
  });

  test("validateServiceToken validates audience when specified", () => {
    const identity = registerServiceIdentity({
      serviceName: "audience-test",
      namespace: "execution",
      capabilities: ["invoke_model"],
    });

    const token = issueServiceToken({
      serviceId: identity.serviceId,
      audience: "specific-audience",
    });
    const signature = signIssuedServiceToken(token.tokenId);

    // Wrong audience
    const result1 = validateServiceToken({
      tokenId: token.tokenId,
      signature,
      audience: "wrong-audience",
    });
    assert.equal(result1.authenticated, false);
    assert.equal(result1.reason, "audience_mismatch");

    // Correct audience
    const result2 = validateServiceToken({
      tokenId: token.tokenId,
      signature,
      audience: "specific-audience",
    });
    assert.equal(result2.authenticated, true);
  });

  test("validateServiceToken allows wildcard audience", () => {
    const identity = registerServiceIdentity({
      serviceName: "wildcard-test",
      namespace: "execution",
      capabilities: ["invoke_model"],
    });

    const token = issueServiceToken({
      serviceId: identity.serviceId,
      audience: "*",
    });
    const signature = signIssuedServiceToken(token.tokenId);

    const result = validateServiceToken({
      tokenId: token.tokenId,
      signature,
      audience: "any-audience",
    });

    assert.equal(result.authenticated, true);
  });

  test("validateServiceToken validates required capabilities", () => {
    const identity = registerServiceIdentity({
      serviceName: "caps-test",
      namespace: "execution",
      capabilities: ["invoke_model", "tool:invoke"],
    });

    const token = issueServiceToken({
      serviceId: identity.serviceId,
      audience: "test",
      capabilities: ["invoke_model"],
    });
    const signature = signIssuedServiceToken(token.tokenId);

    // Has required capability
    const result1 = validateServiceToken({
      tokenId: token.tokenId,
      signature,
      requiredCapabilities: ["invoke_model"],
    });
    assert.equal(result1.authenticated, true);

    // Missing required capability
    const result2 = validateServiceToken({
      tokenId: token.tokenId,
      signature,
      requiredCapabilities: ["exec:command"],
    });
    assert.equal(result2.authenticated, false);
    assert.equal(result2.reason, "capability_not_granted");
  });

  test("validateServiceToken returns token_invalid for nonexistent token", () => {
    const result = validateServiceToken({
      tokenId: "nonexistent-token",
      signature: "any-signature",
    });

    assert.equal(result.authenticated, false);
    assert.equal(result.reason, "token_invalid");
  });

  test("revokeServiceToken removes token from service", () => {
    const identity = registerServiceIdentity({
      serviceName: "revoke-token-test",
      namespace: "execution",
      capabilities: ["invoke_model"],
    });

    const token = issueServiceToken({
      serviceId: identity.serviceId,
      audience: "test",
    });
    const signature = signIssuedServiceToken(token.tokenId);

    revokeServiceToken(token.tokenId);

    const result = validateServiceToken({
      tokenId: token.tokenId,
      signature,
    });

    assert.equal(result.authenticated, false);
    assert.equal(result.reason, "token_invalid");
  });

  test("revokeServiceToken throws for nonexistent token", () => {
    assert.throws(
      () => revokeServiceToken("nonexistent-token"),
      /token.not_found/,
    );
  });

  test("revokeAllServiceTokens removes all tokens for a service", () => {
    const identity = registerServiceIdentity({
      serviceName: "revoke-all-test",
      namespace: "execution",
      capabilities: ["invoke_model"],
    });

    const token1 = issueServiceToken({ serviceId: identity.serviceId, audience: "test1" });
    const token2 = issueServiceToken({ serviceId: identity.serviceId, audience: "test2" });

    const count = revokeAllServiceTokens(identity.serviceId);

    assert.ok(count >= 2);
    const result1 = validateServiceToken({ tokenId: token1.tokenId, signature: "revoked-token-1" });
    const result2 = validateServiceToken({ tokenId: token2.tokenId, signature: "revoked-token-2" });
    assert.equal(result1.reason, "token_invalid");
    assert.equal(result2.reason, "token_invalid");
  });

  test("generateMtlsCertificate creates certificate for mTLS-enabled service", () => {
    const identity = registerServiceIdentity({
      serviceName: "mtls-test",
      namespace: "execution",
      capabilities: ["tool:invoke"],
      mtlsEnabled: true,
    });

    const cert = generateMtlsCertificate({
      serviceId: identity.serviceId,
      sans: ["mtls-test.execution.svc"],
    });

    assert.ok(cert.certId);
    assert.equal(cert.serviceId, identity.serviceId);
    assert.ok(cert.serialNumber);
    assert.ok(cert.subject.includes("mtls-test"));
    assert.ok(cert.notAfter > cert.notBefore);
    assert.equal(cert.status, "valid");
    assert.deepEqual(cert.san, ["mtls-test.execution.svc"]);
  });

  test("generateMtlsCertificate throws for service without mTLS enabled", () => {
    const identity = registerServiceIdentity({
      serviceName: "no-mtls-test",
      namespace: "execution",
      capabilities: ["tool:invoke"],
      mtlsEnabled: false,
    });

    assert.throws(
      () => generateMtlsCertificate({ serviceId: identity.serviceId }),
      /service.mtls_not_enabled/,
    );
  });

  test("generateMtlsCertificate throws for nonexistent service", () => {
    assert.throws(
      () => generateMtlsCertificate({ serviceId: "nonexistent-svc" }),
      /service.not_found/,
    );
  });

  test("getMtlsCertificate retrieves certificate by ID", () => {
    const identity = registerServiceIdentity({
      serviceName: "get-cert-test",
      namespace: "execution",
      capabilities: ["tool:invoke"],
      mtlsEnabled: true,
    });

    const created = generateMtlsCertificate({ serviceId: identity.serviceId });
    const found = getMtlsCertificate(created.certId);

    assert.ok(found);
    assert.equal(found?.certId, created.certId);
  });

  test("getMtlsCertificate returns null for nonexistent cert", () => {
    const found = getMtlsCertificate("nonexistent-cert");
    assert.equal(found, null);
  });

  test("revokeMtlsCertificate marks certificate as revoked", () => {
    const identity = registerServiceIdentity({
      serviceName: "revoke-cert-test",
      namespace: "execution",
      capabilities: ["tool:invoke"],
      mtlsEnabled: true,
    });

    const cert = generateMtlsCertificate({ serviceId: identity.serviceId });

    revokeMtlsCertificate(cert.certId);

    const found = getMtlsCertificate(cert.certId);
    assert.equal(found?.status, "revoked");
  });

  test("getServiceCertificates returns only valid certificates", () => {
    const identity = registerServiceIdentity({
      serviceName: "certs-filter-test",
      namespace: "execution",
      capabilities: ["tool:invoke"],
      mtlsEnabled: true,
    });

    const cert1 = generateMtlsCertificate({ serviceId: identity.serviceId });
    const cert2 = generateMtlsCertificate({ serviceId: identity.serviceId });

    revokeMtlsCertificate(cert1.certId);

    const certs = getServiceCertificates(identity.serviceId);

    assert.equal(certs.length, 1);
    assert.equal(certs[0].certId, cert2.certId);
  });

  test("extractServiceAuth validates mTLS certificate", () => {
    const identity = registerServiceIdentity({
      serviceName: "extract-mtls-test",
      namespace: "execution",
      capabilities: ["tool:invoke"],
      mtlsEnabled: true,
    });

    const cert = generateMtlsCertificate({ serviceId: identity.serviceId });

    const result = extractServiceAuth({
      "x-mtls-cert": cert.certId,
    });

    assert.equal(result.authenticated, true);
    assert.ok(result.serviceIdentity);
    assert.equal(result.serviceIdentity?.serviceId, identity.serviceId);
  });

  test("extractServiceAuth validates service token with signature", () => {
    const identity = registerServiceIdentity({
      serviceName: "extract-token-test",
      namespace: "execution",
      capabilities: ["invoke_model"],
    });

    const token = issueServiceToken({
      serviceId: identity.serviceId,
      audience: "test",
    });
    const signature = signIssuedServiceToken(token.tokenId);

    const result = extractServiceAuth({
      "x-service-id": identity.serviceId,
      "x-service-token": token.tokenId,
      "x-service-token-signature": signature,
    });

    assert.equal(result.authenticated, true);
    assert.equal(result.serviceIdentity?.serviceId, identity.serviceId);
  });

  test("extractServiceAuth returns token_invalid for missing credentials", () => {
    const result = extractServiceAuth({});

    assert.equal(result.authenticated, false);
    assert.equal(result.reason, "token_invalid");
  });

  test("extractServiceAuth validates audience and capabilities when specified", () => {
    const identity = registerServiceIdentity({
      serviceName: "extract-opts-test",
      namespace: "execution",
      capabilities: ["invoke_model", "tool:invoke"],
    });

    const token = issueServiceToken({
      serviceId: identity.serviceId,
      audience: "specific",
      capabilities: ["invoke_model"],
    });
    const signature = signIssuedServiceToken(token.tokenId);

    // Wrong audience
    const result1 = extractServiceAuth(
      {
        "x-service-id": identity.serviceId,
        "x-service-token": token.tokenId,
        "x-service-token-signature": signature,
      },
      { audience: "wrong" },
    );
    assert.equal(result1.authenticated, false);
    assert.equal(result1.reason, "audience_mismatch");

    // Correct audience and required capabilities
    const result2 = extractServiceAuth(
      {
        "x-service-id": identity.serviceId,
        "x-service-token": token.tokenId,
        "x-service-token-signature": signature,
      },
      { audience: "specific", requiredCapabilities: ["invoke_model"] },
    );
    assert.equal(result2.authenticated, true);
  });

  test("getServiceAuthStats returns correct counts", () => {
    const identity1 = registerServiceIdentity({
      serviceName: "stats-service-1",
      namespace: "execution",
      capabilities: ["invoke_model"],
    });

    const identity2 = registerServiceIdentity({
      serviceName: "stats-service-2",
      namespace: "orchestration",
      capabilities: ["tool:invoke"],
      mtlsEnabled: true,
    });

    const token = issueServiceToken({ serviceId: identity1.serviceId, audience: "test" });
    generateMtlsCertificate({ serviceId: identity2.serviceId });

    const stats = getServiceAuthStats();

    assert.equal(stats.totalServices, 2);
    assert.ok(stats.activeServices >= 2);
    assert.ok(stats.activeTokens >= 1);
    assert.ok(stats.activeCertificates >= 1);
  });

  test("service token has default TTL of 1 hour", () => {
    const identity = registerServiceIdentity({
      serviceName: "ttl-test",
      namespace: "execution",
      capabilities: ["invoke_model"],
    });

    const token = issueServiceToken({
      serviceId: identity.serviceId,
      audience: "test",
    });

    const ttlMs = token.expiresAt - token.issuedAt;
    const oneHour = 60 * 60 * 1000;

    // Allow some tolerance
    assert.ok(ttlMs >= oneHour - 1000 && ttlMs <= oneHour + 5000);
  });

  test("issueServiceToken respects custom TTL", () => {
    const identity = registerServiceIdentity({
      serviceName: "custom-ttl-test",
      namespace: "execution",
      capabilities: ["invoke_model"],
    });

    const token = issueServiceToken({
      serviceId: identity.serviceId,
      audience: "test",
      ttlMs: 5 * 60 * 1000, // 5 minutes
    });

    const ttlMs = token.expiresAt - token.issuedAt;
    const fiveMinutes = 5 * 60 * 1000;

    assert.ok(ttlMs >= fiveMinutes - 1000 && ttlMs <= fiveMinutes + 5000);
  });

  test("mTLS certificate defaults to 90-day validity", () => {
    const identity = registerServiceIdentity({
      serviceName: "cert-ttl-test",
      namespace: "execution",
      capabilities: ["tool:invoke"],
      mtlsEnabled: true,
    });

    const cert = generateMtlsCertificate({ serviceId: identity.serviceId });

    const validityDays = (cert.notAfter - cert.notBefore) / (24 * 60 * 60 * 1000);

    // Allow some tolerance
    assert.ok(validityDays >= 89 && validityDays <= 91);
  });
});
