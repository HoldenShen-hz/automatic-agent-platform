import assert from "node:assert/strict";
import test from "node:test";

import {
  listExecutionCapabilityBaselines,
  resolveExecutionCapabilityBaseline,
  EXECUTION_CAPABILITY_BASELINES,
} from "../../../../../src/platform/five-plane-execution/execution-plane-baseline.js";
import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";
import {
  GracefulShutdown,
  createGracefulShutdown,
  StartupConsistencyChecker,
  buildDefaultStartupConfigValidator,
  buildEnvironmentProviderReadinessProbe,
  createDefaultStartupConsistencyCheckerOptions,
} from "../../../../../src/platform/five-plane-execution/startup/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function withRegistry(fn: () => Promise<void>): Promise<void> {
  const registry = ServiceRegistry.getInstance();
  try {
    await fn();
  } finally {
    await registry.reset();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests - Startup Capability Baseline
// ─────────────────────────────────────────────────────────────────────────────

test("execution-plane-startup - startup capability baseline exists [execution-plane-startup]", () => {
  const startupBaseline = resolveExecutionCapabilityBaseline("startup");

  assert.equal(startupBaseline.capabilityId, "startup");
  assert.ok(startupBaseline.entryModule.includes("startup"));
  assert.ok(startupBaseline.description.length > 0);
  assert.ok(startupBaseline.baselineServices.includes("StartupConsistencyChecker"));
});

test("execution-plane-startup - startup is listed in all capability baselines [execution-plane-startup]", () => {
  const baselines = listExecutionCapabilityBaselines();
  const startupBaseline = baselines.find((b) => b.capabilityId === "startup");

  assert.ok(startupBaseline !== undefined);
  assert.equal(startupBaseline?.capabilityId, "startup");
});

test("execution-plane-startup - all 14 capability baselines are defined [execution-plane-startup]", () => {
  const baselines = listExecutionCapabilityBaselines();
  assert.equal(baselines.length, 14);
});

test("execution-plane-startup - startup baseline has correct entry module path [execution-plane-startup]", () => {
  const startupBaseline = resolveExecutionCapabilityBaseline("startup");
  assert.equal(
    startupBaseline.entryModule,
    "src/platform/five-plane-execution/startup/index.ts",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests - Startup Components Export
// ─────────────────────────────────────────────────────────────────────────────

test("execution-plane-startup - GracefulShutdown is exported [execution-plane-startup]", () => {
  const shutdown = new GracefulShutdown({ registerSignalHandlers: false });
  assert.equal(typeof shutdown.shutdown, "function");
  assert.equal(typeof shutdown.addHandler, "function");
  assert.equal(typeof shutdown.registerSignalHandlers, "function");
  assert.equal(typeof shutdown.isShuttingDownState, "function");
  shutdown.reset();
});

test("execution-plane-startup - createGracefulShutdown factory works [execution-plane-startup]", () => {
  const shutdown = createGracefulShutdown({ timeoutMs: 5000 });
  assert.ok(shutdown instanceof GracefulShutdown);
  shutdown.reset();
});

test("execution-plane-startup - StartupConsistencyChecker is exported [execution-plane-startup]", () => {
  assert.equal(typeof StartupConsistencyChecker, "function");
});

test("execution-plane-startup - buildDefaultStartupConfigValidator is exported [execution-plane-startup]", () => {
  assert.equal(typeof buildDefaultStartupConfigValidator, "function");
});

test("execution-plane-startup - buildEnvironmentProviderReadinessProbe is exported [execution-plane-startup]", () => {
  assert.equal(typeof buildEnvironmentProviderReadinessProbe, "function");
});

test("execution-plane-startup - createDefaultStartupConsistencyCheckerOptions is exported [execution-plane-startup]", () => {
  assert.equal(typeof createDefaultStartupConsistencyCheckerOptions, "function");
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests - Startup Consistency Checker Options
// ─────────────────────────────────────────────────────────────────────────────

test("execution-plane-startup - createDefaultStartupConsistencyCheckerOptions returns correct shape [execution-plane-startup]", () => {
  const options = createDefaultStartupConsistencyCheckerOptions();

  assert.ok(options !== null);
  assert.equal(typeof options.configValidator, "function");
  assert.equal(typeof options.providerReadinessProbe, "function");
});

test("execution-plane-startup - configValidator returns result with expected shape [execution-plane-startup]", () => {
  const options = createDefaultStartupConsistencyCheckerOptions();
  const result = options.configValidator!();

  assert.ok(result !== null);
  assert.ok("ok" in result);
  assert.ok("environment" in result);
  assert.ok("configRoot" in result);
  assert.ok("issues" in result);
  assert.ok("bundle" in result);
});

test("execution-plane-startup - providerReadinessProbe returns array [execution-plane-startup]", () => {
  const options = createDefaultStartupConsistencyCheckerOptions();
  const result = options.providerReadinessProbe!(null);

  assert.ok(Array.isArray(result));
});

test("execution-plane-startup - providerReadinessProbe with null configValidation returns empty array [execution-plane-startup]", () => {
  const options = createDefaultStartupConsistencyCheckerOptions();
  const result = options.providerReadinessProbe!(null);

  assert.deepEqual(result, []);
});

test("execution-plane-startup - providerReadinessProbe with ok:false configValidation returns empty array [execution-plane-startup]", () => {
  const options = createDefaultStartupConsistencyCheckerOptions();
  const invalidConfig = {
    ok: false,
    environment: "test",
    configRoot: "/test",
    issues: ["test issue"],
    bundle: null,
  };
  const result = options.providerReadinessProbe!(invalidConfig);

  assert.deepEqual(result, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests - Startup Service Registration
// ─────────────────────────────────────────────────────────────────────────────

test("execution-plane-startup - startup capability can be resolved [execution-plane-startup]", () => {
  const baseline = resolveExecutionCapabilityBaseline("startup");
  assert.equal(baseline.capabilityId, "startup");
});

test("execution-plane-startup - resolveExecutionCapabilityBaseline throws for unknown capability [execution-plane-startup]", () => {
  assert.throws(
    () => resolveExecutionCapabilityBaseline("non-existent-capability" as any),
    /execution_capability.not_found/,
  );
});

test("execution-plane-startup - EXECUTION_CAPABILITY_BASELINES contains startup [execution-plane-startup]", () => {
  const startupBaseline = EXECUTION_CAPABILITY_BASELINES.find(
    (b) => b.capabilityId === "startup",
  );

  assert.ok(startupBaseline !== undefined);
  assert.equal(startupBaseline?.baselineServices[0], "StartupConsistencyChecker");
});

test("execution-plane-startup - startup baselineServices contains expected services [execution-plane-startup]", () => {
  const startupBaseline = resolveExecutionCapabilityBaseline("startup");

  assert.ok(startupBaseline.baselineServices.includes("StartupConsistencyChecker"));
});

test("execution-plane-startup - each baseline has required fields [execution-plane-startup]", () => {
  const baselines = listExecutionCapabilityBaselines();

  for (const baseline of baselines) {
    assert.ok(baseline.capabilityId.length > 0);
    assert.ok(baseline.entryModule.length > 0);
    assert.ok(baseline.description.length > 0);
    assert.ok(Array.isArray(baseline.baselineServices));
    assert.ok(baseline.baselineServices.length > 0);
  }
});
