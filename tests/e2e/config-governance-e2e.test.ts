/**
 * E2E Config Governance Tests
 *
 * End-to-end tests covering configuration governance:
 * - Configuration bundle loading and validation
 * - Tampering detection via version comparison
 * - Bundle diffing between configurations
 * - Production safety checks
 * - Layer schema validation
 *
 * Issue: R15-87 | Missing config-governance e2e tests
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { ConfigGovernanceService } from "../../src/platform/five-plane-control-plane/config-center/config-governance-service.js";
import { createWorkspaceWritePolicy } from "../../src/platform/five-plane-control-plane/iam/sandbox-policy.js";

// ---------------------------------------------------------------------------
// Helper: Create a temporary config structure for testing
// ---------------------------------------------------------------------------

function createTempConfigRoot(workspace: string, environment: string = "dev") {
  const configRoot = join(workspace, "config");
  const layers = ["bootstrap", "gateways", "providers", "runtime", "security", "workflows"];

  for (const layer of layers) {
    const layerDir = join(configRoot, layer);
    mkdirSync(layerDir, { recursive: true });

    // Create default.json for each layer
    let defaultContent: Record<string, unknown>;
    switch (layer) {
      case "bootstrap":
        defaultContent = { appName: "test-app", phase: environment, stableCoreEnabled: true, dependencyOrder: ["core"] };
        break;
      case "gateways":
        defaultContent = { defaultTimeout: 5000, retryAttempts: 3 };
        break;
      case "providers":
        defaultContent = { defaultProvider: "openai", defaultModelProfile: "gpt-4" };
        break;
      case "runtime":
        defaultContent = { maxRetries: 3, timeoutMs: 60000, concurrentLimit: 100 };
        break;
      case "security":
        defaultContent = { sandboxMode: "workspace_read", allowDestructiveActions: false };
        break;
      case "workflows":
        defaultContent = { maxSteps: 50, checkpointIntervalMs: 30000 };
        break;
      default:
        defaultContent = {};
    }
    writeFileSync(join(layerDir, "default.json"), JSON.stringify(defaultContent, null, 2));

    // Create environment-specific override
    if (environment !== "dev") {
      writeFileSync(join(layerDir, `${environment}.json`), JSON.stringify({ phase: environment }, null, 2));
    }
  }

  return configRoot;
}

// ---------------------------------------------------------------------------
// Test 1: Load a valid configuration bundle
// ---------------------------------------------------------------------------

test("E2E Config Governance: loads a valid configuration bundle", () => {
  const harness = createE2EHarness("aa-e2e-config-governance-");
  try {
    const configRoot = createTempConfigRoot(harness.workspace);
    const service = new ConfigGovernanceService({ configRoot });

    const bundle = service.loadBundle("dev");

    assert.ok(bundle.version.versionId, "Should have versionId");
    assert.ok(bundle.version.bundleHash, "Should have bundleHash");
    assert.equal(bundle.environment, "dev");
    assert.ok(bundle.layers.bootstrap, "Should have bootstrap layer");
    assert.ok(bundle.layers.gateways, "Should have gateways layer");
    assert.ok(bundle.layers.providers, "Should have providers layer");
    assert.ok(bundle.layers.runtime, "Should have runtime layer");
    assert.ok(bundle.layers.security, "Should have security layer");
    assert.ok(bundle.layers.workflows, "Should have workflows layer");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Detect tampering when version ID changes
// ---------------------------------------------------------------------------

test("E2E Config Governance: detects tampering when configuration is modified", () => {
  const harness = createE2EHarness("aa-e2e-config-governance-tamper-");
  try {
    const configRoot = createTempConfigRoot(harness.workspace);
    const service = new ConfigGovernanceService({ configRoot });

    // Load initial bundle and record version
    const originalBundle = service.loadBundle("dev");
    const originalVersionId = originalBundle.version.versionId;

    // Tamper with the configuration
    const runtimeDefault = join(configRoot, "runtime", "default.json");
    const originalContent = JSON.parse(require("node:fs").readFileSync(runtimeDefault, "utf8"));
    originalContent.maxRetries = 10; // Change a value
    writeFileSync(runtimeDefault, JSON.stringify(originalContent, null, 2));

    // Detect tampering
    const result = service.detectTampering(originalVersionId, "dev");

    assert.equal(result.tampered, true, "Should detect tampering");
    assert.notEqual(result.currentVersion, originalVersionId, "Version should differ");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Bundle diffing shows differences between configs
// ---------------------------------------------------------------------------

test("E2E Config Governance: diffBundles shows differences between configs", () => {
  const harness = createE2EHarness("aa-e2e-config-governance-diff-");
  try {
    const configRoot = createTempConfigRoot(harness.workspace);
    const service = new ConfigGovernanceService({ configRoot });

    const bundle1 = service.loadBundle("dev");

    // Modify a config value
    const runtimeDefault = join(configRoot, "runtime", "default.json");
    const originalContent = JSON.parse(require("node:fs").readFileSync(runtimeDefault, "utf8"));
    originalContent.maxRetries = 999;
    writeFileSync(runtimeDefault, JSON.stringify(originalContent, null, 2));

    const bundle2 = service.loadBundle("dev");

    const diffs = service.diffBundles(bundle1, bundle2);

    assert.ok(diffs.length > 0, "Should have differences");
    const maxRetriesDiff = diffs.find(d => d.path.includes("maxRetries"));
    assert.ok(maxRetriesDiff, "Should find maxRetries difference");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: Validate bundle detects missing required layers
// ---------------------------------------------------------------------------

test("E2E Config Governance: validateBundle detects missing required layers", () => {
  const harness = createE2EHarness("aa-e2e-config-governance-validate-");
  try {
    const configRoot = createTempConfigRoot(harness.workspace);
    const service = new ConfigGovernanceService({ configRoot });

    // Remove a required layer directory
    rmSync(join(configRoot, "workflows"), { recursive: true });

    const bundle = service.loadBundle("dev");
    const issues = service.validateBundle(bundle);

    assert.ok(issues.some(i => i.includes("missing_layer")), "Should detect missing layer");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: Production environment enforces destructive actions check
// ---------------------------------------------------------------------------

test("E2E Config Governance: prod environment requires allowDestructiveActions=false", () => {
  const harness = createE2EHarness("aa-e2e-config-governance-prod-");
  try {
    const configRoot = createTempConfigRoot(harness.workspace, "prod");
    const service = new ConfigGovernanceService({ configRoot });

    const bundle = service.loadBundle("prod");
    const issues = service.validateBundle(bundle);

    // Production should have allowDestructiveActions: false in security layer
    assert.ok(!issues.includes("config.prod_destructive_actions_denied"), "Prod should pass safety check");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 6: Detect tampering when bundle validation fails
// ---------------------------------------------------------------------------

test("E2E Config Governance: detectTampering flags bundle with validation issues", () => {
  const harness = createE2EHarness("aa-e2e-config-governance-validation-");
  try {
    const configRoot = createTempConfigRoot(harness.workspace);
    const service = new ConfigGovernanceService({ configRoot });

    // Load original and get version
    const originalBundle = service.loadBundle("dev");
    const originalVersionId = originalBundle.version.versionId;

    // Add invalid config that will cause validation issues
    const bootstrapDefault = join(configRoot, "bootstrap", "default.json");
    const originalBootstrap = JSON.parse(require("node:fs").readFileSync(bootstrapDefault, "utf8"));
    originalBootstrap.appName = ""; // Invalid - minLength: 1
    writeFileSync(bootstrapDefault, JSON.stringify(originalBootstrap, null, 2));

    const result = service.detectTampering(originalVersionId, "dev");

    assert.equal(result.tampered, true, "Should detect tampering");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 7: Bundle version includes layer hashes
// ---------------------------------------------------------------------------

test("E2E Config Governance: bundle version includes layer hashes", () => {
  const harness = createE2EHarness("aa-e2e-config-governance-layerhash-");
  try {
    const configRoot = createTempConfigRoot(harness.workspace);
    const service = new ConfigGovernanceService({ configRoot });

    const bundle = service.loadBundle("dev");

    assert.ok(bundle.version.layerHashes, "Should have layer hashes");
    assert.ok(bundle.version.layerHashes.bootstrap, "Should have bootstrap hash");
    assert.ok(bundle.version.layerHashes.runtime, "Should have runtime hash");
    assert.ok(bundle.version.generatedAt, "Should have generatedAt");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 8: Same config produces same version ID deterministically
// ---------------------------------------------------------------------------

test("E2E Config Governance: same config produces same version ID", () => {
  const harness = createE2EHarness("aa-e2e-config-governance-deterministic-");
  try {
    const configRoot1 = createTempConfigRoot(harness.workspace + "-1");
    const configRoot2 = createTempConfigRoot(harness.workspace + "-2");

    const service1 = new ConfigGovernanceService({ configRoot: configRoot1 });
    const service2 = new ConfigGovernanceService({ configRoot: configRoot2 });

    const bundle1 = service1.loadBundle("dev");
    const bundle2 = service2.loadBundle("dev");

    // Same config should produce same version ID
    assert.equal(bundle1.version.versionId, bundle2.version.versionId, "Version IDs should match for identical config");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// End of E2E Config Governance Tests
// ---------------------------------------------------------------------------