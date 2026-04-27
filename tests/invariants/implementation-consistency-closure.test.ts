import { strict as assert } from "node:assert";
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
