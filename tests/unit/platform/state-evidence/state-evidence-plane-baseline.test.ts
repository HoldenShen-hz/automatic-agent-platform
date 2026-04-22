import assert from "node:assert/strict";
import test from "node:test";

import {
  listStateEvidenceCapabilityBaselines,
  resolveStateEvidenceCapabilityBaseline,
} from "../../../../src/platform/state-evidence/state-evidence-plane-baseline.js";

test("state-evidence plane baseline covers state and evidence entry modules", () => {
  const baselines = listStateEvidenceCapabilityBaselines();
  assert.equal(baselines.length, 10);
  assert.ok(resolveStateEvidenceCapabilityBaseline("knowledge").baselineServices.includes("KnowledgePlaneService"));
  assert.ok(resolveStateEvidenceCapabilityBaseline("truth").entryModule.endsWith("/truth/index.ts"));
});
