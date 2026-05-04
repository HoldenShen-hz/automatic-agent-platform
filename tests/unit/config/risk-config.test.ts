import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const RISK_CONFIG_PATH = resolve(process.cwd(), "config/risk/default.json");
const riskConfig = JSON.parse(readFileSync(RISK_CONFIG_PATH, "utf-8"));

test("risk-config exposes the canonical 8-factor model", () => {
  assert.deepEqual(Object.keys(riskConfig.factorWeights), [
    "operationRisk",
    "targetResourceCriticality",
    "dataSensitivity",
    "autonomyModeRisk",
    "tenantImpact",
    "blastRadius",
    "historicalFailureRate",
    "evidenceConfidence",
  ]);
});

test("risk-config includes expected categories", () => {
  for (const category of ["operational", "financial", "compliance", "reputational", "safety", "strategic", "ai", "data"]) {
    assert.ok(riskConfig.riskCategories.includes(category), `riskCategories should include '${category}'`);
  }
});

test("risk-config enforces approval for medium and above", () => {
  assert.equal(riskConfig.riskLevelActions.low.autoExecute, true);
  assert.equal(riskConfig.riskLevelActions.low.requiresApproval, false);

  assert.equal(riskConfig.riskLevelActions.medium.autoExecute, false);
  assert.equal(riskConfig.riskLevelActions.medium.requiresApproval, true);
  assert.equal(riskConfig.riskLevelActions.medium.approvalType, "standard");

  assert.equal(riskConfig.riskLevelActions.high.autoExecute, false);
  assert.equal(riskConfig.riskLevelActions.high.requiresApproval, true);
  assert.equal(riskConfig.riskLevelActions.high.approvalType, "standard");

  assert.equal(riskConfig.riskLevelActions.critical.autoExecute, false);
  assert.equal(riskConfig.riskLevelActions.critical.requiresApproval, true);
  assert.equal(riskConfig.riskLevelActions.critical.approvalType, "break_glass");
});

test("risk-config threshold and autonomy ordering is consistent", () => {
  assert.ok(riskConfig.riskLevelThresholds.low < riskConfig.riskLevelThresholds.medium);
  assert.ok(riskConfig.riskLevelThresholds.medium < riskConfig.riskLevelThresholds.high);
  assert.ok(riskConfig.riskLevelThresholds.high < riskConfig.riskLevelThresholds.critical);

  assert.equal(riskConfig.autonomyRiskCaps.low, "full_auto");
  assert.equal(riskConfig.autonomyRiskCaps.medium, "supervised");
  assert.equal(riskConfig.autonomyRiskCaps.high, "semi_auto");
  assert.equal(riskConfig.autonomyRiskCaps.critical, "suggestion");
});

test("risk-config event registry and domain defaults stay wired", () => {
  assert.ok(riskConfig.eventRegistry.tier1Events.includes("risk.assessment.completed"));
  assert.ok(riskConfig.eventRegistry.tier1Events.includes("risk.level.changed"));
  assert.ok(riskConfig.eventRegistry.tier1Events.includes("risk.breach.detected"));

  assert.equal(riskConfig.domainRiskDefaults.healthcare.humanAccountable, true);
  assert.equal(riskConfig.domainRiskDefaults.quant_trading.maxAutonomy, "supervised");
});
