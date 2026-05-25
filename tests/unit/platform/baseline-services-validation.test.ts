import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { INTERACTION_CAPABILITY_BASELINES } from "../../../src/interaction/interaction-baseline-catalog.js";
import { GOVERNANCE_CAPABILITY_BASELINES } from "../../../src/org-governance/governance-baseline-catalog.js";
import { COMPLIANCE_CAPABILITY_BASELINES } from "../../../src/platform/compliance/compliance-baseline.js";
import { CONTROL_PLANE_CAPABILITY_BASELINES } from "../../../src/platform/five-plane-control-plane/control-plane-baseline.js";
import { EXECUTION_CAPABILITY_BASELINES } from "../../../src/platform/five-plane-execution/execution-plane-baseline.js";
import { INTERFACE_CAPABILITY_BASELINES } from "../../../src/platform/five-plane-interface/interface-plane-baseline.js";
import { ORCHESTRATION_CAPABILITY_BASELINES } from "../../../src/platform/five-plane-orchestration/orchestration-plane-baseline.js";
import { HARNESS_CAPABILITY_BASELINES } from "../../../src/platform/five-plane-orchestration/harness/harness-baseline.js";
import { MODEL_GATEWAY_CAPABILITY_BASELINES } from "../../../src/platform/model-gateway/model-gateway-baseline.js";
import { PROMPT_ENGINE_CAPABILITY_BASELINES } from "../../../src/platform/prompt-engine/prompt-engine-baseline.js";

const ALL_BASELINES = [
  ...INTERACTION_CAPABILITY_BASELINES,
  ...GOVERNANCE_CAPABILITY_BASELINES,
  ...COMPLIANCE_CAPABILITY_BASELINES,
  ...CONTROL_PLANE_CAPABILITY_BASELINES,
  ...EXECUTION_CAPABILITY_BASELINES,
  ...INTERFACE_CAPABILITY_BASELINES,
  ...ORCHESTRATION_CAPABILITY_BASELINES,
  ...HARNESS_CAPABILITY_BASELINES,
  ...MODEL_GATEWAY_CAPABILITY_BASELINES,
  ...PROMPT_ENGINE_CAPABILITY_BASELINES,
];

test("baseline services reference exported symbols from their entry modules", () => {
  for (const baseline of ALL_BASELINES) {
    const source = readFileSync(resolve(baseline.entryModule), "utf8");
    for (const serviceName of baseline.baselineServices) {
      assert.match(
        source,
        new RegExp(`\\b${serviceName}\\b`),
        `${baseline.entryModule} should reference baseline service ${serviceName}`,
      );
    }
  }
});
