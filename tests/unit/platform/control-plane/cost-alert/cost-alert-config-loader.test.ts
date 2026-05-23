import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";

import { createTempWorkspace, cleanupPath, createFile } from "../../../../helpers/fs.js";
import { partial } from "../../../../helpers/typed-factories.js";
import { clearCostAlertConfigCache, loadCostAlertConfig } from "../../../../../src/platform/five-plane-control-plane/cost-alert/cost-alert-config-loader.js";
import { PolicyDeniedError, ValidationError } from "../../../../../src/platform/contracts/errors.js";
import { createConfigReadPolicy } from "../../../../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";
import type { CostAlertConfig } from "../../../../../src/platform/five-plane-control-plane/cost-alert/cost-alert-types.js";

test("loadCostAlertConfig returns default config when file does not exist (ENOENT)", () => {
  clearCostAlertConfigCache();

  const workspace = createTempWorkspace("cost-alert-test-");
  const nonExistentPath = resolve(workspace, "nonexistent.json");

  try {
    const config = loadCostAlertConfig(nonExistentPath);

    assert.equal(config.enabled, true);
    assert.equal(config.platformBudgetPolicy, null);
    assert.deepEqual(config.tenantBudgetPolicies, {});
    assert.deepEqual(config.packBudgetPolicies, {});
    assert.equal(config.defaultWarningThreshold, 0.8);
  } finally {
    cleanupPath(workspace);
  }
});

test("loadCostAlertConfig throws ValidationError when file is malformed JSON", () => {
  clearCostAlertConfigCache();

  const workspace = createTempWorkspace("cost-alert-test-");
  const malformedPath = resolve(workspace, "malformed.json");

  try {
    createFile(malformedPath, "{ this is not valid json }");

    assert.throws(
      () => loadCostAlertConfig(malformedPath),
      (error: unknown) => error instanceof ValidationError && error.code === "cost_alert.config_invalid",
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("loadCostAlertConfig throws ValidationError when file passes JSON but fails Zod validation", () => {
  clearCostAlertConfigCache();

  const workspace = createTempWorkspace("cost-alert-test-");
  const invalidPath = resolve(workspace, "invalid.json");

  try {
    // Valid JSON but invalid schema (enabled should be boolean, not string)
    createFile(invalidPath, JSON.stringify({
      enabled: "not-a-boolean",
      platformBudgetPolicy: null,
      tenantBudgetPolicies: {},
      packBudgetPolicies: {},
      defaultWarningThreshold: 0.8,
    }));

    assert.throws(
      () => loadCostAlertConfig(invalidPath),
      (error: unknown) => error instanceof ValidationError && error.code === "cost_alert.config_invalid",
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("loadCostAlertConfig throws PolicyDeniedError when path is outside sandbox", () => {
  clearCostAlertConfigCache();

  // Create a policy that only allows /allowed/path
  const sandboxPolicy = createConfigReadPolicy("/allowed/path");
  // Use a path outside the allowed roots
  const outsidePath = "/etc/passwd";

  try {
    assert.throws(
      () => loadCostAlertConfig(outsidePath, sandboxPolicy),
      (error: unknown) => {
        return error instanceof PolicyDeniedError;
      },
      "Should throw PolicyDeniedError when path is outside sandbox policy",
    );
  } finally {
    clearCostAlertConfigCache();
  }
});

test("clearCostAlertConfigCache clears the cache", () => {
  clearCostAlertConfigCache();

  // Load config to populate cache
  const config1 = loadCostAlertConfig();

  // Clear the cache
  clearCostAlertConfigCache();

  // Load again - should get a fresh instance
  const config2 = loadCostAlertConfig();

  // They should not be the same object reference since cache was cleared
  assert.notEqual(config1, config2, "Fresh instance after cache clear");
});

test("loadCostAlertConfig caches result", () => {
  clearCostAlertConfigCache();

  const config1 = loadCostAlertConfig();
  const config2 = loadCostAlertConfig();

  assert.equal(config1, config2, "Same instance returned from cache");
});

test("loadCostAlertConfig returns default config for empty object", () => {
  clearCostAlertConfigCache();

  const workspace = createTempWorkspace("cost-alert-test-");
  const emptyPath = resolve(workspace, "empty.json");

  try {
    createFile(emptyPath, JSON.stringify({}));

    const config = loadCostAlertConfig(emptyPath);

    // Empty object should use defaults via Zod defaults
    assert.equal(config.enabled, true);
    assert.equal(config.defaultWarningThreshold, 0.8);
  } finally {
    cleanupPath(workspace);
  }
});

test("loadCostAlertConfig loads valid config from custom path", () => {
  clearCostAlertConfigCache();

  const workspace = createTempWorkspace("cost-alert-test-");
  const validPath = resolve(workspace, "valid.json");

  try {
    const validConfig: CostAlertConfig = {
      enabled: false,
      platformBudgetPolicy: {
        scope: "platform",
        scopeId: "platform-main",
        period: "monthly",
        limitCostUsd: 1000,
        warningThreshold: 0.75,
        actionsOnWarning: ["sev1_alert"],
        actionsOnBreach: ["workflow_pause"],
      },
      tenantBudgetPolicies: {},
      packBudgetPolicies: {},
      stepBudgetPolicies: {},
      defaultWarningThreshold: 0.9,
      minAlertIntervalMs: 60_000,
    };

    createFile(validPath, JSON.stringify(validConfig, null, 2));

    const config = loadCostAlertConfig(validPath);

    assert.equal(config.enabled, false);
    assert.equal(config.defaultWarningThreshold, 0.9);
    assert.ok(config.platformBudgetPolicy);
    assert.equal(config.platformBudgetPolicy?.scope, "platform");
    assert.equal(config.platformBudgetPolicy?.limitCostUsd, 1000);
  } finally {
    cleanupPath(workspace);
    clearCostAlertConfigCache();
  }
});

test("loadCostAlertConfig uses partial helper for minimal overrides", () => {
  clearCostAlertConfigCache();

  const workspace = createTempWorkspace("cost-alert-test-");
  const partialPath = resolve(workspace, "partial.json");

  try {
    // Only override enabled - rest should get defaults
    const partialConfig = partial<CostAlertConfig>({
      enabled: false,
    });

    createFile(partialPath, JSON.stringify(partialConfig));

    const config = loadCostAlertConfig(partialPath);

    // Should use defaults for unspecified fields
    assert.equal(config.enabled, false);
    assert.equal(config.defaultWarningThreshold, 0.8);
    assert.equal(config.platformBudgetPolicy, null);
  } finally {
    cleanupPath(workspace);
    clearCostAlertConfigCache();
  }
});
