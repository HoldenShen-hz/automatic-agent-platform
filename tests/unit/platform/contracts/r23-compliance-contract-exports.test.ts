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
  assert.match(contractsIndex, /type Artifact/);
  assert.match(contractsIndex, /type EvidenceRecord as ComplianceEvidenceRecord/);
  assert.match(contractsIndex, /type AuditAppendCommand as ComplianceAuditAppendCommand/);
});

test("five-plane compliance module defines the canonical compliance contract types", () => {
  const complianceIndex = readFileSync(
    resolve(process.cwd(), "src/platform/five-plane-control-plane/compliance/index.ts"),
    "utf8",
  );

  assert.match(complianceIndex, /export interface EvidenceMappingRule/);
  assert.match(complianceIndex, /export interface ComplianceReportRequest/);
  assert.match(complianceIndex, /export interface Artifact/);
  assert.match(complianceIndex, /export interface EvidenceRecord/);
  assert.match(complianceIndex, /export interface AuditAppendCommand/);
});
