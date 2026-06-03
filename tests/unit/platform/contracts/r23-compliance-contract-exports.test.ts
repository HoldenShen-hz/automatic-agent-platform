import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("platform contract barrel re-exports canonical compliance contract aliases", () => {
  const contractsIndex = readFileSync(
    resolve(process.cwd(), "src/platform/contracts/index.ts"),
    "utf8",
  );

  assert.match(contractsIndex, /type EvidenceMappingRule/);
  assert.match(contractsIndex, /type ComplianceReportRequest/);
  assert.match(contractsIndex, /type ComplianceArtifact as Artifact/);
  assert.match(contractsIndex, /type ComplianceEvidenceRecord/);
  assert.match(contractsIndex, /type ComplianceAuditAppendCommand/);
});

test("five-plane compliance module defines the canonical compliance contract types", () => {
  const complianceIndex = readFileSync(
    resolve(process.cwd(), "src/platform/five-plane-control-plane/compliance/index.ts"),
    "utf8",
  );

  assert.match(complianceIndex, /export type \{/);
  assert.match(complianceIndex, /EvidenceMappingRule/);
  assert.match(complianceIndex, /ComplianceReportRequest/);
  assert.match(complianceIndex, /ComplianceArtifact as Artifact/);
  assert.match(complianceIndex, /ComplianceEvidenceRecord as EvidenceRecord/);
  assert.match(complianceIndex, /ComplianceAuditAppendCommand as AuditAppendCommand/);
});
