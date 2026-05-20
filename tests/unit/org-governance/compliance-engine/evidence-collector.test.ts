import assert from "node:assert/strict";
import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { ComplianceEvidenceCollector } from "../../../../src/org-governance/compliance-engine/evidence-collector.js";

test("ComplianceEvidenceCollector.collect creates record with ID and timestamp", () => {
  const collector = new ComplianceEvidenceCollector();

  const record = collector.collect({
    frameworkId: "SOC2",
    controlId: "CC1.1",
    source: "audit-log",
    artifactRef: "artifact-123",
  });

  assert.ok(record.evidenceId.startsWith("compliance_evidence_"));
  assert.ok(record.collectedAt);
  assert.equal(record.frameworkId, "SOC2");
  assert.equal(record.controlId, "CC1.1");
  assert.equal(record.source, "audit-log");
  assert.equal(record.artifactRef, "artifact-123");
});

test("ComplianceEvidenceCollector.collect uses provided collectedAt", () => {
  const collector = new ComplianceEvidenceCollector();
  const customTime = "2024-01-15T10:30:00Z";

  const record = collector.collect({
    frameworkId: "SOC2",
    controlId: "CC1.1",
    source: "audit-log",
    artifactRef: "artifact-123",
    collectedAt: customTime,
  });

  assert.equal(record.collectedAt, customTime);
});

test("ComplianceEvidenceCollector.list returns all records when no frameworkId", () => {
  const collector = new ComplianceEvidenceCollector();

  collector.collect({
    frameworkId: "SOC2",
    controlId: "CC1.1",
    source: "source-a",
    artifactRef: "artifact-1",
  });
  collector.collect({
    frameworkId: "GDPR",
    controlId: "Req-5",
    source: "source-b",
    artifactRef: "artifact-2",
  });

  const allRecords = collector.list();

  assert.equal(allRecords.length, 2);
});

test("ComplianceEvidenceCollector.list filters by frameworkId", () => {
  const collector = new ComplianceEvidenceCollector();

  collector.collect({
    frameworkId: "SOC2",
    controlId: "CC1.1",
    source: "source-a",
    artifactRef: "artifact-1",
  });
  collector.collect({
    frameworkId: "SOC2",
    controlId: "CC1.2",
    source: "source-b",
    artifactRef: "artifact-2",
  });
  collector.collect({
    frameworkId: "GDPR",
    controlId: "Req-5",
    source: "source-c",
    artifactRef: "artifact-3",
  });

  const soc2Records = collector.list("SOC2");
  const gdprRecords = collector.list("GDPR");

  assert.equal(soc2Records.length, 2);
  assert.equal(gdprRecords.length, 1);
  assert.equal(soc2Records[0]?.controlId, "CC1.1");
  assert.equal(soc2Records[1]?.controlId, "CC1.2");
});

test("ComplianceEvidenceCollector.list returns empty for unknown framework", () => {
  const collector = new ComplianceEvidenceCollector();

  collector.collect({
    frameworkId: "SOC2",
    controlId: "CC1.1",
    source: "audit-log",
    artifactRef: "artifact-123",
  });

  const records = collector.list("UnknownFramework");

  assert.equal(records.length, 0);
});

test("ComplianceEvidenceCollector collects multiple records for same framework", () => {
  const collector = new ComplianceEvidenceCollector();

  for (let i = 0; i < 5; i++) {
    collector.collect({
      frameworkId: "SOC2",
      controlId: `CC1.${i}`,
      source: "source",
      artifactRef: `artifact-${i}`,
    });
  }

  const records = collector.list("SOC2");
  assert.equal(records.length, 5);
});

test("ComplianceEvidenceCollector persists snapshot and reloads records from storagePath", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "compliance-evidence-collector-"));
  const storagePath = join(rootDir, "collector-snapshot.json");
  try {
    const collector = new ComplianceEvidenceCollector({ storagePath });
    collector.collect({
      frameworkId: "SOC2",
      controlId: "CC1.1",
      source: "audit-log",
      artifactRef: "artifact-123",
    });
    collector.scheduleEvidenceCollection(
      "SOC2",
      "CC1.1",
      { type: "periodic", intervalMinutes: 60 },
      30,
    );

    const reloaded = new ComplianceEvidenceCollector({ storagePath });
    assert.equal(reloaded.list("SOC2").length, 1);
    assert.equal(reloaded.listScheduledCollections().length, 1);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("ComplianceEvidenceCollector.verifyChain detects tampered persisted evidence", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "compliance-evidence-chain-"));
  const storagePath = join(rootDir, "collector-snapshot.json");
  try {
    const collector = new ComplianceEvidenceCollector({ storagePath });
    collector.collect({
      frameworkId: "SOC2",
      controlId: "CC1.1",
      source: "audit-log",
      artifactRef: "artifact-123",
    });
    collector.collect({
      frameworkId: "SOC2",
      controlId: "CC1.2",
      source: "audit-log",
      artifactRef: "artifact-456",
    });

    const snapshot = JSON.parse(readFileSync(storagePath, "utf8")) as {
      records: Record<string, Array<Record<string, unknown>>>;
    };
    snapshot.records.SOC2[1]!.artifactRef = "tampered-artifact";
    writeFileSync(storagePath, JSON.stringify(snapshot, null, 2), "utf8");

    const tamperedCollector = new ComplianceEvidenceCollector({ storagePath });
    const invalidEvidenceIds = tamperedCollector.verifyChain("SOC2");
    assert.equal(invalidEvidenceIds.length, 1);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("ComplianceEvidenceCollector.collect fails without mutating state when snapshot lock is held", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "compliance-evidence-lock-"));
  const storagePath = join(rootDir, "collector-snapshot.json");
  const lockPath = `${storagePath}.lock`;
  mkdirSync(dirname(lockPath), { recursive: true });
  const lockFd = openSync(lockPath, "wx");

  try {
    const collector = new ComplianceEvidenceCollector({ storagePath });
    assert.throws(() => collector.collect({
      frameworkId: "SOC2",
      controlId: "CC1.3",
      source: "audit-log",
      artifactRef: "artifact-789",
    }), /compliance_evidence\.snapshot_lock_timeout/);
    assert.equal(collector.list("SOC2").length, 0);
  } finally {
    closeSync(lockFd);
    rmSync(lockPath, { force: true });
    rmSync(rootDir, { recursive: true, force: true });
  }
});
