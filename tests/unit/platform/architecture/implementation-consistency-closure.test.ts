import assert from "node:assert/strict";
import test from "node:test";

import {
  IMPLEMENTATION_CONSISTENCY_CLOSURE_RANGES,
  expandAuditClosureRecords,
  summarizeAuditClosure,
  summarizeAuditReviewStatus,
  AuditClosureCategory,
} from "../../../../src/platform/architecture/implementation-consistency-closure.js";

test("IMPLEMENTATION_CONSISTENCY_CLOSURE_RANGES is an array with expected prefixes", () => {
  assert.ok(Array.isArray(IMPLEMENTATION_CONSISTENCY_CLOSURE_RANGES), "should be an array");
  assert.equal(IMPLEMENTATION_CONSISTENCY_CLOSURE_RANGES.length, 10);
});

test("IMPLEMENTATION_CONSISTENCY_CLOSURE_RANGES has 10 ranges", () => {
  assert.equal(IMPLEMENTATION_CONSISTENCY_CLOSURE_RANGES.length, 10);
});

test("each range has required fields", () => {
  for (const range of IMPLEMENTATION_CONSISTENCY_CLOSURE_RANGES) {
    assert.ok(typeof range.prefix === "string", "prefix should be string");
    assert.ok(typeof range.from === "number", "from should be number");
    assert.ok(typeof range.to === "number", "to should be number");
    assert.ok(typeof range.category === "string", "category should be string");
    assert.ok(typeof range.closureMode === "string", "closureMode should be string");
    assert.ok(Array.isArray(range.evidenceRefs), "evidenceRefs should be array");
    assert.ok(range.from <= range.to, "from should be <= to");
  }
});

test("each range prefix is a single uppercase letter", () => {
  const validPrefixes = ["C", "T", "A", "G", "O", "S", "M", "F", "I", "D"];
  for (const range of IMPLEMENTATION_CONSISTENCY_CLOSURE_RANGES) {
    assert.ok(validPrefixes.includes(range.prefix), `prefix '${range.prefix}' should be valid`);
  }
});

test("each range category is valid", () => {
  const validCategories: AuditClosureCategory[] = [
    "code_runtime",
    "contract",
    "adr",
    "configuration",
    "org_governance",
    "scale_ecosystem",
    "ops_maturity",
    "oapeflir_spec",
    "interaction",
    "domains_sdk",
  ];
  for (const range of IMPLEMENTATION_CONSISTENCY_CLOSURE_RANGES) {
    assert.ok(validCategories.includes(range.category), `category '${range.category}' should be valid`);
  }
});

test("expandAuditClosureRecords generates correct number of records", () => {
  const records = expandAuditClosureRecords();
  let expectedCount = 0;
  for (const range of IMPLEMENTATION_CONSISTENCY_CLOSURE_RANGES) {
    expectedCount += range.to - range.from + 1;
  }
  assert.equal(records.length, expectedCount);
});

test("expandAuditClosureRecords generates issue IDs in correct format", () => {
  const records = expandAuditClosureRecords();
  const pattern = /^[CTAOGSMFID]-\d+$/;
  for (const record of records) {
    assert.ok(pattern.test(record.issueId), `${record.issueId} should match pattern X-N`);
  }
});

test("expandAuditClosureRecords sets all records to unresolved", () => {
  const records = expandAuditClosureRecords();
  for (const record of records) {
    assert.equal(record.reviewStatus, "unresolved");
  }
});

test("summarizeAuditClosure returns counts for all categories", () => {
  const records = expandAuditClosureRecords();
  const summary = summarizeAuditClosure(records);

  assert.ok(typeof summary.code_runtime === "number");
  assert.ok(typeof summary.contract === "number");
  assert.ok(typeof summary.adr === "number");
  assert.ok(typeof summary.configuration === "number");
  assert.ok(typeof summary.org_governance === "number");
  assert.ok(typeof summary.scale_ecosystem === "number");
  assert.ok(typeof summary.ops_maturity === "number");
  assert.ok(typeof summary.oapeflir_spec === "number");
  assert.ok(typeof summary.interaction === "number");
  assert.ok(typeof summary.domains_sdk === "number");
});

test("summarizeAuditClosure sum equals total records", () => {
  const records = expandAuditClosureRecords();
  const summary = summarizeAuditClosure(records);

  const sum = Object.values(summary).reduce((acc, count) => acc + count, 0);
  assert.equal(sum, records.length);
});

test("summarizeAuditReviewStatus returns counts for all statuses", () => {
  const records = expandAuditClosureRecords();
  const summary = summarizeAuditReviewStatus(records);

  assert.ok(typeof summary.unresolved === "number");
  assert.ok(typeof summary.verified_fixed === "number");
  assert.ok(typeof summary.verified_not_fixed === "number");
});

test("summarizeAuditReviewStatus sum equals total records", () => {
  const records = expandAuditClosureRecords();
  const summary = summarizeAuditReviewStatus(records);

  const sum = summary.unresolved + summary.verified_fixed + summary.verified_not_fixed;
  assert.equal(sum, records.length);
});

test("code_runtime range C has correct count (C-1 to C-7 = 7 records)", () => {
  const cRange = IMPLEMENTATION_CONSISTENCY_CLOSURE_RANGES.find((r) => r.prefix === "C");
  assert.ok(cRange);
  assert.equal(cRange.from, 1);
  assert.equal(cRange.to, 7);
});

test("contract range T has correct count (T-1 to T-56 = 56 records)", () => {
  const tRange = IMPLEMENTATION_CONSISTENCY_CLOSURE_RANGES.find((r) => r.prefix === "T");
  assert.ok(tRange);
  assert.equal(tRange.from, 1);
  assert.equal(tRange.to, 56);
});

test("expandAuditClosureRecords with custom ranges works", () => {
  const customRanges = [{
    prefix: "X" as const,
    from: 1,
    to: 3,
    category: "code_runtime" as const,
    closureMode: "canonical_registry" as const,
    evidenceRefs: ["src/test.ts"],
  }];
  const records = expandAuditClosureRecords(customRanges);
  assert.equal(records.length, 3);
  assert.equal(records[0].issueId, "X-1");
  assert.equal(records[2].issueId, "X-3");
});
