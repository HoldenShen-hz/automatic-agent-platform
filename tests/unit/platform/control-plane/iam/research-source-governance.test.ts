import assert from "node:assert/strict";
import test from "node:test";

import { validateResearchSourceGovernance } from "../../../../../src/platform/five-plane-control-plane/iam/research-source-governance.js";

const governedSource = {
  sourceId: "source-paper",
  sourceType: "paper",
  sourceAttribution: "Paper authors",
  license: "publisher-review",
  copyrightBoundary: "short_excerpt_allowed",
  dataClass: "public",
  retentionPolicy: "research-source-365d",
  contaminationTag: "do_not_train",
  piiDetected: false,
  redactionApplied: false,
  tenantId: "tenant-research",
  accessPolicyRef: "policy://research/public",
  evidenceRef: "evidence://source-paper",
};

test("research source governance accepts attributed licensed redaction-safe sources", () => {
  const decision = validateResearchSourceGovernance(governedSource);

  assert.equal(decision.accepted, true);
  assert.deepEqual(decision.reasonCodes, []);
  assert.equal(decision.record?.sourceType, "paper");
});

test("research source governance blocks missing license contamination and PII redaction", () => {
  const decision = validateResearchSourceGovernance({
    ...governedSource,
    license: undefined,
    contaminationTag: undefined,
    piiDetected: true,
  });

  assert.equal(decision.accepted, false);
  assert.deepEqual(decision.reasonCodes, [
    "research_source.license_missing",
    "research_source.contamination_tag_missing",
    "research_source.pii_redaction_missing",
  ]);
});
