/**
 * Unit tests for Marketplace core barrel exports
 *
 * @see src/scale-ecosystem/marketplace/index.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as marketplace from "../../../src/scale-ecosystem/marketplace/index.js";
test("marketplace barrel does not re-export extracted billing, tenant, enterprise, or intelligence modules", () => {
    const keys = Object.keys(marketplace).map((key) => key.toLowerCase());
    assert.equal(keys.some((key) => key.includes("billing")), false);
    assert.equal(keys.some((key) => key.includes("tenant")), false);
    assert.equal(keys.some((key) => key.includes("compliance")), false);
    assert.equal(keys.some((key) => key.includes("enterprise")), false);
    assert.equal(keys.some((key) => key.includes("license")), false);
    assert.equal(keys.some((key) => key.includes("pmf")), false);
    assert.equal(keys.some((key) => key.includes("operator")), false);
});
test("marketplace barrel exports certification", () => {
    const keys = Object.keys(marketplace);
    assert.ok(keys.some((key) => key.toLowerCase().includes("certification")));
});
test("marketplace barrel exports marketplace governance", () => {
    const keys = Object.keys(marketplace);
    assert.ok(keys.some((key) => key.toLowerCase().includes("marketplacegovernance") || key.toLowerCase().includes("governance")));
});
test("marketplace barrel exports pack security", () => {
    const keys = Object.keys(marketplace);
    assert.ok(keys.some((key) => key.toLowerCase().includes("packsecurity") || key.toLowerCase().includes("security")));
});
test("marketplace barrel exports publisher", () => {
    const keys = Object.keys(marketplace);
    assert.ok(keys.some((key) => key.toLowerCase().includes("publisher")));
});
test("marketplace barrel exports catalog helpers", () => {
    const keys = Object.keys(marketplace);
    assert.ok(keys.some((key) => key.toLowerCase().includes("catalog") || key.includes("Schema")));
    assert.ok(keys.some((key) => key.toLowerCase().includes("sortcatalog") || key.toLowerCase().includes("sort")));
});
test("marketplace barrel remains a focused core surface", () => {
    const keys = Object.keys(marketplace);
    assert.ok(keys.length >= 5);
    assert.ok(keys.length < 30);
});
//# sourceMappingURL=marketplace.test.js.map