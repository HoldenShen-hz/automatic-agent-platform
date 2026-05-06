import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("ComplianceEvidenceCollector persists records and hash continuity when storagePath is configured", () => {
  const storageDir = mkdtempSync(join(tmpdir(), "evidence-collector-"));
  const storagePath = join(storageDir, "evidence.json");
  const writer = new ComplianceEvidenceCollector({ storagePath });

  const first = writer.collect({
    frameworkId: "SOC2",
    controlId: "CC1.1",
    source: "audit-log",
    artifactRef: "artifact-1",
  });
  const second = writer.collect({
    frameworkId: "SOC2",
    controlId: "CC1.2",
    source: "audit-log",
    artifactRef: "artifact-2",
  });

  assert.equal(existsSync(storagePath), true);

  const reloaded = new ComplianceEvidenceCollector({ storagePath });
  const reloadedRecords = reloaded.list("SOC2");

  assert.equal(reloadedRecords.length, 2);
  assert.equal(reloadedRecords[0]?.hash, first.hash);
  assert.equal(reloadedRecords[1]?.previousHash, first.hash);
  assert.equal(reloadedRecords[1]?.hash, second.hash);
  assert.deepEqual(reloaded.verifyChain("SOC2"), []);
});

test("ComplianceEvidenceCollector.verifyChain detects tampered persisted evidence", () => {
  const storageDir = mkdtempSync(join(tmpdir(), "evidence-collector-"));
  const storagePath = join(storageDir, "evidence.json");
  const collector = new ComplianceEvidenceCollector({ storagePath });

  const first = collector.collect({
    frameworkId: "SOC2",
    controlId: "CC1.1",
    source: "audit-log",
    artifactRef: "artifact-1",
  });
  collector.collect({
    frameworkId: "SOC2",
    controlId: "CC1.2",
    source: "audit-log",
    artifactRef: "artifact-2",
  });

  const snapshot = JSON.parse(readFileSync(storagePath, "utf8")) as {
    records: Array<Record<string, unknown>>;
    scheduledCollections: unknown[];
    lastHashByFramework: Record<string, string>;
    schemaVersion: number;
  };
  snapshot.records[0] = {
    ...snapshot.records[0],
    artifactRef: "tampered-artifact",
  };

  writeFileSync(storagePath, JSON.stringify(snapshot, null, 2));

  const reloaded = new ComplianceEvidenceCollector({ storagePath });
  assert.deepEqual(reloaded.verifyChain("SOC2"), [first.evidenceId]);
});
