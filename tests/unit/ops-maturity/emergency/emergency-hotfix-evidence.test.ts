import assert from "node:assert/strict";
import test from "node:test";
import {
  EmergencyHotfixEvidenceGate,
  type EmergencyHotfixEvidence,
} from "../../../../src/ops-maturity/emergency/emergency-hotfix-evidence.js";

test("EmergencyHotfixEvidenceGate: returns allowed when all evidence is valid", () => {
  const gate = new EmergencyHotfixEvidenceGate();
  const evidence: EmergencyHotfixEvidence = {
    hotfixId: "hotfix-001",
    expiresAt: "2026-12-01T00:00:00Z",
    followUpTicketId: "TICKET-123",
    rollbackRunbookId: "RUNBOOK-456",
    evidenceBundleId: "BUNDLE-789",
  };

  const decision = gate.evaluate(evidence, "2026-05-01T00:00:00Z");

  assert.strictEqual(decision.allowed, true);
  assert.deepStrictEqual(decision.reasonCodes, []);
});

test("EmergencyHotfixEvidenceGate: returns hotfix.expired when expiresAt <= now", () => {
  const gate = new EmergencyHotfixEvidenceGate();
  const evidence: EmergencyHotfixEvidence = {
    hotfixId: "hotfix-002",
    expiresAt: "2026-04-01T00:00:00Z",
    followUpTicketId: "TICKET-123",
    rollbackRunbookId: "RUNBOOK-456",
    evidenceBundleId: "BUNDLE-789",
  };

  const decision = gate.evaluate(evidence, "2026-05-01T00:00:00Z");

  assert.strictEqual(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("hotfix.expired"));
});

test("EmergencyHotfixEvidenceGate: returns hotfix.follow_up_missing when followUpTicketId is null", () => {
  const gate = new EmergencyHotfixEvidenceGate();
  const evidence: EmergencyHotfixEvidence = {
    hotfixId: "hotfix-003",
    expiresAt: "2026-12-01T00:00:00Z",
    followUpTicketId: null,
    rollbackRunbookId: "RUNBOOK-456",
    evidenceBundleId: "BUNDLE-789",
  };

  const decision = gate.evaluate(evidence, "2026-05-01T00:00:00Z");

  assert.strictEqual(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("hotfix.follow_up_missing"));
});

test("EmergencyHotfixEvidenceGate: returns hotfix.rollback_runbook_missing when rollbackRunbookId is null", () => {
  const gate = new EmergencyHotfixEvidenceGate();
  const evidence: EmergencyHotfixEvidence = {
    hotfixId: "hotfix-004",
    expiresAt: "2026-12-01T00:00:00Z",
    followUpTicketId: "TICKET-123",
    rollbackRunbookId: null,
    evidenceBundleId: "BUNDLE-789",
  };

  const decision = gate.evaluate(evidence, "2026-05-01T00:00:00Z");

  assert.strictEqual(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("hotfix.rollback_runbook_missing"));
});

test("EmergencyHotfixEvidenceGate: returns hotfix.evidence_bundle_missing when evidenceBundleId is null", () => {
  const gate = new EmergencyHotfixEvidenceGate();
  const evidence: EmergencyHotfixEvidence = {
    hotfixId: "hotfix-005",
    expiresAt: "2026-12-01T00:00:00Z",
    followUpTicketId: "TICKET-123",
    rollbackRunbookId: "RUNBOOK-456",
    evidenceBundleId: null,
  };

  const decision = gate.evaluate(evidence, "2026-05-01T00:00:00Z");

  assert.strictEqual(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("hotfix.evidence_bundle_missing"));
});

test("EmergencyHotfixEvidenceGate: returns multiple reason codes when multiple validations fail", () => {
  const gate = new EmergencyHotfixEvidenceGate();
  const evidence: EmergencyHotfixEvidence = {
    hotfixId: "hotfix-006",
    expiresAt: "2026-04-01T00:00:00Z",
    followUpTicketId: null,
    rollbackRunbookId: null,
    evidenceBundleId: null,
  };

  const decision = gate.evaluate(evidence, "2026-05-01T00:00:00Z");

  assert.strictEqual(decision.allowed, false);
  assert.strictEqual(decision.reasonCodes.length, 4);
  assert.ok(decision.reasonCodes.includes("hotfix.expired"));
  assert.ok(decision.reasonCodes.includes("hotfix.follow_up_missing"));
  assert.ok(decision.reasonCodes.includes("hotfix.rollback_runbook_missing"));
  assert.ok(decision.reasonCodes.includes("hotfix.evidence_bundle_missing"));
});

test("EmergencyHotfixEvidenceGate: allows when expiresAt equals now", () => {
  const gate = new EmergencyHotfixEvidenceGate();
  const evidence: EmergencyHotfixEvidence = {
    hotfixId: "hotfix-007",
    expiresAt: "2026-05-01T00:00:00Z",
    followUpTicketId: "TICKET-123",
    rollbackRunbookId: "RUNBOOK-456",
    evidenceBundleId: "BUNDLE-789",
  };

  const decision = gate.evaluate(evidence, "2026-05-01T00:00:00Z");

  assert.strictEqual(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("hotfix.expired"));
});
