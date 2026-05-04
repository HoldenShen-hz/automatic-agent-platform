import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  createCanonicalRiskConfig,
  createCriticalRiskFactors,
  createHighRiskFactors,
  createLowRiskFactors,
  createMediumRiskFactors,
  createRiskRequest,
} from "../../../../helpers/risk-control.js";
import { RiskEvaluationEngine } from "../../../../../src/platform/control-plane/risk-control/risk-evaluation-engine.js";
import { loadRiskConfig } from "../../../../../src/platform/control-plane/risk-control/risk-config-loader.js";

function withLoadedEngine(body: (engine: RiskEvaluationEngine) => void): void {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-integration-"));
  const configPath = join(tempDir, "risk.json");
  try {
    writeFileSync(configPath, JSON.stringify(createCanonicalRiskConfig()), "utf-8");
    const config = loadRiskConfig(configPath);
    body(new RiskEvaluationEngine({ config }));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test("risk-engine integration evaluates low/medium/high/critical paths", () => {
  withLoadedEngine((engine) => {
    assert.equal(engine.evaluate(createRiskRequest(createLowRiskFactors(), { taskId: "int-low" })).riskLevel, "low");
    assert.equal(engine.evaluate(createRiskRequest(createMediumRiskFactors(), { taskId: "int-medium" })).riskLevel, "medium");
    assert.equal(engine.evaluate(createRiskRequest(createHighRiskFactors(), { taskId: "int-high" })).riskLevel, "high");
    assert.equal(engine.evaluate(createRiskRequest(createCriticalRiskFactors(), { taskId: "int-critical" })).riskLevel, "critical");
  });
});

test("risk-engine integration preserves approval policy from loaded config", () => {
  withLoadedEngine((engine) => {
    const medium = engine.evaluate(createRiskRequest(createMediumRiskFactors(), { taskId: "int-approval-medium" }));
    const critical = engine.evaluate(createRiskRequest(createCriticalRiskFactors(), { taskId: "int-approval-critical" }));

    assert.equal(medium.requiresApproval, true);
    assert.equal(medium.approvalType, "standard");
    assert.equal(critical.requiresApproval, true);
    assert.equal(critical.approvalType, "break_glass");
  });
});

test("risk-engine integration returns complete factor breakdown", () => {
  withLoadedEngine((engine) => {
    const result = engine.evaluate(createRiskRequest(createHighRiskFactors(), { taskId: "int-breakdown" }));
    assert.equal(result.factorBreakdown.length, 8);
  });
});

test("risk-engine integration supports domain overrides", () => {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-integration-domain-"));
  const configPath = join(tempDir, "risk.json");
  try {
    writeFileSync(configPath, JSON.stringify(createCanonicalRiskConfig()), "utf-8");
    const config = loadRiskConfig(configPath);
    const engine = new RiskEvaluationEngine({
      config,
      domainRiskProfiles: new Map([["regulated-domain", "high" as const]]),
    });

    const result = engine.evaluate(
      createRiskRequest(createLowRiskFactors(), {
        taskId: "int-domain",
        domainId: "regulated-domain",
      }),
    );

    assert.equal(result.riskLevel, "high");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
