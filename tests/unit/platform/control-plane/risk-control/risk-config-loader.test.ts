import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { createCanonicalRiskConfig } from "../../../../helpers/risk-control.js";
import { loadRiskConfig } from "../../../../../src/platform/control-plane/risk-control/risk-config-loader.js";

function withTempConfig(body: (configPath: string) => void): void {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-config-test-"));
  const configPath = join(tempDir, "risk.json");
  try {
    body(configPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test("loadRiskConfig parses canonical config file", () => {
  withTempConfig((configPath) => {
    writeFileSync(configPath, JSON.stringify(createCanonicalRiskConfig()), "utf-8");

    const config = loadRiskConfig(configPath);

    assert.equal(config.factorWeights.operationRisk, 3);
    assert.equal(config.factorWeights.targetResourceCriticality, 3);
    assert.equal(config.riskLevelActions.medium.requiresApproval, true);
    assert.equal(config.riskLevelActions.medium.approvalType, "standard");
    assert.equal(config.riskLevelActions.critical.approvalType, "break_glass");
  });
});

test("loadRiskConfig preserves 8 canonical factor keys", () => {
  withTempConfig((configPath) => {
    writeFileSync(configPath, JSON.stringify(createCanonicalRiskConfig()), "utf-8");

    const config = loadRiskConfig(configPath);

    assert.deepEqual(Object.keys(config.factorWeights), [
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
});

test("loadRiskConfig rejects invalid JSON", () => {
  withTempConfig((configPath) => {
    writeFileSync(configPath, "{ invalid json", "utf-8");
    assert.throws(() => loadRiskConfig(configPath), /risk_config\.parse_failed/);
  });
});

test("loadRiskConfig rejects malformed canonical schema", () => {
  withTempConfig((configPath) => {
    const invalidConfig = createCanonicalRiskConfig() as Record<string, unknown>;
    delete invalidConfig.factorWeights;
    writeFileSync(configPath, JSON.stringify(invalidConfig), "utf-8");

    assert.throws(() => loadRiskConfig(configPath));
  });
});
