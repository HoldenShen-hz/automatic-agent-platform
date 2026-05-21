import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EmergencyHotfixEvidenceGate,
  type EmergencyHotfixEvidence,
} from "../../../../src/ops-maturity/emergency/emergency-hotfix-evidence.js";

describe("EmergencyHotfixEvidenceGate", () => {
  const gate = new EmergencyHotfixEvidenceGate();
  const now = "2026-05-21T12:00:00Z";
  const future = "2026-05-21T13:00:00Z";
  const past = "2026-05-21T11:00:00Z";

  describe("evaluate", () => {
    it("should allow hotfix when all evidence is present and not expired", () => {
      const evidence: EmergencyHotfixEvidence = {
        hotfixId: "hotfix-001",
        expiresAt: future,
        followUpTicketId: "TICKET-123",
        rollbackRunbookId: "RUNBOOK-456",
        evidenceBundleId: "BUNDLE-789",
      };

      const decision = gate.evaluate(evidence, now);

      assert.strictEqual(decision.allowed, true);
      assert.deepStrictEqual(decision.reasonCodes, []);
    });

    it("should reject hotfix when expired", () => {
      const evidence: EmergencyHotfixEvidence = {
        hotfixId: "hotfix-002",
        expiresAt: past,
        followUpTicketId: "TICKET-123",
        rollbackRunbookId: "RUNBOOK-456",
        evidenceBundleId: "BUNDLE-789",
      };

      const decision = gate.evaluate(evidence, now);

      assert.strictEqual(decision.allowed, false);
      assert.deepStrictEqual(decision.reasonCodes, ["hotfix.expired"]);
    });

    it("should reject hotfix when followUpTicketId is missing", () => {
      const evidence: EmergencyHotfixEvidence = {
        hotfixId: "hotfix-003",
        expiresAt: future,
        followUpTicketId: null,
        rollbackRunbookId: "RUNBOOK-456",
        evidenceBundleId: "BUNDLE-789",
      };

      const decision = gate.evaluate(evidence, now);

      assert.strictEqual(decision.allowed, false);
      assert.deepStrictEqual(decision.reasonCodes, ["hotfix.follow_up_missing"]);
    });

    it("should reject hotfix when rollbackRunbookId is missing", () => {
      const evidence: EmergencyHotfixEvidence = {
        hotfixId: "hotfix-004",
        expiresAt: future,
        followUpTicketId: "TICKET-123",
        rollbackRunbookId: null,
        evidenceBundleId: "BUNDLE-789",
      };

      const decision = gate.evaluate(evidence, now);

      assert.strictEqual(decision.allowed, false);
      assert.deepStrictEqual(decision.reasonCodes, ["hotfix.rollback_runbook_missing"]);
    });

    it("should reject hotfix when evidenceBundleId is missing", () => {
      const evidence: EmergencyHotfixEvidence = {
        hotfixId: "hotfix-005",
        expiresAt: future,
        followUpTicketId: "TICKET-123",
        rollbackRunbookId: "RUNBOOK-456",
        evidenceBundleId: null,
      };

      const decision = gate.evaluate(evidence, now);

      assert.strictEqual(decision.allowed, false);
      assert.deepStrictEqual(decision.reasonCodes, ["hotfix.evidence_bundle_missing"]);
    });

    it("should reject and accumulate multiple reason codes", () => {
      const evidence: EmergencyHotfixEvidence = {
        hotfixId: "hotfix-006",
        expiresAt: past,
        followUpTicketId: null,
        rollbackRunbookId: null,
        evidenceBundleId: null,
      };

      const decision = gate.evaluate(evidence, now);

      assert.strictEqual(decision.allowed, false);
      assert.strictEqual(decision.reasonCodes.length, 4);
      assert.ok(decision.reasonCodes.includes("hotfix.expired"));
      assert.ok(decision.reasonCodes.includes("hotfix.follow_up_missing"));
      assert.ok(decision.reasonCodes.includes("hotfix.rollback_runbook_missing"));
      assert.ok(decision.reasonCodes.includes("hotfix.evidence_bundle_missing"));
    });

    it("should allow when expiresAt equals now (boundary case)", () => {
      const evidence: EmergencyHotfixEvidence = {
        hotfixId: "hotfix-007",
        expiresAt: now,
        followUpTicketId: "TICKET-123",
        rollbackRunbookId: "RUNBOOK-456",
        evidenceBundleId: "BUNDLE-789",
      };

      const decision = gate.evaluate(evidence, now);

      assert.strictEqual(decision.allowed, false);
      assert.ok(decision.reasonCodes.includes("hotfix.expired"));
    });

    it("should handle expired but otherwise complete evidence", () => {
      const evidence: EmergencyHotfixEvidence = {
        hotfixId: "hotfix-008",
        expiresAt: "2026-05-21T11:59:59Z",
        followUpTicketId: "TICKET-123",
        rollbackRunbookId: "RUNBOOK-456",
        evidenceBundleId: "BUNDLE-789",
      };

      const decision = gate.evaluate(evidence, now);

      assert.strictEqual(decision.allowed, false);
      assert.strictEqual(decision.reasonCodes.length, 1);
      assert.strictEqual(decision.reasonCodes[0], "hotfix.expired");
    });

    it("should allow hotfix with all fields at future date", () => {
      const futureDate = "2026-12-31T23:59:59Z";
      const evidence: EmergencyHotfixEvidence = {
        hotfixId: "hotfix-009",
        expiresAt: futureDate,
        followUpTicketId: "TICKET-ABC",
        rollbackRunbookId: "RUNBOOK-XYZ",
        evidenceBundleId: "BUNDLE-DEF",
      };

      const decision = gate.evaluate(evidence, now);

      assert.strictEqual(decision.allowed, true);
      assert.deepStrictEqual(decision.reasonCodes, []);
    });

    it("should return empty reason codes when allowed", () => {
      const evidence: EmergencyHotfixEvidence = {
        hotfixId: "hotfix-010",
        expiresAt: future,
        followUpTicketId: "TICKET-001",
        rollbackRunbookId: "RUNBOOK-002",
        evidenceBundleId: "BUNDLE-003",
      };

      const decision = gate.evaluate(evidence, now);

      assert.strictEqual(decision.allowed, true);
      assert.strictEqual(decision.reasonCodes.length, 0);
    });
  });
});