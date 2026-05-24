/**
 * Knowledge Access Control Tests
 *
 * Tests for §50 knowledge domain isolation access control:
 * - Anonymous principal access (null principal)
 * - Cross-domain reader role validation
 * - Privilege requirement reason codes
 *
 * Architecture: §50 Knowledge Domain Isolation
 */

import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeAccessControl, type KnowledgeAccessPrincipal } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/governance/access-control.js";
import type { KnowledgeNamespace } from "../../../../../../src/platform/five-plane-state-evidence/knowledge/knowledge-model.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createNamespace(overrides: Partial<KnowledgeNamespace> = {}): KnowledgeNamespace {
  return {
    namespaceId: "ns_test",
    path: "test.domain.example",
    description: "Test namespace",
    ownerDomainId: "domain_test",
    accessPolicy: "restricted",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "on_access",
      refreshIntervalHours: null,
    },
    trustLevel: "authoritative",
    maxDocuments: 1000,
    maxTotalSizeBytes: 10 * 1024 * 1024,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Anonymous Principal Access Tests
// ─────────────────────────────────────────────────────────────────────────────

test("KnowledgeAccessControl allows public namespace read with null principal", () => {
  const control = new KnowledgeAccessControl();
  const namespace = createNamespace({ accessPolicy: "public" });

  const decision = control.checkAccess(namespace, { action: "read", principal: null });

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "knowledge.access.public");
  assert.equal(decision.principalDomainId, null);
});

test("KnowledgeAccessControl denies restricted namespace read with null principal", () => {
  const control = new KnowledgeAccessControl();
  const namespace = createNamespace({ accessPolicy: "restricted" });

  const decision = control.checkAccess(namespace, { action: "read", principal: null });

  assert.equal(decision.allowed, false);
  // With null principal, crossDomain is false, so it returns same_domain_privilege_required
  assert.equal(decision.reasonCode, "knowledge.access.same_domain_privilege_required");
});

test("KnowledgeAccessControl denies write with null principal on restricted namespace", () => {
  const control = new KnowledgeAccessControl();
  const namespace = createNamespace({ accessPolicy: "restricted" });

  const decision = control.checkAccess(namespace, { action: "write", principal: null });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "knowledge.access.same_domain_privilege_required");
});

test("KnowledgeAccessControl returns null principalId with null principal", () => {
  const control = new KnowledgeAccessControl();
  const namespace = createNamespace({ accessPolicy: "public" });

  const decision = control.checkAccess(namespace, { action: "read", principal: null });

  assert.equal(decision.principalId, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-Domain Access Tests
// ─────────────────────────────────────────────────────────────────────────────

test("KnowledgeAccessControl allows cross-domain read with cross_domain_reader role", () => {
  const control = new KnowledgeAccessControl();
  const namespace = createNamespace({
    ownerDomainId: "domain_a",
    accessPolicy: "restricted",
  });

  const principal: KnowledgeAccessPrincipal = {
    principalId: "user-123",
    domainId: "domain_b",
    roles: ["cross_domain_reader"],
  };

  const decision = control.checkAccess(namespace, { action: "read", principal });

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "knowledge.access.cross_domain_reader");
  assert.equal(decision.crossDomain, true);
});

test("KnowledgeAccessControl denies cross-domain read without cross_domain_reader role", () => {
  const control = new KnowledgeAccessControl();
  const namespace = createNamespace({
    ownerDomainId: "domain_a",
    accessPolicy: "restricted",
  });

  const principal: KnowledgeAccessPrincipal = {
    principalId: "user-123",
    domainId: "domain_b",
    roles: ["reader"], // Has reader but not cross_domain_reader
  };

  const decision = control.checkAccess(namespace, { action: "read", principal });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "knowledge.access.cross_domain_denied");
});

test("KnowledgeAccessControl allows explicit namespace permission override", () => {
  const control = new KnowledgeAccessControl();
  const namespace = createNamespace({
    path: "specific.namespace",
    accessPolicy: "restricted",
  });

  const principal: KnowledgeAccessPrincipal = {
    principalId: "user-456",
    domainId: "other_domain",
    roles: ["reader"],
    permittedNamespaces: ["specific.namespace"],
  };

  const decision = control.checkAccess(namespace, { action: "read", principal });

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "knowledge.access.explicit_override");
  assert.equal(decision.crossDomain, true);
});

test("KnowledgeAccessControl admin role bypasses all checks", () => {
  const control = new KnowledgeAccessControl();
  const namespace = createNamespace({ accessPolicy: "restricted", ownerDomainId: "domain_admin_owner" });

  // Use same domain as owner to get admin reason code (not crossDomain)
  const principal: KnowledgeAccessPrincipal = {
    principalId: "admin-user",
    domainId: "domain_admin_owner", // Same as ownerDomainId
    roles: ["admin"],
    // No permittedNamespaces - pure admin role test
  };

  const decision = control.checkAccess(namespace, { action: "write", principal });

  assert.equal(decision.allowed, true);
  // With same domain, crossDomain is false, so reason is "admin"
  assert.equal(decision.reasonCode, "knowledge.access.admin");
});

// ─────────────────────────────────────────────────────────────────────────────
// Reason Code Tests
// ─────────────────────────────────────────────────────────────────────────────

test("KnowledgeAccessControl returns correct reasonCode for public policy", () => {
  const control = new KnowledgeAccessControl();
  const namespace = createNamespace({ accessPolicy: "public" });

  // With public policy and null principal, read is allowed (returns public reason)
  const decision = control.checkAccess(namespace, { action: "read", principal: null });

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "knowledge.access.public");
});

test("KnowledgeAccessControl returns correct reasonCode for restricted same-domain", () => {
  const control = new KnowledgeAccessControl();
  const namespace = createNamespace({ accessPolicy: "restricted" });

  const decision = control.checkAccess(namespace, { action: "read", principal: null });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "knowledge.access.same_domain_privilege_required");
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("KnowledgeAccessControl handles empty roles array", () => {
  const control = new KnowledgeAccessControl();
  const namespace = createNamespace({ ownerDomainId: "domain_a", accessPolicy: "restricted" });

  const principal: KnowledgeAccessPrincipal = {
    principalId: "user-123",
    domainId: "domain_a",
    roles: [],
  };

  const decision = control.checkAccess(namespace, { action: "read", principal });

  assert.equal(decision.allowed, false); // No reader role
});

test("KnowledgeAccessControl canRead is shorthand for checkAccess read", () => {
  const control = new KnowledgeAccessControl();
  const namespace = createNamespace({ accessPolicy: "public", ownerDomainId: "domain_test" });

  const canRead = control.canRead(namespace, "domain_test");

  assert.equal(canRead, true);
});

test("KnowledgeAccessControl canRead returns false for restricted namespace", () => {
  const control = new KnowledgeAccessControl();
  const namespace = createNamespace({ accessPolicy: "restricted", ownerDomainId: "domain_a" });

  const canRead = control.canRead(namespace, "domain_b");

  assert.equal(canRead, false);
});
