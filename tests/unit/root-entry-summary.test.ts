import assert from "node:assert/strict";
import test from "node:test";

import { buildPlatformRootSummary } from "../../src/index.js";

test("platform root summary includes architecture and five-plane startup views", () => {
  const summary = buildPlatformRootSummary();
  assert.equal(summary.architecture.startupEntryModule, "src/index.ts");
  assert.deepEqual(summary.domains.startupOrder, ["ring1", "ring2", "ring3"]);
  assert.equal(summary.domains.totalCapabilityCount, 31);
  assert.deepEqual(summary.domains.capabilityCounts, {
    ring1: 8,
    ring2: 11,
    ring3: 12,
  });
  assert.deepEqual(summary.planes.startupOrder, [
    "interface",
    "x1-fabric",
    "control-plane",
    "orchestration",
    "execution",
    "state-evidence",
  ]);
  assert.equal(summary.planes.totalCapabilityCount, 70);
  assert.deepEqual(summary.planes.capabilityCounts, {
    interface: 6,
    x1Fabric: 20,
    controlPlane: 12,
    orchestration: 8,
    execution: 14,
    stateEvidence: 10,
  });
  assert.deepEqual(summary.aiOperations.startupOrder, [
    "model-gateway",
    "prompt-engine",
    "compliance",
    "harness",
  ]);
  assert.equal(summary.aiOperations.totalCapabilityCount, 20);
  assert.deepEqual(summary.aiOperations.capabilityCounts, {
    modelGateway: 6,
    promptEngine: 5,
    compliance: 5,
    harness: 4,
  });
  assert.deepEqual(summary.interactionGovernance.startupOrder, ["interaction", "org-governance"]);
  assert.equal(summary.interactionGovernance.totalCapabilityCount, 12);
  assert.deepEqual(summary.interactionGovernance.capabilityCounts, {
    interaction: 6,
    governance: 6,
  });
  assert.deepEqual(summary.scaleOps.startupOrder, ["scale-ecosystem", "ops-maturity"]);
  assert.equal(summary.scaleOps.totalCapabilityCount, 23);
  assert.deepEqual(summary.scaleOps.capabilityCounts, {
    scaleEcosystem: 11,
    opsMaturity: 12,
  });
});
