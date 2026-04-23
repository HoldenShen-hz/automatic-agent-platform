import assert from "node:assert/strict";
import test from "node:test";
import { CacheKeyFactory } from "../../../../../src/platform/shared/cache/cache-key-factory.js";
test("CacheKeyFactory.create creates key in correct format", () => {
    const key = CacheKeyFactory.create("ns", "v1", { query: "test" });
    assert.ok(key.startsWith("ns:v1:"));
    const parts = key.split(":");
    assert.equal(parts.length, 3);
});
test("CacheKeyFactory.create uses stable hash for fingerprint", () => {
    const key1 = CacheKeyFactory.create("ns", "v1", { query: "test" });
    const key2 = CacheKeyFactory.create("ns", "v1", { query: "test" });
    assert.equal(key1, key2);
});
test("CacheKeyFactory.create produces different keys for different input", () => {
    const key1 = CacheKeyFactory.create("ns", "v1", { query: "test1" });
    const key2 = CacheKeyFactory.create("ns", "v1", { query: "test2" });
    assert.notEqual(key1, key2);
});
test("CacheKeyFactory.create produces different keys for different namespace", () => {
    const key1 = CacheKeyFactory.create("ns1", "v1", { query: "test" });
    const key2 = CacheKeyFactory.create("ns2", "v1", { query: "test" });
    assert.notEqual(key1, key2);
});
test("CacheKeyFactory.create produces different keys for different version", () => {
    const key1 = CacheKeyFactory.create("ns", "v1", { query: "test" });
    const key2 = CacheKeyFactory.create("ns", "v2", { query: "test" });
    assert.notEqual(key1, key2);
});
test("CacheKeyFactory.getFingerprint extracts fingerprint", () => {
    const key = CacheKeyFactory.create("ns", "v1", { query: "test" });
    const fingerprint = CacheKeyFactory.getFingerprint(key);
    assert.ok(fingerprint !== null);
    assert.equal(fingerprint.length, 64); // SHA-256 hex
});
test("CacheKeyFactory.getFingerprint returns null for invalid key", () => {
    assert.equal(CacheKeyFactory.getFingerprint("invalid"), null);
    assert.equal(CacheKeyFactory.getFingerprint("ns:v1"), null);
});
test("CacheKeyFactory.getFingerprint handles keys with colons in fingerprint", () => {
    // SHA-256 hash doesn't contain colons, so this tests the join
    const key = "ns:v1:abc:def";
    const fingerprint = CacheKeyFactory.getFingerprint(key);
    assert.equal(fingerprint, "abc:def");
});
test("CacheKeyFactory.getVersion extracts version", () => {
    const key = CacheKeyFactory.create("ns", "v2", { query: "test" });
    assert.equal(CacheKeyFactory.getVersion(key), "v2");
});
test("CacheKeyFactory.getVersion returns null for invalid key", () => {
    assert.equal(CacheKeyFactory.getVersion("invalid"), null);
    assert.equal(CacheKeyFactory.getVersion("ns"), null);
});
test("CacheKeyFactory.getNamespace extracts namespace", () => {
    const key = CacheKeyFactory.create("my-namespace", "v1", { query: "test" });
    assert.equal(CacheKeyFactory.getNamespace(key), "my-namespace");
});
test("CacheKeyFactory.getNamespace returns empty string for key with no namespace", () => {
    // For empty string key, parts[0] is '' which is returned as-is
    assert.equal(CacheKeyFactory.getNamespace(""), "");
});
test("CacheKeyFactory.parse returns all components", () => {
    const key = CacheKeyFactory.create("ns", "v1", { query: "test" });
    const parsed = CacheKeyFactory.parse(key);
    assert.ok(parsed !== null);
    assert.equal(parsed.namespace, "ns");
    assert.equal(parsed.version, "v1");
    assert.ok(parsed.fingerprint.length === 64);
});
test("CacheKeyFactory.parse returns null for invalid key", () => {
    assert.equal(CacheKeyFactory.parse("invalid"), null);
    assert.equal(CacheKeyFactory.parse("ns:v1"), null);
    assert.equal(CacheKeyFactory.parse(""), null);
});
test("CacheKeyFactory.parse handles keys with colons in fingerprint", () => {
    const parsed = CacheKeyFactory.parse("ns:v1:abc:def");
    assert.ok(parsed !== null);
    assert.equal(parsed.namespace, "ns");
    assert.equal(parsed.version, "v1");
    assert.equal(parsed.fingerprint, "abc:def");
});
test("CacheKeyFactory roundtrip: create then parse preserves components", () => {
    const original = { data: "test", count: 42 };
    const key = CacheKeyFactory.create("namespace", "version", original);
    const parsed = CacheKeyFactory.parse(key);
    assert.ok(parsed !== null);
    assert.equal(parsed.namespace, "namespace");
    assert.equal(parsed.version, "version");
    // Verify fingerprint matches
    const expectedFingerprint = CacheKeyFactory.getFingerprint(key);
    assert.equal(parsed.fingerprint, expectedFingerprint);
});
test("CacheKeyFactory handles various input types", () => {
    const key1 = CacheKeyFactory.create("ns", "v1", "string input");
    const key2 = CacheKeyFactory.create("ns", "v1", 123);
    const key3 = CacheKeyFactory.create("ns", "v1", true);
    const key4 = CacheKeyFactory.create("ns", "v1", null);
    const key5 = CacheKeyFactory.create("ns", "v1", [1, 2, 3]);
    assert.ok(key1.startsWith("ns:v1:"));
    assert.ok(key2.startsWith("ns:v1:"));
    assert.ok(key3.startsWith("ns:v1:"));
    assert.ok(key4.startsWith("ns:v1:"));
    assert.ok(key5.startsWith("ns:v1:"));
});
//# sourceMappingURL=cache-key-factory.test.js.map