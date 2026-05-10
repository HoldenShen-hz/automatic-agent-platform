import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { loadRiskConfig } from "../../../src/platform/control-plane/risk-control/risk-config-loader.js";

const riskConfig = loadRiskConfig();
const rawRiskConfig = JSON.parse(
  readFileSync(resolve(process.cwd(), "config/risk/default.json"), "utf-8"),
) as { riskCategories: string[] };

test("risk-config exposes the canonical weighted factor model", () => {
  assert.deepEqual(Object.keys(riskConfig.factorWeights), [
    "impact",
    "irreversibility",
    "dataSensitivity",
    "autonomyModeRisk",
    "tenantImpact",
    "blastRadius",
    "historicalFailureRate",
    "evidenceConfidence",
  ]);
});

test("risk-config includes expected categories", () => {
  for (const category of ["operational", "financial", "ai", "compliance", "reputational", "safety", "strategic"]) {
    assert.ok(rawRiskConfig.riskCategories.includes(category), `riskCategories should include '${category}'`);
  }
});

test("risk-config enforces approval for high and critical", () => {
  assert.equal(riskConfig.riskLevelActions.low.autoExecute, true);
  assert.equal(riskConfig.riskLevelActions.low.requiresApproval, false);

  assert.equal(riskConfig.riskLevelActions.medium.autoExecute, false);
  assert.equal(riskConfig.riskLevelActions.medium.requiresApproval, true);

  assert.equal(riskConfig.riskLevelActions.high.autoExecute, false);
  assert.equal(riskConfig.riskLevelActions.high.requiresApproval, true);
  assert.equal(riskConfig.riskLevelActions.high.approvalType, undefined);

  assert.equal(riskConfig.riskLevelActions.critical.autoExecute, false);
  assert.equal(riskConfig.riskLevelActions.critical.requiresApproval, true);
  assert.equal(riskConfig.riskLevelActions.critical.approvalType, "break_glass");
});

test("risk-config threshold ordering is consistent", () => {
  assert.ok(riskConfig.riskLevelThresholds.low < riskConfig.riskLevelThresholds.medium);
  assert.ok(riskConfig.riskLevelThresholds.medium < riskConfig.riskLevelThresholds.high);
  assert.ok(riskConfig.riskLevelThresholds.high < riskConfig.riskLevelThresholds.critical);
});

test("risk-config value maps and thresholds stay wired", () => {
  assert.equal(riskConfig.impactValues.high, 4);
  assert.equal(riskConfig.tenantImpactValues.platform, 5);
  assert.equal(riskConfig.dataSensitivityValues.restricted, 4);
  assert.equal(riskConfig.blastRadiusValues.platform, 5);
  assert.equal(riskConfig.historicalFailureRateThresholds.high.value, 3);
  assert.equal(riskConfig.evidenceConfidenceValues.low, 5);
});
