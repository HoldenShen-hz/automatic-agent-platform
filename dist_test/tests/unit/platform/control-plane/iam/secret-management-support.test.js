import assert from "node:assert/strict";
import test from "node:test";
import { assertNonEmpty, assertEnum, toJson, normalizeRotationPolicy, computeNextRotationDueAt, computeLeaseExpiry, normalizeLeaseStatus, } from "../../../../../src/platform/control-plane/iam/secret-management-support.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
test("assertNonEmpty returns trimmed value when valid", () => {
    const result = assertNonEmpty("  hello world  ", "test.code");
    assert.equal(result, "hello world");
});
test("assertNonEmpty throws ValidationError for empty string", () => {
    assert.throws(() => assertNonEmpty("", "test.empty"), (e) => e instanceof ValidationError && e.code === "test.empty");
});
test("assertNonEmpty throws ValidationError for whitespace-only string", () => {
    assert.throws(() => assertNonEmpty("   ", "test.whitespace"), (e) => e instanceof ValidationError && e.code === "test.whitespace");
});
test("assertEnum returns value when valid", () => {
    const result = assertEnum("red", ["red", "green", "blue"], "test.enum");
    assert.equal(result, "red");
});
test("assertEnum throws ValidationError for invalid value", () => {
    assert.throws(() => assertEnum("yellow", ["red", "green", "blue"], "test.invalid"), (e) => e instanceof ValidationError && e.code === "test.invalid");
});
test("toJson returns JSON string for object", () => {
    const result = toJson({ key: "value" });
    assert.equal(result, '{"key":"value"}');
});
test("toJson returns null for null", () => {
    assert.equal(toJson(null), null);
});
test("toJson returns null for undefined", () => {
    assert.equal(toJson(undefined), null);
});
test("normalizeRotationPolicy returns defaults when fields are null", () => {
    const input = {
        cadenceDays: null,
        ttlMinutes: null,
        breakGlass: false,
    };
    const result = normalizeRotationPolicy(input);
    assert.equal(result.cadenceDays, null);
    assert.equal(result.ttlMinutes, null);
    assert.equal(result.breakGlass, false);
});
test("normalizeRotationPolicy normalizes cadenceDays", () => {
    const input = {
        cadenceDays: 30.7,
        ttlMinutes: null,
        breakGlass: false,
    };
    const result = normalizeRotationPolicy(input);
    assert.equal(result.cadenceDays, 30);
});
test("normalizeRotationPolicy clamps cadenceDays to minimum 1", () => {
    const input = {
        cadenceDays: 0,
        ttlMinutes: null,
        breakGlass: false,
    };
    const result = normalizeRotationPolicy(input);
    assert.equal(result.cadenceDays, 1);
});
test("normalizeRotationPolicy clamps negative cadenceDays to 1", () => {
    const input = {
        cadenceDays: -5,
        ttlMinutes: null,
        breakGlass: false,
    };
    const result = normalizeRotationPolicy(input);
    assert.equal(result.cadenceDays, 1);
});
test("normalizeRotationPolicy normalizes ttlMinutes", () => {
    const input = {
        cadenceDays: null,
        ttlMinutes: 60.3,
        breakGlass: false,
    };
    const result = normalizeRotationPolicy(input);
    assert.equal(result.ttlMinutes, 60);
});
test("normalizeRotationPolicy clamps ttlMinutes to minimum 1", () => {
    const input = {
        cadenceDays: null,
        ttlMinutes: 0,
        breakGlass: false,
    };
    const result = normalizeRotationPolicy(input);
    assert.equal(result.ttlMinutes, 1);
});
test("normalizeRotationPolicy sets breakGlass to true when explicitly true", () => {
    const input = {
        cadenceDays: null,
        ttlMinutes: null,
        breakGlass: true,
    };
    const result = normalizeRotationPolicy(input);
    assert.equal(result.breakGlass, true);
});
test("computeNextRotationDueAt returns null when no cadence", () => {
    const policy = {
        cadenceDays: null,
        ttlMinutes: null,
        breakGlass: false,
    };
    const result = computeNextRotationDueAt(null, policy);
    assert.equal(result, null);
});
test("computeNextRotationDueAt calculates future date from null anchor", () => {
    const policy = {
        cadenceDays: 30,
        ttlMinutes: null,
        breakGlass: false,
    };
    const before = new Date();
    const result = computeNextRotationDueAt(null, policy);
    const after = new Date();
    assert.ok(result);
    const resultDate = new Date(result);
    const expectedMin = new Date(before.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expectedMax = new Date(after.getTime() + 30 * 24 * 60 * 60 * 1000);
    assert.ok(resultDate >= expectedMin && resultDate <= expectedMax);
});
test("computeNextRotationDueAt calculates future date from lastRotatedAt", () => {
    const policy = {
        cadenceDays: 1,
        ttlMinutes: null,
        breakGlass: false,
    };
    const lastRotated = "2026-04-01T00:00:00.000Z";
    const result = computeNextRotationDueAt(lastRotated, policy);
    assert.ok(result);
    const resultDate = new Date(result);
    const expected = new Date("2026-04-02T00:00:00.000Z");
    // Allow 1 second tolerance for test execution time
    assert.ok(Math.abs(resultDate.getTime() - expected.getTime()) < 1000);
});
test("computeNextRotationDueAt returns null for invalid lastRotatedAt", () => {
    const policy = {
        cadenceDays: 30,
        ttlMinutes: null,
        breakGlass: false,
    };
    const result = computeNextRotationDueAt("invalid-date", policy);
    assert.equal(result, null);
});
test("computeLeaseExpiry calculates expiration", () => {
    const issuedAt = "2026-04-14T00:00:00.000Z";
    const result = computeLeaseExpiry(issuedAt, 60);
    assert.equal(result, "2026-04-14T01:00:00.000Z"); // 60 minutes = 1 hour
});
test("computeLeaseExpiry handles large ttl", () => {
    const issuedAt = "2026-04-14T00:00:00.000Z";
    const result = computeLeaseExpiry(issuedAt, 1440); // 24 hours
    assert.equal(result, "2026-04-15T00:00:00.000Z");
});
test("computeLeaseExpiry throws for invalid issuedAt", () => {
    assert.throws(() => computeLeaseExpiry("not-a-date", 60), (e) => e instanceof ValidationError && e.code === "secret.invalid_lease_issued_at");
});
test("normalizeLeaseStatus returns record status when not active", () => {
    const record = {
        status: "revoked",
        expiresAt: "2026-04-14T00:01:00.000Z",
    };
    const result = normalizeLeaseStatus(record, "2026-04-14T00:00:30.000Z");
    assert.equal(result, "revoked");
});
test("normalizeLeaseStatus returns active when not expired", () => {
    const record = {
        status: "active",
        expiresAt: "2026-04-14T00:01:00.000Z",
    };
    const result = normalizeLeaseStatus(record, "2026-04-14T00:00:30.000Z");
    assert.equal(result, "active");
});
test("normalizeLeaseStatus returns expired when past expiresAt", () => {
    const record = {
        status: "active",
        expiresAt: "2026-04-14T00:01:00.000Z",
    };
    const result = normalizeLeaseStatus(record, "2026-04-14T00:02:00.000Z");
    assert.equal(result, "expired");
});
test("normalizeLeaseStatus returns expired when at exact expiry time", () => {
    const record = {
        status: "active",
        expiresAt: "2026-04-14T00:01:00.000Z",
    };
    const result = normalizeLeaseStatus(record, "2026-04-14T00:01:00.000Z");
    // At exact expiry time, <= returns expired
    assert.equal(result, "expired");
});
//# sourceMappingURL=secret-management-support.test.js.map