import test from "node:test";
import assert from "node:assert/strict";
import { ComplianceEvidenceCollector } from "../../../../src/org-governance/compliance-engine/evidence-collector.js";
test("ComplianceEvidenceCollector collect() creates a record with generated evidenceId and timestamp", () => {
    const collector = new ComplianceEvidenceCollector();
    const input = {
        frameworkId: "sox",
        controlId: "access_review",
        source: "system",
        artifactRef: "audit/2024/log-001",
    };
    const record = collector.collect(input);
    assert.ok(record.evidenceId.startsWith("compliance_evidence_"));
    assert.ok(record.collectedAt.includes("T"));
    assert.strictEqual(record.frameworkId, "sox");
    assert.strictEqual(record.controlId, "access_review");
    assert.strictEqual(record.source, "system");
    assert.strictEqual(record.artifactRef, "audit/2024/log-001");
});
test("ComplianceEvidenceCollector collect() uses provided collectedAt when given", () => {
    const collector = new ComplianceEvidenceCollector();
    const fixedTime = "2024-01-15T10:30:00.000Z";
    const input = {
        frameworkId: "hipaa",
        controlId: "phi_access",
        source: "hr_system",
        artifactRef: "employee-records/001",
        collectedAt: fixedTime,
    };
    const record = collector.collect(input);
    assert.strictEqual(record.collectedAt, fixedTime);
});
test("ComplianceEvidenceCollector list() returns all records when frameworkId is omitted", () => {
    const collector = new ComplianceEvidenceCollector();
    collector.collect({ frameworkId: "sox", controlId: "ctrl1", source: "s1", artifactRef: "a1" });
    collector.collect({ frameworkId: "hipaa", controlId: "ctrl2", source: "s2", artifactRef: "a2" });
    collector.collect({ frameworkId: "sox", controlId: "ctrl3", source: "s3", artifactRef: "a3" });
    const all = collector.list();
    assert.strictEqual(all.length, 3);
});
test("ComplianceEvidenceCollector list() filters by frameworkId", () => {
    const collector = new ComplianceEvidenceCollector();
    collector.collect({ frameworkId: "sox", controlId: "ctrl1", source: "s1", artifactRef: "a1" });
    collector.collect({ frameworkId: "hipaa", controlId: "ctrl2", source: "s2", artifactRef: "a2" });
    collector.collect({ frameworkId: "sox", controlId: "ctrl3", source: "s3", artifactRef: "a3" });
    const soxRecords = collector.list("sox");
    const hipaaRecords = collector.list("hipaa");
    assert.strictEqual(soxRecords.length, 2);
    assert.strictEqual(hipaaRecords.length, 1);
    assert.strictEqual(soxRecords[0].frameworkId, "sox");
    assert.strictEqual(hipaaRecords[0].frameworkId, "hipaa");
});
test("ComplianceEvidenceCollector list() returns empty array for unknown frameworkId", () => {
    const collector = new ComplianceEvidenceCollector();
    collector.collect({ frameworkId: "sox", controlId: "ctrl1", source: "s1", artifactRef: "a1" });
    const records = collector.list("unknown_framework");
    assert.strictEqual(records.length, 0);
});
//# sourceMappingURL=evidence-collector.test.js.map