import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { ComplianceEvidenceCollector } from "../../../../../src/org-governance/compliance-engine/evidence-collector.js";
test("ComplianceEvidenceCollector collect creates record", () => {
    const collector = new ComplianceEvidenceCollector();
    const record = collector.collect({
        frameworkId: "SOC2",
        controlId: "CC6.1",
        source: "cloudtrail",
        artifactRef: "arn:aws:cloudtrail:us-east-1:123456789:trail/default",
    });
    assert.ok(record.evidenceId.startsWith("compliance_evidence_"));
    assert.strictEqual(record.frameworkId, "SOC2");
    assert.strictEqual(record.controlId, "CC6.1");
    assert.strictEqual(record.source, "cloudtrail");
    assert.strictEqual(record.artifactRef, "arn:aws:cloudtrail:us-east-1:123456789:trail/default");
    assert.ok(record.collectedAt.length > 0);
});
test("ComplianceEvidenceCollector collect uses provided collectedAt", () => {
    const collector = new ComplianceEvidenceCollector();
    const customDate = "2024-01-01T00:00:00.000Z";
    const record = collector.collect({
        frameworkId: "SOC2",
        controlId: "CC6.1",
        source: "cloudtrail",
        artifactRef: "ref-1",
        collectedAt: customDate,
    });
    assert.strictEqual(record.collectedAt, customDate);
});
test("ComplianceEvidenceCollector list returns all records when no frameworkId", () => {
    const collector = new ComplianceEvidenceCollector();
    collector.collect({ frameworkId: "SOC2", controlId: "CC6.1", source: "s3", artifactRef: "ref-1" });
    collector.collect({ frameworkId: "SOC2", controlId: "CC6.2", source: "cloudwatch", artifactRef: "ref-2" });
    collector.collect({ frameworkId: "ISO27001", controlId: "A.5.1", source: "policy-doc", artifactRef: "ref-3" });
    const records = collector.list();
    assert.strictEqual(records.length, 3);
});
test("ComplianceEvidenceCollector list filters by frameworkId", () => {
    const collector = new ComplianceEvidenceCollector();
    collector.collect({ frameworkId: "SOC2", controlId: "CC6.1", source: "s3", artifactRef: "ref-1" });
    collector.collect({ frameworkId: "SOC2", controlId: "CC6.2", source: "cloudwatch", artifactRef: "ref-2" });
    collector.collect({ frameworkId: "ISO27001", controlId: "A.5.1", source: "policy-doc", artifactRef: "ref-3" });
    const records = collector.list("SOC2");
    assert.strictEqual(records.length, 2);
    assert.ok(records.every((r) => r.frameworkId === "SOC2"));
});
test("ComplianceEvidenceCollector list returns empty array for unknown framework", () => {
    const collector = new ComplianceEvidenceCollector();
    collector.collect({ frameworkId: "SOC2", controlId: "CC6.1", source: "s3", artifactRef: "ref-1" });
    const records = collector.list("UnknownFramework");
    assert.strictEqual(records.length, 0);
});
test("ComplianceEvidenceCollector collect groups records by framework", () => {
    const collector = new ComplianceEvidenceCollector();
    collector.collect({ frameworkId: "SOC2", controlId: "CC6.1", source: "s3", artifactRef: "ref-1" });
    collector.collect({ frameworkId: "SOC2", controlId: "CC6.2", source: "cloudwatch", artifactRef: "ref-2" });
    const soc2Records = collector.list("SOC2");
    const isoRecords = collector.list("ISO27001");
    assert.strictEqual(soc2Records.length, 2);
    assert.strictEqual(isoRecords.length, 0);
});
test("ComplianceEvidenceCollector collect allows multiple sources for same control", () => {
    const collector = new ComplianceEvidenceCollector();
    collector.collect({ frameworkId: "SOC2", controlId: "CC6.1", source: "cloudtrail", artifactRef: "ref-1" });
    collector.collect({ frameworkId: "SOC2", controlId: "CC6.1", source: "cloudwatch", artifactRef: "ref-2" });
    const records = collector.list("SOC2");
    assert.strictEqual(records.length, 2);
});
test("ComplianceEvidenceCollector list returns copy not original", () => {
    const collector = new ComplianceEvidenceCollector();
    collector.collect({ frameworkId: "SOC2", controlId: "CC6.1", source: "s3", artifactRef: "ref-1" });
    const records = collector.list("SOC2");
    records.push({});
    const subsequent = collector.list("SOC2");
    assert.strictEqual(subsequent.length, 1);
});
test("ComplianceEvidenceCollector collect with various artifact references", () => {
    const collector = new ComplianceEvidenceCollector();
    const s3Ref = "arn:aws:s3:::bucket-name/path/to/log";
    const syslogRef = "syslog://logs.example.com/audit";
    const dbRef = "postgresql://db.example.com/audit_log";
    collector.collect({ frameworkId: "PCI", controlId: "10.1", source: "s3", artifactRef: s3Ref });
    collector.collect({ frameworkId: "PCI", controlId: "10.2", source: "syslog", artifactRef: syslogRef });
    collector.collect({ frameworkId: "PCI", controlId: "10.3", source: "database", artifactRef: dbRef });
    const records = collector.list("PCI");
    assert.strictEqual(records.length, 3);
});
//# sourceMappingURL=evidence-collector.test.js.map