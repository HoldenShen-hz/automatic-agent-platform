import assert from "node:assert/strict";
import test from "node:test";

import {
  assertNonEmpty,
  assertEnum,
  toJson,
  normalizeRotationPolicy,
  computeNextRotationDueAt,
  computeLeaseExpiry,
  normalizeLeaseStatus,
} from "../../../../src/platform/five-plane-control-plane/iam/secret-management-support.js";
import type { SecretLeaseRecord } from "../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// assertNonEmpty
// ---------------------------------------------------------------------------

test("assertNonEmpty returns trimmed value for non-empty string", () => {
  const result = assertNonEmpty("  hello world  ", "test.code");
  assert.equal(result, "hello world");
});

test("assertNonEmpty throws ValidationError for empty string", () => {
  assert.throws(
    () => assertNonEmpty("", "test.empty"),
    (e: any) => e.code === "test.empty",
  );
});

test("assertNonEmpty throws ValidationError for whitespace-only string", () => {
  assert.throws(
    () => assertNonEmpty("   ", "test.whitespace"),
    (e: any) => e.code === "test.whitespace",
  );
});

test("assertNonEmpty returns original trimmed value", () => {
  const result = assertNonEmpty("value", "test.code");
  assert.equal(result, "value");
});

test("assertNonEmpty handles single character", () => {
  const result = assertNonEmpty("x", "test.char");
  assert.equal(result, "x");
});

// ---------------------------------------------------------------------------
// assertEnum
// ---------------------------------------------------------------------------

test("assertEnum returns value when in allowed list", () => {
  const result = assertEnum("active", ["active", "inactive"] as const, "test.code");
  assert.equal(result, "active");
});

test("assertEnum throws ValidationError when value not in allowed list", () => {
  assert.throws(
    () => assertEnum("unknown", ["active", "inactive"] as const, "test.invalid"),
    (e: any) => e.code === "test.invalid" && e.details?.value === "unknown",
  );
});

test("assertEnum includes allowed values in error details", () => {
  assert.throws(
    () => assertEnum("bad", ["one", "two"] as const, "test.code"),
    (e: any) => Array.isArray(e.details?.allowed) && e.details.allowed.length === 2,
  );
});

test("assertEnum works with all SecretStatus values", () => {
  const statuses = ["active", "rotating", "disabled", "revoked"] as const;
  for (const status of statuses) {
    const result = assertEnum(status, statuses, "test.status");
    assert.equal(result, status);
  }
});

test("assertEnum works with all SecretRotationMode values", () => {
  const modes = ["scheduled", "emergency"] as const;
  for (const mode of modes) {
    const result = assertEnum(mode, modes, "test.mode");
    assert.equal(result, mode);
  }
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

test("toJson handles arrays in objects", () => {
  const result = toJson({ items: ["a", "b"] });
  assert.equal(result, '{"items":["a","b"]}');
});

// ---------------------------------------------------------------------------
// normalizeRotationPolicy
// ---------------------------------------------------------------------------

test("normalizeRotationPolicy uses default cadenceDays of 90 when null", () => {
  const result = normalizeRotationPolicy({ cadenceDays: null, ttlMinutes: 60, breakGlass: false });
  assert.equal(result.cadenceDays, 90);
});

test("normalizeRotationPolicy uses default cadenceDays of 90 when undefined", () => {
  const result = normalizeRotationPolicy({ cadenceDays: null as unknown as number, ttlMinutes: 60, breakGlass: false });
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

test("normalizeRotationPolicy clamps negative cadenceDays to 1", () => {
  const result = normalizeRotationPolicy({ cadenceDays: -5, ttlMinutes: 60, breakGlass: false });
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

test("normalizeRotationPolicy clamps negative ttlMinutes to 1", () => {
  const result = normalizeRotationPolicy({ cadenceDays: 90, ttlMinutes: -10, breakGlass: false });
  assert.equal(result.ttlMinutes, 1);
});

test("normalizeRotationPolicy sets breakGlass to true only when exactly true", () => {
  const result1 = normalizeRotationPolicy({ cadenceDays: 90, ttlMinutes: 60, breakGlass: true });
  assert.equal(result1.breakGlass, true);
  const result2 = normalizeRotationPolicy({ cadenceDays: 90, ttlMinutes: 60, breakGlass: "yes" as unknown as boolean });
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

test("computeNextRotationDueAt returns null when lastRotatedAt is invalid date string", () => {
  const result = computeNextRotationDueAt("invalid-date", { cadenceDays: 90, ttlMinutes: 60, breakGlass: false });
  assert.equal(result, null);
});

test("computeNextRotationDueAt returns null when lastRotatedAt is empty string", () => {
  const result = computeNextRotationDueAt("", { cadenceDays: 90, ttlMinutes: 60, breakGlass: false });
  assert.equal(result, null);
});

test("computeNextRotationDueAt calculates future date from lastRotatedAt", () => {
  const lastRotated = "2024-01-01T00:00:00.000Z";
  const result = computeNextRotationDueAt(lastRotated, { cadenceDays: 90, ttlMinutes: 60, breakGlass: false });
  assert.notEqual(result, null);
  // 90 days from Jan 1 = March 31 (Jan has 31, Feb has 29 in 2024 leap year, Mar has 31: 31+29+31=91, so 90 days is March 31)
  const expected = new Date("2024-03-31T00:00:00.000Z");
  assert.equal(result, expected.toISOString());
});

test("computeNextRotationDueAt calculates future date from now when lastRotatedAt is null", () => {
  const before = new Date();
  const result = computeNextRotationDueAt(null, { cadenceDays: 30, ttlMinutes: 60, breakGlass: false });
  const after = new Date();
  assert.notEqual(result, null);
  const resultDate = new Date(result!);
  // Result should be approximately 30 days from now
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  assert.ok(Math.abs(resultDate.getTime() - before.getTime() - thirtyDaysMs) < 5000);
});

test("computeNextRotationDueAt handles 1 day cadence", () => {
  const lastRotated = "2024-06-01T12:00:00.000Z";
  const result = computeNextRotationDueAt(lastRotated, { cadenceDays: 1, ttlMinutes: 60, breakGlass: false });
  const expected = new Date("2024-06-02T12:00:00.000Z");
  assert.equal(result, expected.toISOString());
});

test("computeNextRotationDueAt handles 365 day cadence", () => {
  const lastRotated = "2024-01-15T00:00:00.000Z";
  const result = computeNextRotationDueAt(lastRotated, { cadenceDays: 365, ttlMinutes: 60, breakGlass: false });
  const expected = new Date("2025-01-14T00:00:00.000Z");
  assert.equal(result, expected.toISOString());
});

// ---------------------------------------------------------------------------
// computeLeaseExpiry
// ---------------------------------------------------------------------------

test("computeLeaseExpiry calculates correct expiry time for 60 minutes", () => {
  const issuedAt = "2024-01-01T00:00:00.000Z";
  const result = computeLeaseExpiry(issuedAt, 60);
  assert.equal(result, "2024-01-01T01:00:00.000Z");
});

test("computeLeaseExpiry calculates correct expiry time for 0 ttlMinutes", () => {
  const issuedAt = "2024-01-01T00:00:00.000Z";
  const result = computeLeaseExpiry(issuedAt, 0);
  assert.equal(result, "2024-01-01T00:00:00.000Z");
});

test("computeLeaseExpiry calculates correct expiry time for large ttlMinutes (24 hours)", () => {
  const issuedAt = "2024-01-01T00:00:00.000Z";
  const result = computeLeaseExpiry(issuedAt, 1440);
  assert.equal(result, "2024-01-02T00:00:00.000Z");
});

test("computeLeaseExpiry calculates correct expiry time for 1 minute", () => {
  const issuedAt = "2024-01-01T00:00:00.000Z";
  const result = computeLeaseExpiry(issuedAt, 1);
  assert.equal(result, "2024-01-01T00:01:00.000Z");
});

test("computeLeaseExpiry throws for invalid issuedAt date", () => {
  assert.throws(
    () => computeLeaseExpiry("not-a-date", 60),
    (e: any) => e.code === "secret.invalid_lease_issued_at",
  );
});

test("computeLeaseExpiry throws for empty issuedAt string", () => {
  assert.throws(
    () => computeLeaseExpiry("", 60),
    (e: any) => e.code === "secret.invalid_lease_issued_at",
  );
});

// ---------------------------------------------------------------------------
// normalizeLeaseStatus
// ---------------------------------------------------------------------------

test("normalizeLeaseStatus returns existing status when revoked", () => {
  const record = { status: "revoked" as const, expiresAt: "2024-01-01T00:00:00.000Z" };
  const result = normalizeLeaseStatus(record as unknown as SecretLeaseRecord, "2024-01-02T00:00:00.000Z");
  assert.equal(result, "revoked");
});

test("normalizeLeaseStatus returns expired when active but past expiresAt", () => {
  const record = { status: "active" as const, expiresAt: "2024-01-01T00:00:00.000Z" };
  const result = normalizeLeaseStatus(record as unknown as SecretLeaseRecord, "2024-01-02T00:00:00.000Z");
  assert.equal(result, "expired");
});

test("normalizeLeaseStatus returns active when active and not expired", () => {
  const record = { status: "active" as const, expiresAt: "2024-01-02T00:00:00.000Z" };
  const result = normalizeLeaseStatus(record as unknown as SecretLeaseRecord, "2024-01-01T00:00:00.000Z");
  assert.equal(result, "active");
});

test("normalizeLeaseStatus returns expired when expiresAt equals asOf", () => {
  const record = { status: "active" as const, expiresAt: "2024-01-01T00:00:00.000Z" };
  const result = normalizeLeaseStatus(record as unknown as SecretLeaseRecord, "2024-01-01T00:00:00.000Z");
  assert.equal(result, "expired");
});

test("normalizeLeaseStatus returns revoked when status is revoked regardless of expiry", () => {
  const record = { status: "revoked" as const, expiresAt: "2099-01-01T00:00:00.000Z" };
  const result = normalizeLeaseStatus(record as unknown as SecretLeaseRecord, "2024-01-01T00:00:00.000Z");
  assert.equal(result, "revoked");
});

test("normalizeLeaseStatus returns expired when status is active and expiry is in the past", () => {
  const record = { status: "active" as const, expiresAt: "2024-01-01T00:00:00.000Z" };
  const result = normalizeLeaseStatus(record as unknown as SecretLeaseRecord, "2024-01-01T00:00:00.001Z");
  assert.equal(result, "expired");
});