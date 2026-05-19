/**
 * Unit tests for namespace-policy
 */
import assert from "node:assert/strict";
import test from "node:test";
import { NamespacePolicyStore, DEFAULT_NAMESPACE_STRATEGY, } from "../../../../../../src/platform/state-evidence/knowledge/governance/namespace-policy.js";
function createTestNamespace(overrides) {
    return {
        namespaceId: "ns_001",
        path: "test.domain",
        description: "Test namespace for unit testing",
        ownerDomainId: "domain_test",
        accessPolicy: "public",
        freshnessPolicy: {
            maxAgeDays: 30,
            staleAction: "warn",
            refreshStrategy: "manual",
            refreshIntervalHours: null,
        },
        trustLevel: "verified",
        maxDocuments: 1000,
        maxTotalSizeBytes: 10 * 1024 * 1024,
        ...overrides,
    };
}
test("NamespacePolicyStore registers a valid namespace", () => {
    const store = new NamespacePolicyStore();
    const ns = createTestNamespace();
    const result = store.register(ns);
    assert.equal(result.path, "test.domain");
    assert.equal(store.get("test.domain")?.path, "test.domain");
});
test("NamespacePolicyStore returns null for unregistered namespace", () => {
    const store = new NamespacePolicyStore();
    const result = store.get("nonexistent.path");
    assert.equal(result, null);
});
test("NamespacePolicyStore list returns all registered namespaces", () => {
    const store = new NamespacePolicyStore();
    store.register(createTestNamespace({ path: "domain.alpha" }));
    store.register(createTestNamespace({ path: "domain.beta" }));
    const namespaces = store.list();
    assert.equal(namespaces.length, 2);
});
test("NamespacePolicyStore validate returns valid for proper namespace", () => {
    const store = new NamespacePolicyStore();
    const ns = createTestNamespace();
    const result = store.validate(ns);
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
    assert.ok(result.namespace != null);
});
test("NamespacePolicyStore validate returns errors for invalid namespace", () => {
    const store = new NamespacePolicyStore();
    const invalidNs = {
        namespaceId: "ns_invalid",
        path: "",
        description: "Invalid namespace",
        ownerDomainId: "domain_test",
        accessPolicy: "public",
        freshnessPolicy: {
            maxAgeDays: -5,
            staleAction: "invalid_action",
            refreshStrategy: "manual",
            refreshIntervalHours: null,
        },
        trustLevel: "verified",
        maxDocuments: 100,
        maxTotalSizeBytes: 1000,
    };
    const result = store.validate(invalidNs);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
    assert.equal(result.namespace, null);
});
test("NamespacePolicyStore validate returns errors for null namespace", () => {
    const store = new NamespacePolicyStore();
    const result = store.validate(null);
    assert.equal(result.valid, false);
    assert.ok(result.errors.includes("Namespace must be a non-null object"));
});
test("NamespacePolicyStore validate returns errors for non-object namespace", () => {
    const store = new NamespacePolicyStore();
    const result = store.validate("not an object");
    assert.equal(result.valid, false);
    assert.ok(result.errors.includes("Namespace must be a non-null object"));
});
test("NamespacePolicyStore validate returns error for invalid path format", () => {
    const store = new NamespacePolicyStore();
    const ns = createTestNamespace({ path: "Invalid.Path" }); // starts with uppercase
    const result = store.validate(ns);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes("Invalid namespace path format")));
});
test("NamespacePolicyStore validate accepts valid dot-separated path", () => {
    const store = new NamespacePolicyStore();
    const ns = createTestNamespace({ path: "finance.payments.reports" });
    const result = store.validate(ns);
    assert.equal(result.valid, true);
});
test("NamespacePolicyStore validate accepts valid slash-separated path", () => {
    const store = new NamespacePolicyStore();
    const ns = createTestNamespace({ path: "test/file-default" });
    const result = store.validate(ns);
    assert.equal(result.valid, true);
});
test("NamespacePolicyStore validate warns for restricted namespace with unverified trust", () => {
    const store = new NamespacePolicyStore();
    const ns = createTestNamespace({
        accessPolicy: "restricted",
        trustLevel: "unverified",
    });
    const result = store.validate(ns);
    assert.equal(result.valid, true);
    assert.ok(result.warnings.some((w) => w.includes("Restricted namespace with unverified trust level")));
});
test("NamespacePolicyStore detectPathConflicts finds exact match", () => {
    const store = new NamespacePolicyStore();
    store.register(createTestNamespace({ path: "domain.exact" }));
    const conflicts = store.detectPathConflicts("domain.exact");
    assert.equal(conflicts.length, 1);
    const conflict = conflicts[0];
    assert.ok(conflict);
    assert.equal(conflict.overlapType, "exact");
    assert.equal(conflict.resolution, "reject");
});
test("NamespacePolicyStore detectPathConflicts finds prefix conflict", () => {
    const store = new NamespacePolicyStore();
    store.register(createTestNamespace({ path: "domain.parent" }));
    const conflicts = store.detectPathConflicts("domain.parent.child");
    assert.equal(conflicts.length, 1);
    const conflict = conflicts[0];
    assert.ok(conflict);
    assert.equal(conflict.overlapType, "prefix");
});
test("NamespacePolicyStore detectPathConflicts finds sibling paths", () => {
    const store = new NamespacePolicyStore();
    store.register(createTestNamespace({ path: "domain.parent.sibling1" }));
    const conflicts = store.detectPathConflicts("domain.parent.sibling2");
    assert.equal(conflicts.length, 1);
    const conflict = conflicts[0];
    assert.ok(conflict);
    assert.equal(conflict.overlapType, "sibling");
    assert.equal(conflict.resolution, "allow");
});
test("NamespacePolicyStore detectPathConflicts returns empty when no conflicts", () => {
    const store = new NamespacePolicyStore();
    store.register(createTestNamespace({ path: "domain.alpha" }));
    // domain.beta is a sibling of domain.alpha (same parent "domain")
    // so it returns a sibling conflict, not empty
    const conflicts = store.detectPathConflicts("other.domain.beta");
    assert.equal(conflicts.length, 0);
});
test("NamespacePolicyStore canAccessCrossNamespace returns false when disabled", () => {
    const store = new NamespacePolicyStore({
        crossNamespaceRetrieval: false,
    });
    const source = createTestNamespace({ trustLevel: "verified" });
    const target = createTestNamespace({ path: "other.domain", trustLevel: "verified" });
    const result = store.canAccessCrossNamespace(source, target);
    assert.equal(result, false);
});
test("NamespacePolicyStore canAccessCrossNamespace checks trust level", () => {
    const store = new NamespacePolicyStore({
        minTrustLevelForCrossDomain: "reviewed",
    });
    const source = createTestNamespace({ trustLevel: "unverified" });
    const target = createTestNamespace({ path: "other.domain", trustLevel: "verified" });
    const result = store.canAccessCrossNamespace(source, target);
    assert.equal(result, false);
});
test("NamespacePolicyStore canAccessCrossNamespace allows sufficient trust level", () => {
    const store = new NamespacePolicyStore({
        minTrustLevelForCrossDomain: "reviewed",
    });
    const source = createTestNamespace({ trustLevel: "verified" });
    const target = createTestNamespace({ path: "other.domain", trustLevel: "verified" });
    const result = store.canAccessCrossNamespace(source, target);
    assert.equal(result, true);
});
test("NamespacePolicyStore getByDomain filters correctly", () => {
    const store = new NamespacePolicyStore();
    store.register(createTestNamespace({ path: "domain.a", ownerDomainId: "domain_1" }));
    store.register(createTestNamespace({ path: "domain.b", ownerDomainId: "domain_2" }));
    store.register(createTestNamespace({ path: "domain.c", ownerDomainId: "domain_1" }));
    const results = store.getByDomain("domain_1");
    assert.equal(results.length, 2);
    assert.ok(results.every((ns) => ns.ownerDomainId === "domain_1"));
});
test("NamespacePolicyStore isStale detects stale namespace", () => {
    const store = new NamespacePolicyStore();
    const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(); // 100 days ago
    const ns = createTestNamespace({
        freshnessPolicy: {
            maxAgeDays: 30,
            staleAction: "warn",
            refreshStrategy: "manual",
            refreshIntervalHours: null,
        },
    });
    const result = store.isStale(ns, oldDate);
    assert.equal(result, true);
});
test("NamespacePolicyStore isStale detects fresh namespace", () => {
    const store = new NamespacePolicyStore();
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(); // 1 day ago
    const ns = createTestNamespace({
        freshnessPolicy: {
            maxAgeDays: 30,
            staleAction: "warn",
            refreshStrategy: "manual",
            refreshIntervalHours: null,
        },
    });
    const result = store.isStale(ns, recentDate);
    assert.equal(result, false);
});
test("NamespacePolicyStore getStrategyConfig returns configuration", () => {
    const store = new NamespacePolicyStore({
        strictIsolation: true,
    });
    const config = store.getStrategyConfig();
    assert.equal(config.strictIsolation, true);
    assert.equal(config.crossNamespaceRetrieval, DEFAULT_NAMESPACE_STRATEGY.crossNamespaceRetrieval);
});
test("NamespacePolicyStore updateStrategy modifies configuration", () => {
    const store = new NamespacePolicyStore();
    store.updateStrategy({ strictIsolation: true });
    assert.equal(store.getStrategyConfig().strictIsolation, true);
});
test("NamespacePolicyStore with custom config merges with defaults", () => {
    const store = new NamespacePolicyStore({
        strictIsolation: true,
        enforceFreshness: false,
    });
    const config = store.getStrategyConfig();
    assert.equal(config.strictIsolation, true);
    assert.equal(config.enforceFreshness, false);
    assert.equal(config.crossNamespaceRetrieval, DEFAULT_NAMESPACE_STRATEGY.crossNamespaceRetrieval);
});
//# sourceMappingURL=namespace-policy.test.js.map