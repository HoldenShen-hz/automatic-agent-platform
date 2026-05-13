/**
 * Unit tests for SlaExpiryChecker
 *
 * @see src/scale-ecosystem/sla-engine/sla-expiry-checker.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  SlaExpiryChecker,
  type SlaExpiryCheckRequest,
  type DomainExpiryThresholds,
} from "../../../../src/scale-ecosystem/sla-engine/sla-expiry-checker.js";
import { SLA_EXPIRY_WARNING_DAYS } from "../../../../src/scale-ecosystem/sla-engine/sla-expiry-checker.js";

function createTestRequest(overrides: Partial<SlaExpiryCheckRequest> = {}): SlaExpiryCheckRequest {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + (overrides.expiresAt ? 0 : 30)); // Default 30 days

  return {
    slaId: overrides.slaId ?? "sla-001",
    tierId: overrides.tierId ?? "gold",
    domainId: overrides.domainId ?? "domain-1",
    expiresAt: overrides.expiresAt ?? futureDate.toISOString(),
    domainThresholds: overrides.domainThresholds,
  };
}

function createExpiryDate(daysFromNow: number): string {
  const date = new Date();
  // Set to midnight of the target day to avoid time-of-day edge cases
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

test("SlaExpiryChecker.checkExpiry returns active status for distant expiry", () => {
  const checker = new SlaExpiryChecker();
  const request = createTestRequest({ expiresAt: createExpiryDate(30) });

  const result = checker.checkExpiry(request);

  assert.equal(result.record.currentStatus, "active");
  assert.equal(result.record.warningLevel, null);
  assert.equal(result.shouldWarn, false);
});

test("SlaExpiryChecker.checkExpiry returns expiring_soon for 7 days or less", () => {
  const checker = new SlaExpiryChecker();
  const request = createTestRequest({ expiresAt: createExpiryDate(5) });

  const result = checker.checkExpiry(request);

  assert.equal(result.record.currentStatus, "expiring_soon");
});

test("SlaExpiryChecker.checkExpiry returns expired for past date", () => {
  const checker = new SlaExpiryChecker();
  const request = createTestRequest({ expiresAt: createExpiryDate(-1) });

  const result = checker.checkExpiry(request);

  assert.equal(result.record.currentStatus, "expired");
});

test("SlaExpiryChecker.checkExpiry issues info warning at 7 days", () => {
  const checker = new SlaExpiryChecker();
  const request = createTestRequest({ expiresAt: createExpiryDate(7) });

  const result = checker.checkExpiry(request);

  assert.equal(result.shouldWarn, true);
  assert.equal(result.record.warningLevel, "info");
  assert.ok(result.warningMessage?.includes("7 days"));
});

test("SlaExpiryChecker.checkExpiry issues warning at 3 days", () => {
  const checker = new SlaExpiryChecker();
  const request = createTestRequest({ expiresAt: createExpiryDate(3) });

  const result = checker.checkExpiry(request);

  assert.equal(result.shouldWarn, true);
  assert.equal(result.record.warningLevel, "warning");
  assert.ok(result.warningMessage?.includes("3 days"));
});

test("SlaExpiryChecker.checkExpiry issues critical warning at 1 day", () => {
  const checker = new SlaExpiryChecker();
  const request = createTestRequest({ expiresAt: createExpiryDate(1) });

  const result = checker.checkExpiry(request);

  assert.equal(result.shouldWarn, true);
  assert.equal(result.record.warningLevel, "critical");
  assert.ok(result.warningMessage?.includes("1 day"));
});

test("SlaExpiryChecker.checkExpiry uses highest severity when multiple thresholds match", () => {
  const checker = new SlaExpiryChecker();
  const request = createTestRequest({ expiresAt: createExpiryDate(0) }); // At 0 days

  const result = checker.checkExpiry(request);

  assert.equal(result.record.warningLevel, "critical");
});

test("SlaExpiryChecker.checkExpiry respects custom warning intervals", () => {
  const checker = new SlaExpiryChecker();
  const request = createTestRequest({
    expiresAt: createExpiryDate(14),
    domainThresholds: {
      domainId: "custom-domain",
      warningIntervals: [14, 7, 3, 1],
    } as DomainExpiryThresholds,
  });

  const result = checker.checkExpiry(request);

  assert.equal(result.shouldWarn, true);
  assert.equal(result.record.warningLevel, "info");
});

test("SlaExpiryChecker.checkExpiry respects custom warning thresholds", () => {
  const checker = new SlaExpiryChecker();
  const request = createTestRequest({
    expiresAt: createExpiryDate(10),
    domainThresholds: {
      domainId: "custom-domain",
      customWarningThresholds: [
        { daysBeforeExpiry: 10, severity: "critical" as const },
        { daysBeforeExpiry: 5, severity: "warning" as const },
      ],
    } as DomainExpiryThresholds,
  });

  const result = checker.checkExpiry(request);

  assert.equal(result.shouldWarn, true);
  assert.equal(result.record.warningLevel, "critical");
});

test("SlaExpiryChecker.checkBatch processes multiple requests", () => {
  const checker = new SlaExpiryChecker();
  const requests: SlaExpiryCheckRequest[] = [
    createTestRequest({ slaId: "sla-1", expiresAt: createExpiryDate(30) }),
    createTestRequest({ slaId: "sla-2", expiresAt: createExpiryDate(3) }),
    createTestRequest({ slaId: "sla-3", expiresAt: createExpiryDate(1) }),
  ];

  const results = checker.checkBatch(requests);

  assert.equal(results.length, 3);
  assert.equal(results[0].record.currentStatus, "active");
  assert.equal(results[1].record.warningLevel, "warning");
  assert.equal(results[2].record.warningLevel, "critical");
});

test("SlaExpiryChecker.checkExpiry records all required fields", () => {
  const checker = new SlaExpiryChecker();
  const request = createTestRequest({ slaId: "sla-full", tierId: "platinum", domainId: "enterprise" });

  const result = checker.checkExpiry(request);

  assert.equal(result.record.slaId, "sla-full");
  assert.equal(result.record.tierId, "platinum");
  assert.equal(result.record.domainId, "enterprise");
  assert.ok(result.record.expiresAt);
});

test("SlaExpiryChecker.checkExpiry includes warning message when shouldWarn is true", () => {
  const checker = new SlaExpiryChecker();
  const request = createTestRequest({ expiresAt: createExpiryDate(3) });

  const result = checker.checkExpiry(request);

  assert.ok(result.warningMessage);
  assert.ok(result.warningMessage.includes("sla-001"));
  assert.ok(result.warningMessage.includes("gold"));
});

test("SlaExpiryChecker.checkExpiry returns null warning message when not warning", () => {
  const checker = new SlaExpiryChecker();
  const request = createTestRequest({ expiresAt: createExpiryDate(30) });

  const result = checker.checkExpiry(request);

  assert.equal(result.shouldWarn, false);
  assert.equal(result.warningMessage, null);
});

test("SLA_EXPIRY_WARNING_DAYS contains expected values", () => {
  assert.deepEqual(SLA_EXPIRY_WARNING_DAYS, [7, 3, 1]);
});

test("SlaExpiryChecker.checkExpiry handles boundary at exactly 7 days", () => {
  const checker = new SlaExpiryChecker();
  const request = createTestRequest({ expiresAt: createExpiryDate(7) });

  const result = checker.checkExpiry(request);

  assert.equal(result.shouldWarn, true);
  assert.equal(result.record.warningLevel, "info");
});

test("SlaExpiryChecker.checkExpiry handles boundary at exactly 3 days", () => {
  const checker = new SlaExpiryChecker();
  const request = createTestRequest({ expiresAt: createExpiryDate(3) });

  const result = checker.checkExpiry(request);

  assert.equal(result.shouldWarn, true);
  assert.equal(result.record.warningLevel, "warning");
});

test("SlaExpiryChecker.checkExpiry handles boundary at exactly 1 day", () => {
  const checker = new SlaExpiryChecker();
  const request = createTestRequest({ expiresAt: createExpiryDate(1) });

  const result = checker.checkExpiry(request);

  assert.equal(result.shouldWarn, true);
  assert.equal(result.record.warningLevel, "critical");
});

test("SlaExpiryChecker.checkExpiry handles fractional days correctly", () => {
  const checker = new SlaExpiryChecker();
  // Set expiry to 6.5 days from now
  const date = new Date();
  date.setDate(date.getDate() + 6);
  date.setHours(date.getHours() + 12);
  const request = createTestRequest({ expiresAt: date.toISOString() });

  const result = checker.checkExpiry(request);

  // Should still be in info warning range (7 days)
  assert.equal(result.record.warningLevel, "info");
});

test("SlaExpiryChecker.checkExpiry records warningsIssued array", () => {
  const checker = new SlaExpiryChecker();
  const request = createTestRequest({ expiresAt: createExpiryDate(3) });

  const result = checker.checkExpiry(request);

  assert.ok(Array.isArray(result.record.warningsIssued));
  assert.equal(result.record.warningsIssued.length, result.shouldWarn ? 1 : 0);
});
