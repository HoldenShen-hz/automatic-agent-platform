import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { createCanonicalRiskConfig } from "../../../../helpers/risk-control.js";
import { createConfigReadPolicy, checkSandboxPath } from "../../../../../src/platform/control-plane/iam/sandbox-policy.js";
import { loadRiskConfig } from "../../../../../src/platform/control-plane/risk-control/risk-config-loader.js";

function withSandboxConfig(body: (configRoot: string, configPath: string) => void): void {
  const tempDir = mkdtempSync(join("/", "tmp", "risk-sandbox-test-"));
  const configRoot = join(tempDir, "config");
  const configPath = join(configRoot, "risk.json");
  mkdirSync(configRoot, { recursive: true });
  writeFileSync(configPath, JSON.stringify(createCanonicalRiskConfig()), "utf-8");
  try {
    body(configRoot, configPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

test("loadRiskConfig allows paths inside sandbox roots", () => {
  withSandboxConfig((configRoot, configPath) => {
    const policy = createConfigReadPolicy(configRoot);
    const config = loadRiskConfig(configPath, policy);
    assert.equal(config.factorWeights.operationRisk, 3);
  });
});

test("loadRiskConfig denies paths outside sandbox roots", () => {
  withSandboxConfig((_configRoot, configPath) => {
    const policy = createConfigReadPolicy("/completely/different/path");
    assert.throws(() => loadRiskConfig(configPath, policy));
  });
});

test("loadRiskConfig denies obvious traversal targets", () => {
  withSandboxConfig((configRoot) => {
    const policy = createConfigReadPolicy(configRoot);
    assert.throws(() => loadRiskConfig("/etc/passwd", policy));
  });
});

test("checkSandboxPath returns normalized allowed path", () => {
  withSandboxConfig((configRoot, configPath) => {
    const policy = createConfigReadPolicy(configRoot);
    const result = checkSandboxPath(policy, configPath);
    assert.equal(result.allowed, true);
    assert.ok(result.normalizedPath.length > 0);
  });
});

test("loadRiskConfig still works without sandbox policy", () => {
  withSandboxConfig((_configRoot, configPath) => {
    const config = loadRiskConfig(configPath);
    assert.equal(config.riskLevelActions.medium.approvalType, "standard");
  });
});

test("loadRiskConfig surfaces missing-file errors after sandbox approval", () => {
  withSandboxConfig((configRoot) => {
    const policy = createConfigReadPolicy(configRoot);
    const missingPath = join(configRoot, "missing.json");
    assert.throws(() => loadRiskConfig(missingPath, policy));
  });
});
