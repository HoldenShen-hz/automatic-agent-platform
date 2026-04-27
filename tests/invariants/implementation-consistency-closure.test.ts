import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  expandAuditClosureRecords,
  IMPLEMENTATION_CONSISTENCY_CLOSURE_RANGES,
  summarizeAuditClosure,
} from "../../src/platform/architecture/implementation-consistency-closure.js";

test("implementation consistency closure registry covers every audit issue id", () => {
  const records = expandAuditClosureRecords();
  const issueIds = new Set(records.map((record) => record.issueId));

  assert.equal(records.length, 238);
  assert.equal(issueIds.size, 238);
  assert.equal(issueIds.has("C-1"), true);
  assert.equal(issueIds.has("T-56"), true);
  assert.equal(issueIds.has("A-37"), true);
  assert.equal(issueIds.has("D-20"), true);
  assert.equal(records.every((record) => record.status === "closed"), true);
  assert.equal(records.every((record) => record.evidenceRefs.length > 0), true);
});

test("implementation consistency closure registry preserves category counts", () => {
  assert.deepEqual(summarizeAuditClosure(), {
    code_runtime: 7,
    contract: 56,
    adr: 37,
    configuration: 9,
    org_governance: 24,
    scale_ecosystem: 20,
    ops_maturity: 20,
    oapeflir_spec: 25,
    interaction: 20,
    domains_sdk: 20,
  });
});

test("implementation consistency closure ranges use semantic closure modes", () => {
  const modes = new Set(IMPLEMENTATION_CONSISTENCY_CLOSURE_RANGES.map((range) => range.closureMode));
  assert.deepEqual([...modes].sort(), [
    "canonical_registry",
    "compatibility_projection",
    "documentation_superseded",
    "guard_or_state_machine",
    "release_gate",
  ]);
});

test("implementation consistency closure evidence paths exist", () => {
  const records = expandAuditClosureRecords();
  const evidenceRefs = new Set(records.flatMap((record) => [...record.evidenceRefs]));

  for (const evidenceRef of evidenceRefs) {
    assert.equal(existsSync(evidenceRef), true, `missing evidence ref: ${evidenceRef}`);
  }
});

test("ADR audit findings are superseded by concrete ADR files", () => {
  const adrRecords = expandAuditClosureRecords().filter((record) => record.category === "adr");
  const expectedEvidence = "docs_zh/adr/113-architecture-implementation-audit-supersession.md";
  const supersession = readFileSync(expectedEvidence, "utf8");
  const readme = readFileSync("docs_zh/adr/README.md", "utf8");

  assert.equal(adrRecords.length, 37);
  assert.equal(adrRecords.every((record) => record.evidenceRefs.includes(expectedEvidence)), true);
  assert.match(readme, /113-architecture-implementation-audit-supersession/);
  for (const record of adrRecords) {
    assert.match(supersession, new RegExp(`\\| ${record.issueId} \\|`));
  }
});

test("implementation consistency audit report preserves every deviation row and marks it completed", () => {
  const report = readFileSync(
    "docs_zh/reviews/platform-architecture-implementation-consistency-audit.md",
    "utf8",
  );
  const records = expandAuditClosureRecords();
  const issueRows = report.match(/^\| [A-Z]+-\d+\s*\|.*$/gm) ?? [];
  const completedRows = issueRows.filter((row) => /\|\s*已完成\s*\|/.test(row));

  assert.match(report, /实现一致性审计收口报告/);
  assert.match(report, /保留原审计问题明细/);
  assert.match(report, /逐项复核与收口依据索引/);
  assert.match(report, /238 个问题均已复核为 `已完成`/);
  assert.equal(issueRows.length, records.length);
  assert.equal(completedRows.length, records.length);
  for (const record of records) {
    assert.match(report, new RegExp(`ImplementationConsistencyClosureRegistry:${record.issueId}(?:\\\\s*\\\\|)?`));
  }
});
