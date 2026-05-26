import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { INTERACTION_CAPABILITY_BASELINES } from "../../../src/interaction/interaction-baseline-catalog.js";
import { OPS_MATURITY_CAPABILITY_BASELINES } from "../../../src/ops-maturity/ops-maturity-baseline-catalog.js";
import { GOVERNANCE_CAPABILITY_BASELINES } from "../../../src/org-governance/governance-baseline-catalog.js";
import { COMPLIANCE_CAPABILITY_BASELINES } from "../../../src/platform/compliance/compliance-baseline.js";
import { CONTROL_PLANE_CAPABILITY_BASELINES } from "../../../src/platform/five-plane-control-plane/control-plane-baseline.js";
import { EXECUTION_CAPABILITY_BASELINES } from "../../../src/platform/five-plane-execution/execution-plane-baseline.js";
import { INTERFACE_CAPABILITY_BASELINES } from "../../../src/platform/five-plane-interface/interface-plane-baseline.js";
import { ORCHESTRATION_CAPABILITY_BASELINES } from "../../../src/platform/five-plane-orchestration/orchestration-plane-baseline.js";
import { HARNESS_CAPABILITY_BASELINES } from "../../../src/platform/five-plane-orchestration/harness/harness-baseline.js";
import { STATE_EVIDENCE_CAPABILITY_BASELINES } from "../../../src/platform/five-plane-state-evidence/state-evidence-plane-baseline.js";
import { MODEL_GATEWAY_CAPABILITY_BASELINES } from "../../../src/platform/model-gateway/model-gateway-baseline.js";
import { PROMPT_ENGINE_CAPABILITY_BASELINES } from "../../../src/platform/prompt-engine/prompt-engine-baseline.js";
import { SCALE_CAPABILITY_BASELINES } from "../../../src/scale-ecosystem/scale-baseline-catalog.js";

const ALL_BASELINES = [
  ...INTERACTION_CAPABILITY_BASELINES,
  ...OPS_MATURITY_CAPABILITY_BASELINES,
  ...GOVERNANCE_CAPABILITY_BASELINES,
  ...COMPLIANCE_CAPABILITY_BASELINES,
  ...CONTROL_PLANE_CAPABILITY_BASELINES,
  ...EXECUTION_CAPABILITY_BASELINES,
  ...INTERFACE_CAPABILITY_BASELINES,
  ...ORCHESTRATION_CAPABILITY_BASELINES,
  ...HARNESS_CAPABILITY_BASELINES,
  ...STATE_EVIDENCE_CAPABILITY_BASELINES,
  ...MODEL_GATEWAY_CAPABILITY_BASELINES,
  ...PROMPT_ENGINE_CAPABILITY_BASELINES,
  ...SCALE_CAPABILITY_BASELINES,
];

function resolveBaselineEntryModule(entryModule: string): string {
  if (entryModule.startsWith("src/") && entryModule.endsWith(".ts")) {
    const distCandidate = resolve(`dist/${entryModule.slice(0, -3)}.js`);
    if (existsSync(distCandidate)) {
      return distCandidate;
    }
  }
  return resolve(entryModule);
}

test("baseline services are exported from their entry modules", async () => {
  const missingExports: string[] = [];
  for (const baseline of ALL_BASELINES) {
    const entryModuleUrl = pathToFileURL(resolveBaselineEntryModule(baseline.entryModule)).href;
    const entryModule = (await import(entryModuleUrl)) as Record<string, unknown>;
    for (const serviceName of baseline.baselineServices) {
      if (!(serviceName in entryModule)) {
        missingExports.push(`${baseline.entryModule}:${serviceName}`);
      }
    }
  }
  assert.deepEqual(missingExports, [], `missing baseline exports:\n${missingExports.join("\n")}`);
});
