/**
 * Unit tests for Emergency Hotfix Evidence Gate
 *
 * @see src/ops-maturity/emergency/emergency-hotfix-evidence.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  EmergencyHotfixEvidenceGate,
  type EmergencyHotfixEvidence,
} from "../../../../src/ops-maturity/emergency/emergency-hotfix-evidence.js";

function createValidEvidence(overrides: Partial<EmergencyHotfixEvidence> = {}): EmergencyHotfixEvidence {
  return {
    hotfixId: "hotfix-001",
    expiresAt: "2026-12-31T23:59:59Z",
    followUpTicketId: "TICKET-123",
    rollbackRunbookId: "RUNBOOK-456",
    evidenceBundleId: "BUNDLE-789",
    ...overrides,
  };
}

test.describe("EmergencyHotfixEvidenceGate", () => {
  test.describe("evaluate", () => {
    test("allows valid evidence with all required fields", () => {
      const gate = new EmergencyHotfixEvidenceGate();
      const evidence = createValidEvidence();

      const decision = gate.evaluate(evidence, "2026-01-01T00:00:00Z");

      assert.strictEqual(decision.allowed, true);
      assert.deepStrictEqual(decision.reasonCodes, []);
    });

    test("returns hotfix.expired when expiresAt is in the past", () => {
      const gate = new EmergencyHotfixEvidenceGate();
      const evidence = createValidEvidence({ expiresAt: "2025-01-01T00:00:00Z" });

      const decision = gate.evaluate(evidence, "2026-01-01T00:00:00Z");

      assert.strictEqual(decision.allowed, false);
      assert.ok(decision.reasonCodes.includes("hotfix.expired"));
    });

    test("returns hotfix.follow_up_missing when followUpTicketId is null", () => {
      const gate = new EmergencyHotfixEvidenceGate();
      const evidence = createValidEvidence({ followUpTicketId: null });

      const decision = gate.evaluate(evidence, "2026-01-01T00:00:00Z");

      assert.strictEqual(decision.allowed, false);
      assert.ok(decision.reasonCodes.includes("hotfix.follow_up_missing"));
    });

    test("returns hotfix.rollback_runbook_missing when rollbackRunbookId is null", () => {
      const gate = new EmergencyHotfixEvidenceGate();
      const evidence = createValidEvidence({ rollbackRunbookId: null });

      const decision = gate.evaluate(evidence, "2026-01-01T00:00:00Z");

      assert.strictEqual(decision.allowed, false);
      assert.ok(decision.reasonCodes.includes("hotfix.rollback_runbook_missing"));
    });

    test("returns hotfix.evidence_bundle_missing when evidenceBundleId is null", () => {
      const gate = new EmergencyHotfixEvidenceGate();
      const evidence = createValidEvidence({ evidenceBundleId: null });

      const decision = gate.evaluate(evidence, "2026-01-01T00:00:00Z");

      assert.strictEqual(decision.allowed, false);
      assert.ok(decision.reasonCodes.includes("hotfix.evidence_bundle_missing"));
    });

    test("returns multiple reason codes when all validations fail", () => {
      const gate = new EmergencyHotfixEvidenceGate();
      const evidence: EmergencyHotfixEvidence = {
        hotfixId: "hotfix-expired",
        expiresAt: "2025-01-01T00:00:00Z",
        followUpTicketId: null,
        rollbackRunbookId: null,
        evidenceBundleId: null,
      };

      const decision = gate.evaluate(evidence, "2026-01-01T00:00:00Z");

      assert.strictEqual(decision.allowed, false);
      assert.strictEqual(decision.reasonCodes.length, 4);
      assert.ok(decision.reasonCodes.includes("hotfix.expired"));
      assert.ok(decision.reasonCodes.includes("hotfix.follow_up_missing"));
      assert.ok(decision.reasonCodes.includes("hotfix.rollback_runbook_missing"));
      assert.ok(decision.reasonCodes.includes("hotfix.evidence_bundle_missing"));
    });

    test("allows when expiresAt equals evaluation time (boundary case)", () => {
      const gate = new EmergencyHotfixEvidenceGate();
      const evidence = createValidEvidence({ expiresAt: "2026-01-01T00:00:00Z" });

      const decision = gate.evaluate(evidence, "2026-01-01T00:00:00Z");

      assert.strictEqual(decision.allowed, false);
      assert.ok(decision.reasonCodes.includes("hotfix.expired"));
    });

    test("allows when expiresAt is just after evaluation time", () => {
      const gate = new EmergencyHotfixEvidenceGate();
      const evidence = createValidEvidence({ expiresAt: "2026-01-01T00:00:01Z" });

      const decision = gate.evaluate(evidence, "2026-01-01T00:00:00Z");

      assert.strictEqual(decision.allowed, true);
      assert.deepStrictEqual(decision.reasonCodes, []);
    });

    test("handles evidence with all null optional fields except required", () => {
      const gate = new EmergencyHotfixEvidenceGate();
      const evidence: EmergencyHotfixEvidence = {
        hotfixId: "hotfix-all-null",
        expiresAt: "2026-12-31T23:59:59Z",
        followUpTicketId: null,
        rollbackRunbookId: null,
        evidenceBundleId: null,
      };

      const decision = gate.evaluate(evidence, "2026-01-01T00:00:00Z");

      assert.strictEqual(decision.allowed, false);
      assert.strictEqual(decision.reasonCodes.length, 3);
      assert.ok(decision.reasonCodes.includes("hotfix.follow_up_missing"));
      assert.ok(decision.reasonCodes.includes("hotfix.rollback_runbook_missing"));
      assert.ok(decision.reasonCodes.includes("hotfix.evidence_bundle_missing"));
    });

    test("allows evidence with future expiration", () => {
      const gate = new EmergencyHotfixEvidenceGate();
      const evidence = createValidEvidence({ expiresAt: "2030-01-01T00:00:00Z" });

      const decision = gate.evaluate(evidence, "2026-01-01T00:00:00Z");

      assert.strictEqual(decision.allowed, true);
    });

    test("rejects evidence expired by one second", () => {
      const gate = new EmergencyHotfixEvidenceGate();
      const evidence = createValidEvidence({ expiresAt: "2026-01-01T00:00:00Z" });

      const decision = gate.evaluate(evidence, "2026-01-01T00:00:01Z");

      assert.strictEqual(decision.allowed, false);
      assert.ok(decision.reasonCodes.includes("hotfix.expired"));
    });

    test("reasonCodes is readonly array", () => {
      const gate = new EmergencyHotfixEvidenceGate();
      const evidence = createValidEvidence();

      const decision = gate.evaluate(evidence, "2026-01-01T00:00:00Z");

      assert.ok(Array.isArray(decision.reasonCodes));
      assert.ok(Object.isFrozen(decision.reasonCodes));
    });

    test("allows with only followUpTicketId missing", () => {
      const gate = new EmergencyHotfixEvidenceGate();
      const evidence: EmergencyHotfixEvidence = {
        hotfixId: "hotfix-ticket-missing",
        expiresAt: "2026-12-31T23:59:59Z",
        followUpTicketId: null,
        rollbackRunbookId: "RUNBOOK-456",
        evidenceBundleId: "BUNDLE-789",
      };

      const decision = gate.evaluate(evidence, "2026-01-01T00:00:00Z");

      assert.strictEqual(decision.allowed, false);
      assert.strictEqual(decision.reasonCodes.length, 1);
      assert.ok(decision.reasonCodes.includes("hotfix.follow_up_missing"));
    });

    test("allows with only rollbackRunbookId missing", () => {
      const gate = new EmergencyHotfixEvidenceGate();
      const evidence: EmergencyHotfixEvidence = {
        hotfixId: "hotfix-runbook-missing",
        expiresAt: "2026-12-31T23:59:59Z",
        followUpTicketId: "TICKET-123",
        rollbackRunbookId: null,
        evidenceBundleId: "BUNDLE-789",
      };

      const decision = gate.evaluate(evidence, "2026-01-01T00:00:00Z");

      assert.strictEqual(decision.allowed, false);
      assert.strictEqual(decision.reasonCodes.length, 1);
      assert.ok(decision.reasonCodes.includes("hotfix.rollback_runbook_missing"));
    });

    test("allows with only evidenceBundleId missing", () => {
      const gate = new EmergencyHotfixEvidenceGate();
      const evidence: EmergencyHotfixEvidence = {
        hotfixId: "hotfix-bundle-missing",
        expiresAt: "2026-12-31T23:59:59Z",
        followUpTicketId: "TICKET-123",
        rollbackRunbookId: "RUNBOOK-456",
        evidenceBundleId: null,
      };

      const decision = gate.evaluate(evidence, "2026-01-01T00:00:00Z");

      assert.strictEqual(decision.allowed, false);
      assert.strictEqual(decision.reasonCodes.length, 1);
      assert.ok(decision.reasonCodes.includes("hotfix.evidence_bundle_missing"));
    });
  });
});