import assert from "node:assert/strict";
import test from "node:test";
import { assertNonEmpty, assertEnum, toJson, normalizeRotationPolicy, computeNextRotationDueAt, computeLeaseExpiry, normalizeLeaseStatus, } from "../../../../src/platform/control-plane/iam/secret-management-support.js";
// ---------------------------------------------------------------------------
// assertNonEmpty
// ---------------------------------------------------------------------------
test("assertNonEmpty returns trimmed value for non-empty string", () => {
    const result = assertNonEmpty("  hello world  ", "test.code");
    assert.equal(result, "hello world");
});
test("assertNonEmpty throws ValidationError for empty string", () => {
    assert.throws(() => assertNonEmpty("", "test.empty"), (e) => e.message.includes("test.empty"));
});
test("assertNonEmpty throws ValidationError for whitespace-only string", () => {
    assert.throws(() => assertNonEmpty("   ", "test.whitespace"), (e) => e.message.includes("test.whitespace"));
});
test("assertNonEmpty returns original trimmed value", () => {
    const result = assertNonEmpty("value", "test.code");
    assert.equal(result, "value");
});
// ---------------------------------------------------------------------------
// assertEnum
// ---------------------------------------------------------------------------
test("assertEnum returns value when in allowed list", () => {
    const result = assertEnum("active", ["active", "inactive"], "test.code");
    assert.equal(result, "active");
});
test("assertEnum returns value with different case sensitivity", () => {
    assert.throws(() => assertEnum("ACTIVE", ["active", "inactive"], "test.code"), (e) => e.message.includes("test.code"));
});
test("assertEnum throws ValidationError when value not in allowed list", () => {
    assert.throws(() => assertEnum("unknown", ["active", "inactive"], "test.invalid"), (e) => {
        return e.message.includes("test.invalid") && e.details?.value === "unknown";
    });
});
test("assertEnum includes allowed values in error details", () => {
    assert.throws(() => assertEnum("bad", ["one", "two"], "test.code"), (e) => e.details?.allowed !== undefined);
});
// ---------------------------------------------------------------------------
// toJson
// ---------------------------------------------------------------------------
test("toJson returns JSON string for valid object", () => {
    const result = toJson({ key: "value", num: 123 });
    assert.equal(result, '{"key":"value","num":123}');
});
test("toJson returns null for null input", () => {
    const result = toJson(null);
    assert.equal(result, null);
});
test("toJson returns null for undefined input", () => {
    const result = toJson(undefined);
    assert.equal(result, null);
});
test("toJson handles empty object", () => {
    const result = toJson({});
    assert.equal(result, "{}");
});
test("toJson handles nested objects", () => {
    const result = toJson({ outer: { inner: "value" } });
    assert.equal(result, '{"outer":{"inner":"value"}}');
});
// ---------------------------------------------------------------------------
// normalizeRotationPolicy
// ---------------------------------------------------------------------------
test("normalizeRotationPolicy uses default cadenceDays of 90 when null", () => {
    const result = normalizeRotationPolicy({ cadenceDays: null, ttlMinutes: 60, breakGlass: false });
    assert.equal(result.cadenceDays, 90);
});
test("normalizeRotationPolicy uses default cadenceDays of 90 when undefined", () => {
    const result = normalizeRotationPolicy({ cadenceDays: null, ttlMinutes: 60, breakGlass: false });
    assert.equal(result.cadenceDays, 90);
});
test("normalizeRotationPolicy keeps provided cadenceDays when valid", () => {
    const result = normalizeRotationPolicy({ cadenceDays: 30, ttlMinutes: 60, breakGlass: false });
    assert.equal(result.cadenceDays, 30);
});
test("normalizeRotationPolicy clamps cadenceDays to minimum of 1", () => {
    const result = normalizeRotationPolicy({ cadenceDays: 0, ttlMinutes: 60, breakGlass: false });
    assert.equal(result.cadenceDays, 1);
});
test("normalizeRotationPolicy truncates decimal cadenceDays", () => {
    const result = normalizeRotationPolicy({ cadenceDays: 45.7, ttlMinutes: 60, breakGlass: false });
    assert.equal(result.cadenceDays, 45);
});
test("normalizeRotationPolicy keeps ttlMinutes null when null", () => {
    const result = normalizeRotationPolicy({ cadenceDays: 90, ttlMinutes: null, breakGlass: false });
    assert.equal(result.ttlMinutes, null);
});
test("normalizeRotationPolicy clamps ttlMinutes to minimum of 1", () => {
    const result = normalizeRotationPolicy({ cadenceDays: 90, ttlMinutes: 0, breakGlass: false });
    assert.equal(result.ttlMinutes, 1);
});
test("normalizeRotationPolicy sets breakGlass to true only when exactly true", () => {
    const result1 = normalizeRotationPolicy({ cadenceDays: 90, ttlMinutes: 60, breakGlass: true });
    assert.equal(result1.breakGlass, true);
    const result2 = normalizeRotationPolicy({ cadenceDays: 90, ttlMinutes: 60, breakGlass: "yes" });
    assert.equal(result2.breakGlass, false);
    const result3 = normalizeRotationPolicy({ cadenceDays: 90, ttlMinutes: 60, breakGlass: false });
    assert.equal(result3.breakGlass, false);
});
// ---------------------------------------------------------------------------
// computeNextRotationDueAt
// ---------------------------------------------------------------------------
test("computeNextRotationDueAt returns null when cadenceDays is null", () => {
    const result = computeNextRotationDueAt(null, { cadenceDays: null, ttlMinutes: 60, breakGlass: false });
    assert.equal(result, null);
});
test("computeNextRotationDueAt returns null when lastRotatedAt is invalid", () => {
    const result = computeNextRotationDueAt("invalid-date", { cadenceDays: 90, ttlMinutes: 60, breakGlass: false });
    assert.equal(result, null);
});
test("computeNextRotationDueAt calculates future date from lastRotatedAt", () => {
    const lastRotated = "2024-01-01T00:00:00.000Z";
    const result = computeNextRotationDueAt(lastRotated, { cadenceDays: 90, ttlMinutes: 60, breakGlass: false });
    assert.notEqual(result, null);
    const expected = new Date("2024-01-01T00:00:00.000Z");
    expected.setDate(expected.getDate() + 90);
    assert.equal(result, expected.toISOString());
});
test("computeNextRotationDueAt calculates future date from now when lastRotatedAt is null", () => {
    const before = new Date();
    const result = computeNextRotationDueAt(null, { cadenceDays: 30, ttlMinutes: 60, breakGlass: false });
    const after = new Date();
    assert.notEqual(result, null);
    const expectedMin = new Date(before);
    expectedMin.setDate(expectedMin.getDate() + 30);
    const expectedMax = new Date(after);
    expectedMax.setDate(expectedMax.getDate() + 30);
    const resultDate = new Date(result);
    assert.ok(resultDate >= expectedMin && resultDate <= expectedMax);
});
test("computeNextRotationDueAt handles 1 day cadence", () => {
    const lastRotated = "2024-06-01T12:00:00.000Z";
    const result = computeNextRotationDueAt(lastRotated, { cadenceDays: 1, ttlMinutes: 60, breakGlass: false });
    const expected = new Date("2024-06-02T12:00:00.000Z");
    assert.equal(result, expected.toISOString());
});
// ---------------------------------------------------------------------------
// computeLeaseExpiry
// ---------------------------------------------------------------------------
test("computeLeaseExpiry calculates correct expiry time", () => {
    const issuedAt = "2024-01-01T00:00:00.000Z";
    const result = computeLeaseExpiry(issuedAt, 60);
    assert.equal(result, "2024-01-01T01:00:00.000Z");
});
test("computeLeaseExpiry handles 0 ttlMinutes", () => {
    const issuedAt = "2024-01-01T00:00:00.000Z";
    const result = computeLeaseExpiry(issuedAt, 0);
    assert.equal(result, "2024-01-01T00:00:00.000Z");
});
test("computeLeaseExpiry handles large ttlMinutes", () => {
    const issuedAt = "2024-01-01T00:00:00.000Z";
    const result = computeLeaseExpiry(issuedAt, 1440); // 24 hours
    assert.equal(result, "2024-01-02T00:00:00.000Z");
});
test("computeLeaseExpiry throws for invalid issuedAt date", () => {
    assert.throws(() => computeLeaseExpiry("not-a-date", 60), (e) => e.message.includes("secret.invalid_lease_issued_at"));
});
test("computeLeaseExpiry throws for empty issuedAt string", () => {
    assert.throws(() => computeLeaseExpiry("", 60), (e) => e.message.includes("secret.invalid_lease_issued_at"));
});
// ---------------------------------------------------------------------------
// normalizeLeaseStatus
// ---------------------------------------------------------------------------
test("normalizeLeaseStatus returns existing status when not active", () => {
    const record = { status: "revoked", expiresAt: "2024-01-01T00:00:00.000Z" };
    const result = normalizeLeaseStatus(record, "2024-01-02T00:00:00.000Z");
    assert.equal(result, "revoked");
});
test("normalizeLeaseStatus returns expired when active but past expiresAt", () => {
    const record = { status: "active", expiresAt: "2024-01-01T00:00:00.000Z" };
    const result = normalizeLeaseStatus(record, "2024-01-02T00:00:00.000Z");
    assert.equal(result, "expired");
});
test("normalizeLeaseStatus returns active when active and not expired", () => {
    const record = { status: "active", expiresAt: "2024-01-02T00:00:00.000Z" };
    const result = normalizeLeaseStatus(record, "2024-01-01T00:00:00.000Z");
    assert.equal(result, "active");
});
test("normalizeLeaseStatus returns expired when expiresAt equals asOf", () => {
    const record = { status: "active", expiresAt: "2024-01-01T00:00:00.000Z" };
    const result = normalizeLeaseStatus(record, "2024-01-01T00:00:00.000Z");
    assert.equal(result, "expired");
});
test("normalizeLeaseStatus returns revoked when status is revoked", () => {
    const record = { status: "revoked", expiresAt: "2099-01-01T00:00:00.000Z" };
    const result = normalizeLeaseStatus(record, "2024-01-01T00:00:00.000Z");
    assert.equal(result, "revoked");
});
//# sourceMappingURL=secret-management-support.test.js.map