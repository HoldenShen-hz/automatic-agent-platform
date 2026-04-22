import assert from "node:assert/strict";
import test from "node:test";

import {
  listComplianceCapabilityBaselines,
  resolveComplianceCapabilityBaseline,
} from "../../../../src/platform/compliance/compliance-baseline.js";

test("compliance baseline covers canonical data-governance services", () => {
  const baselines = listComplianceCapabilityBaselines();
  assert.deepEqual(
    baselines.map((item) => item.capabilityId),
    ["crypto-shredding", "data-residency", "encryption", "erasure", "lineage"],
  );
  assert.equal(resolveComplianceCapabilityBaseline("lineage").entryModule, "src/platform/compliance/lineage/index.ts");
});
