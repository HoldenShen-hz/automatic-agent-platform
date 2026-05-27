import assert from "node:assert/strict";
import test from "node:test";

import {
  SlaExpiryChecker,
  SLA_EXPIRY_WARNING_DAYS,
  type SlaExpiryCheckRequest,
  type DomainExpiryThresholds,
} from "../../../src/scale-ecosystem/sla-engine/sla-expiry-checker.js";

function createExpiryRequest(overrides: Partial<SlaExpiryCheckRequest> = {}): SlaExpiryCheckRequest {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  return {
    slaId: overrides.slaId ?? "sla-001",
    tierId: overrides.tierId ?? "standard",
    domainId: overrides.domainId ?? "default",
    expiresAt: overrides.expiresAt ?? futureDate.toISOString(),
    domainThresholds: overrides.domainThresholds ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SlaExpiryChecker Core Tests
// ─────────────────────────────────────────────────────────────────────────────

test("SlaExpiryChecker returns active status for SLA expiring in > 7 days [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);

  const result = checker.checkExpiry(createExpiryRequest({ expiresAt: futureDate.toISOString() }));

  assert.equal(result.record.currentStatus, "active");
  assert.equal(result.shouldWarn, false);
});

test("SlaExpiryChecker returns expiring_soon status for SLA expiring in <= 7 days [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5);

  const result = checker.checkExpiry(createExpiryRequest({ expiresAt: futureDate.toISOString() }));

  assert.equal(result.record.currentStatus, "expiring_soon");
});

test("SlaExpiryChecker returns expired status for SLA that has passed [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 1);

  const result = checker.checkExpiry(createExpiryRequest({ expiresAt: pastDate.toISOString() }));

  assert.equal(result.record.currentStatus, "expired");
});

test("SlaExpiryChecker returns no warning for SLA expiring in > 7 days [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 10);

  const result = checker.checkExpiry(createExpiryRequest({ expiresAt: futureDate.toISOString() }));

  assert.equal(result.shouldWarn, false);
  assert.equal(result.warningMessage, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Warning Level Tests (7d/3d/1d intervals per §54.3)
// ─────────────────────────────────────────────────────────────────────────────

test("SlaExpiryChecker issues info warning at 7 days [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);

  const result = checker.checkExpiry(createExpiryRequest({ expiresAt: futureDate.toISOString() }));

  assert.equal(result.shouldWarn, true);
  assert.equal(result.record.warningLevel, "info");
  assert.ok(result.warningMessage?.includes("7 days"));
});

test("SlaExpiryChecker issues warning level at 3 days [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 3);

  const result = checker.checkExpiry(createExpiryRequest({ expiresAt: futureDate.toISOString() }));

  assert.equal(result.shouldWarn, true);
  assert.equal(result.record.warningLevel, "warning");
  assert.ok(result.warningMessage?.includes("3 days"));
});

test("SlaExpiryChecker issues critical warning at 1 day [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 1);

  const result = checker.checkExpiry(createExpiryRequest({ expiresAt: futureDate.toISOString() }));

  assert.equal(result.shouldWarn, true);
  assert.equal(result.record.warningLevel, "critical");
  assert.ok(result.warningMessage?.includes("1 day"));
});

test("SlaExpiryChecker handles same-day expiry as critical [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const result = checker.checkExpiry(createExpiryRequest({ expiresAt: today.toISOString() }));

  assert.equal(result.shouldWarn, true);
  assert.equal(result.record.warningLevel, "critical");
});

test("SlaExpiryChecker handles expired SLA [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 5);

  const result = checker.checkExpiry(createExpiryRequest({ expiresAt: pastDate.toISOString() }));

  assert.equal(result.record.currentStatus, "expired");
  assert.equal(result.record.warningLevel, "critical");
});

// ─────────────────────────────────────────────────────────────────────────────
// Domain-Specific Threshold Tests
// ─────────────────────────────────────────────────────────────────────────────

test("SlaExpiryChecker uses custom warning intervals when provided [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 14);

  const request = createExpiryRequest({
    expiresAt: futureDate.toISOString(),
    domainThresholds: {
      domainId: "enterprise",
      warningIntervals: [14, 7, 3],
    },
  });

  const result = checker.checkExpiry(request);

  // 14 days should trigger info level with custom interval
  assert.equal(result.shouldWarn, true);
  assert.equal(result.record.warningLevel, "info");
});

test("SlaExpiryChecker uses custom warning thresholds when provided [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 5);

  const request = createExpiryRequest({
    expiresAt: futureDate.toISOString(),
    domainThresholds: {
      domainId: "enterprise",
      customWarningThresholds: [
        { daysBeforeExpiry: 10, severity: "info" },
        { daysBeforeExpiry: 5, severity: "warning" },
        { daysBeforeExpiry: 2, severity: "critical" },
      ],
    },
  });

  const result = checker.checkExpiry(request);

  assert.equal(result.shouldWarn, true);
  assert.equal(result.record.warningLevel, "warning");
});

test("SlaExpiryChecker respects custom severity levels [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 10);

  const request = createExpiryRequest({
    expiresAt: futureDate.toISOString(),
    domainThresholds: {
      domainId: "custom",
      customWarningThresholds: [
        { daysBeforeExpiry: 10, severity: "critical" },
      ],
    },
  });

  const result = checker.checkExpiry(request);

  assert.equal(result.shouldWarn, true);
  assert.equal(result.record.warningLevel, "critical");
});

test("SlaExpiryChecker handles domain thresholds with no custom thresholds [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);

  const result = checker.checkExpiry(createExpiryRequest({ expiresAt: futureDate.toISOString() }));

  assert.equal(result.shouldWarn, false);
  assert.equal(result.record.warningLevel, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Batch Check Tests
// ─────────────────────────────────────────────────────────────────────────────

test("SlaExpiryChecker.checkBatch processes multiple SLAs [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const date7Days = new Date();
  date7Days.setDate(date7Days.getDate() + 7);
  const date30Days = new Date();
  date30Days.setDate(date30Days.getDate() + 30);

  const requests: SlaExpiryCheckRequest[] = [
    createExpiryRequest({ slaId: "sla-001", expiresAt: date7Days.toISOString() }),
    createExpiryRequest({ slaId: "sla-002", expiresAt: date30Days.toISOString() }),
  ];

  const results = checker.checkBatch(requests);

  assert.equal(results.length, 2);
  assert.equal(results[0]!.record.slaId, "sla-001");
  assert.equal(results[1]!.record.slaId, "sla-002");
});

test("SlaExpiryChecker.checkBatch handles empty array [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const results = checker.checkBatch([]);

  assert.equal(results.length, 0);
});

test("SlaExpiryChecker.checkBatch includes warning for expiring SLAs [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const date3Days = new Date();
  date3Days.setDate(date3Days.getDate() + 3);
  const date30Days = new Date();
  date30Days.setDate(date30Days.getDate() + 30);

  const requests: SlaExpiryCheckRequest[] = [
    createExpiryRequest({ slaId: "sla-urgent", expiresAt: date3Days.toISOString() }),
    createExpiryRequest({ slaId: "sla-far", expiresAt: date30Days.toISOString() }),
  ];

  const results = checker.checkBatch(requests);

  assert.equal(results[0]!.shouldWarn, true);
  assert.equal(results[1]!.shouldWarn, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// SLA_EXPIRY_WARNING_DAYS Constant
// ─────────────────────────────────────────────────────────────────────────────

test("SLA_EXPIRY_WARNING_DAYS contains expected intervals [sla-expiry-checker]", () => {
  assert.deepEqual([...SLA_EXPIRY_WARNING_DAYS], [7, 3, 1]);
});

test("SLA_EXPIRY_WARNING_DAYS is frozen and ordered [sla-expiry-checker]", () => {
  const copy = [...SLA_EXPIRY_WARNING_DAYS];
  assert.deepEqual(copy, [7, 3, 1]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("SlaExpiryChecker handles exact boundary at 7 days [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const boundaryDate = new Date();
  boundaryDate.setDate(boundaryDate.getDate() + 7);
  boundaryDate.setHours(0, 0, 0, 0);

  const result = checker.checkExpiry(createExpiryRequest({ expiresAt: boundaryDate.toISOString() }));

  // At exactly 7 days, should still get info warning
  assert.equal(result.shouldWarn, true);
  assert.equal(result.record.warningLevel, "info");
});

test("SlaExpiryChecker handles SLA with 0 days remaining [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const today = new Date();

  const result = checker.checkExpiry(createExpiryRequest({ expiresAt: today.toISOString() }));

  assert.equal(result.shouldWarn, true);
  assert.equal(result.record.currentStatus, "expired");
});

test("SlaExpiryChecker records warning messages issued [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 3);

  const result = checker.checkExpiry(createExpiryRequest({ expiresAt: futureDate.toISOString() }));

  assert.ok(result.record.warningsIssued.length > 0);
});

test("SlaExpiryChecker handles different tier IDs [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 3);

  const result = checker.checkExpiry(createExpiryRequest({
    slaId: "sla-001",
    tierId: "premium",
    expiresAt: futureDate.toISOString(),
  }));

  assert.equal(result.record.tierId, "premium");
});

test("SlaExpiryChecker handles different domain IDs [sla-expiry-checker]", () => {
  const checker = new SlaExpiryChecker();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 3);

  const result = checker.checkExpiry(createExpiryRequest({
    slaId: "sla-001",
    domainId: "enterprise",
    expiresAt: futureDate.toISOString(),
  }));

  assert.equal(result.record.domainId, "enterprise");
});
