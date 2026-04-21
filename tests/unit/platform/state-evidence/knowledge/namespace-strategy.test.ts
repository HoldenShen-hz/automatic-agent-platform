/**
 * Namespace Strategy Tests
 *
 * Tests §50 knowledge domain isolation namespace policies:
 * - Namespace registration and validation
 * - Cross-namespace access control
 * - Path conflict detection
 * - Freshness policy enforcement
 * - Trust level requirements for cross-domain access
 *
 * Architecture: §50 Knowledge Domain Isolation
 */

import assert from "node:assert/strict";
import test from "node:test";

import { NamespacePolicyStore, DEFAULT_NAMESPACE_STRATEGY } from "../../../../../src/platform/state-evidence/knowledge/governance/namespace-policy.js";
import type { KnowledgeNamespace } from "../../../../../src/platform/state-evidence/knowledge/knowledge-model.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createNamespace(overrides: Partial<KnowledgeNamespace> = {}): KnowledgeNamespace {
  return {
    namespaceId: "ns_test",
    path: "test.domain.example",
    description: "Test namespace",
    ownerDomainId: "domain_test",
    accessPolicy: "public",
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "on_access",
      refreshIntervalHours: null,
    },
    trustLevel: "verified",
    maxDocuments: 1000,
    maxTotalSizeBytes: 10 * 1024 * 1024,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Namespace Registration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("NamespacePolicyStore registers valid namespace", () => {
  const store = new NamespacePolicyStore();
  const namespace = createNamespace({ path: "finance.payments" });

  const registered = store.register(namespace);

  assert.equal(registered.path, "finance.payments");
  assert.equal(store.get("finance.payments")?.path, "finance.payments");
});

test("NamespacePolicyStore rejects invalid namespace path", () => {
  const store = new NamespacePolicyStore();
  const invalidNamespace = createNamespace({ path: "Invalid/Path" });

  assert.throws(
    () => store.register(invalidNamespace as KnowledgeNamespace),
    /Invalid namespace path format/,
  );
});

test("NamespacePolicyStore rejects empty path", () => {
  const store = new NamespacePolicyStore();
  const emptyPathNamespace = createNamespace({ path: "" });

  assert.throws(
    () => store.register(emptyPathNamespace as KnowledgeNamespace),
    /Namespace path must be a non-empty string/,
  );
});

test("NamespacePolicyStore lists all registered namespaces", () => {
  const store = new NamespacePolicyStore();

  store.register(createNamespace({ path: "alpha.domain" }));
  store.register(createNamespace({ path: "beta.domain" }));
  store.register(createNamespace({ path: "gamma.domain" }));

  const all = store.list();
  assert.equal(all.length, 3);
});

test("NamespacePolicyStore returns null for non-existent path", () => {
  const store = new NamespacePolicyStore();

  const result = store.get("non.existent.path");
  assert.equal(result, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Namespace Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("validate returns valid for proper namespace", () => {
  const store = new NamespacePolicyStore();
  const namespace = createNamespace({ path: "valid.path.name" });

  const result = store.validate(namespace);

  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.namespace?.path, "valid.path.name");
});

test("validate returns errors for missing path", () => {
  const store = new NamespacePolicyStore();
  const invalid = { path: 123 } as unknown as KnowledgeNamespace;

  const result = store.validate(invalid);

  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
  assert.equal(result.namespace, null);
});

test("validate returns errors for invalid freshness policy", () => {
  const store = new NamespacePolicyStore();
  const namespace = createNamespace({
    path: "test.domain",
    freshnessPolicy: {
      maxAgeDays: -1, // Invalid: must be positive
      staleAction: "invalid_action", // Invalid enum value
      refreshStrategy: "on_access",
      refreshIntervalHours: null,
    } as unknown as KnowledgeNamespace["freshnessPolicy"],
  });

  const result = store.validate(namespace);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("maxAgeDays")));
  assert.ok(result.errors.some((e) => e.includes("staleAction")));
});

test("validate returns warning for restricted namespace with unverified trust", () => {
  const store = new NamespacePolicyStore();
  const namespace = createNamespace({
    path: "sensitive.data",
    accessPolicy: "restricted",
    trustLevel: "unverified",
  });

  const result = store.validate(namespace);

  assert.equal(result.valid, true); // Still valid
  assert.ok(result.warnings.some((w) => w.includes("unverified trust level")));
});

test("validate returns warning for path conflicts", () => {
  const store = new NamespacePolicyStore();
  store.register(createNamespace({ path: "existing.path" }));

  const conflicting = createNamespace({ path: "existing.path.child" });
  const result = store.validate(conflicting);

  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((w) => w.includes("Path conflicts detected")));
});

// ─────────────────────────────────────────────────────────────────────────────
// Path Conflict Detection Tests
// ─────────────────────────────────────────────────────────────────────────────

test("detectPathConflicts finds exact match", () => {
  const store = new NamespacePolicyStore();
  store.register(createNamespace({ path: "exact.match" }));

  const conflicts = store.detectPathConflicts("exact.match");

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].overlapType, "exact");
  assert.equal(conflicts[0].resolution, "reject");
});

test("detectPathConflicts finds prefix conflict", () => {
  const store = new NamespacePolicyStore();
  store.register(createNamespace({ path: "parent.path" }));

  const conflicts = store.detectPathConflicts("parent.path.child");

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].overlapType, "prefix");
});

test("detectPathConflicts finds sibling conflict", () => {
  const store = new NamespacePolicyStore();
  store.register(createNamespace({ path: "sibling.parent.first" }));

  const conflicts = store.detectPathConflicts("sibling.parent.second");

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].overlapType, "sibling");
  assert.equal(conflicts[0].resolution, "allow");
});

test("detectPathConflicts returns empty for unrelated paths", () => {
  const store = new NamespacePolicyStore();
  store.register(createNamespace({ path: "unrelated.path" }));

  const conflicts = store.detectPathConflicts("completely.different.path");

  assert.equal(conflicts.length, 0);
});

test("detectPathConflicts handles multiple existing namespaces", () => {
  const store = new NamespacePolicyStore();
  store.register(createNamespace({ path: "alpha.beta" }));
  store.register(createNamespace({ path: "alpha.gamma" }));
  store.register(createNamespace({ path: "delta.epsilon" }));

  const conflicts = store.detectPathConflicts("alpha.beta.child");

  assert.ok(conflicts.length >= 1);
  assert.ok(conflicts.some((c) => c.pathB === "alpha.beta" && c.overlapType === "prefix"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-Namespace Access Tests
// ─────────────────────────────────────────────────────────────────────────────

test("canAccessCrossNamespace returns true for same domain", () => {
  const store = new NamespacePolicyStore();
  const ns1 = createNamespace({ path: "domain.a", ownerDomainId: "dept_finance" });
  const ns2 = createNamespace({ path: "domain.b", ownerDomainId: "dept_finance" });

  const result = store.canAccessCrossNamespace(ns1, ns2);

  assert.equal(result, true);
});

test("canAccessCrossNamespace respects trust level", () => {
  const store = new NamespacePolicyStore();
  const lowTrust = createNamespace({
    path: "low.trust",
    ownerDomainId: "dept_a",
    trustLevel: "unverified",
  });
  const highTrust = createNamespace({
    path: "high.trust",
    ownerDomainId: "dept_b",
    trustLevel: "verified",
  });

  // With minTrustLevelForCrossDomain = "reviewed", unverified should not pass
  const result = store.canAccessCrossNamespace(lowTrust, highTrust);

  assert.equal(result, false);
});

test("canAccessCrossNamespace allows verified for cross-domain", () => {
  const store = new NamespacePolicyStore();
  const source = createNamespace({
    path: "verified.source",
    ownerDomainId: "dept_a",
    trustLevel: "verified",
  });
  const target = createNamespace({
    path: "verified.target",
    ownerDomainId: "dept_b",
    trustLevel: "reviewed",
  });

  const result = store.canAccessCrossNamespace(source, target);

  assert.equal(result, true); // verified >= reviewed
});

test("canAccessCrossNamespace disabled when crossNamespaceRetrieval is false", () => {
  const store = new NamespacePolicyStore({
    crossNamespaceRetrieval: false,
  });
  const ns1 = createNamespace({ path: "a.b", ownerDomainId: "dept_a", trustLevel: "verified" });
  const ns2 = createNamespace({ path: "c.d", ownerDomainId: "dept_b", trustLevel: "verified" });

  const result = store.canAccessCrossNamespace(ns1, ns2);

  assert.equal(result, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Freshness Policy Tests
// ─────────────────────────────────────────────────────────────────────────────

test("isStale returns false for recent update", () => {
  const store = new NamespacePolicyStore();
  const namespace = createNamespace({
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "on_access",
      refreshIntervalHours: null,
    },
  });

  const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 1 day ago
  const result = store.isStale(namespace, recentDate);

  assert.equal(result, false);
});

test("isStale returns true for outdated content", () => {
  const store = new NamespacePolicyStore();
  const namespace = createNamespace({
    freshnessPolicy: {
      maxAgeDays: 30,
      staleAction: "warn",
      refreshStrategy: "on_access",
      refreshIntervalHours: null,
    },
  });

  const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(); // 31 days ago
  const result = store.isStale(namespace, oldDate);

  assert.equal(result, true);
});

test("isStale respects different maxAgeDays settings", () => {
  const store = new NamespacePolicyStore();

  const shortMaxAge = createNamespace({
    freshnessPolicy: {
      maxAgeDays: 1, // 1 day
      staleAction: "demote",
      refreshStrategy: "scheduled",
      refreshIntervalHours: 12,
    },
  });

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(store.isStale(shortMaxAge, twoDaysAgo), true);

  const halfDayAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  assert.equal(store.isStale(shortMaxAge, halfDayAgo), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Domain Filtering Tests
// ─────────────────────────────────────────────────────────────────────────────

test("getByDomain returns namespaces owned by domain", () => {
  const store = new NamespacePolicyStore();

  store.register(createNamespace({ path: "a.first", ownerDomainId: "dept_finance" }));
  store.register(createNamespace({ path: "a.second", ownerDomainId: "dept_finance" }));
  store.register(createNamespace({ path: "a.third", ownerDomainId: "dept_hr" }));

  const financeNamespaces = store.getByDomain("dept_finance");

  assert.equal(financeNamespaces.length, 2);
  assert.ok(financeNamespaces.every((ns) => ns.ownerDomainId === "dept_finance"));
});

test("getByDomain returns empty array for domain with no namespaces", () => {
  const store = new NamespacePolicyStore();

  store.register(createNamespace({ path: "some.path", ownerDomainId: "dept_finance" }));

  const result = store.getByDomain("dept_unknown");

  assert.equal(result.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Strategy Configuration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Default strategy has correct configuration", () => {
  const store = new NamespacePolicyStore();
  const config = store.getStrategyConfig();

  assert.equal(config.strictIsolation, DEFAULT_NAMESPACE_STRATEGY.strictIsolation);
  assert.equal(config.crossNamespaceRetrieval, DEFAULT_NAMESPACE_STRATEGY.crossNamespaceRetrieval);
  assert.equal(config.enforceFreshness, DEFAULT_NAMESPACE_STRATEGY.enforceFreshness);
  assert.equal(config.minTrustLevelForCrossDomain, DEFAULT_NAMESPACE_STRATEGY.minTrustLevelForCrossDomain);
});

test("Custom strategy config overrides defaults", () => {
  const store = new NamespacePolicyStore({
    strictIsolation: true,
    crossNamespaceRetrieval: false,
  });

  const config = store.getStrategyConfig();

  assert.equal(config.strictIsolation, true);
  assert.equal(config.crossNamespaceRetrieval, false);
});

test("updateStrategy modifies configuration", () => {
  const store = new NamespacePolicyStore();

  store.updateStrategy({
    minTrustLevelForCrossDomain: "verified",
  });

  const config = store.getStrategyConfig();
  assert.equal(config.minTrustLevelForCrossDomain, "verified");
});

test("Strict isolation affects prefix conflict resolution", () => {
  const storeNormal = new NamespacePolicyStore({ strictIsolation: false });
  const storeStrict = new NamespacePolicyStore({ strictIsolation: true });

  storeNormal.register(createNamespace({ path: "parent" }));
  storeStrict.register(createNamespace({ path: "parent" }));

  const conflictsNormal = storeNormal.detectPathConflicts("parent.child");
  const conflictsStrict = storeStrict.detectPathConflicts("parent.child");

  // Normal mode: allow prefix conflicts
  assert.equal(conflictsNormal.length, 1);
  assert.equal(conflictsNormal[0].resolution, "allow");

  // Strict mode: reject prefix conflicts
  assert.equal(conflictsStrict.length, 1);
  assert.equal(conflictsStrict[0].resolution, "reject");
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("Validates namespace with all trust levels", () => {
  const store = new NamespacePolicyStore();

  const trustLevels = ["verified", "reviewed", "community", "unverified"] as const;

  for (const level of trustLevels) {
    const namespace = createNamespace({
      path: `test.${level}`,
      trustLevel: level,
    });
    const result = store.validate(namespace);
    assert.equal(result.valid, true, `Should be valid for trust level: ${level}`);
  }
});

test("Handles namespace with no freshness policy gracefully", () => {
  const store = new NamespacePolicyStore();
  const namespace = createNamespace({
    freshnessPolicy: {
      maxAgeDays: 0, // Edge case
      staleAction: "warn",
      refreshStrategy: "manual",
      refreshIntervalHours: null,
    } as KnowledgeNamespace["freshnessPolicy"],
  });

  // maxAgeDays of 0 should fail validation
  const result = store.validate(namespace);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("maxAgeDays")));
});

test("Path validation requires lowercase", () => {
  const store = new NamespacePolicyStore();
  const upperCase = createNamespace({ path: "UPPERCASE.PATH" });

  assert.throws(
    () => store.register(upperCase),
    /Invalid namespace path format/,
  );
});

test("Path validation requires alphanumeric with dots", () => {
  const store = new NamespacePolicyStore();

  assert.throws(
    () => store.register(createNamespace({ path: "has_underscore.path" })),
    /Invalid namespace path format/,
  );

  assert.throws(
    () => store.register(createNamespace({ path: "has-special.chars" })),
    /Invalid namespace path format/,
  );
});

test("Multiple capabilities with mixed trust levels", () => {
  const store = new NamespacePolicyStore();

  store.register(createNamespace({ path: "low.trust", trustLevel: "unverified" }));
  store.register(createNamespace({ path: "high.trust", trustLevel: "verified" }));

  const lowNs = store.get("low.trust");
  const highNs = store.get("high.trust");

  assert.ok(lowNs);
  assert.ok(highNs);

  // Cross-access should be denied for unverified
  const accessResult = store.canAccessCrossNamespace(lowNs!, highNs!);
  assert.equal(accessResult, false);
});