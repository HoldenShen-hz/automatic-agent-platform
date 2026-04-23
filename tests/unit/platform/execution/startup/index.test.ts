import assert from "node:assert/strict";
import test from "node:test";

import * as StartupModule from "../../../../../src/platform/execution/startup/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Tests - index.ts barrel exports
// ─────────────────────────────────────────────────────────────────────────────

test("startup/index.ts - exports GracefulShutdown class", () => {
  assert.ok("GracefulShutdown" in StartupModule);
  assert.equal(typeof StartupModule.GracefulShutdown, "function");
});

test("startup/index.ts - exports createGracefulShutdown factory", () => {
  assert.ok("createGracefulShutdown" in StartupModule);
  assert.equal(typeof StartupModule.createGracefulShutdown, "function");
});

test("startup/index.ts - exports getGlobalGracefulShutdown", () => {
  assert.ok("getGlobalGracefulShutdown" in StartupModule);
  assert.equal(typeof StartupModule.getGlobalGracefulShutdown, "function");
});

test("startup/index.ts - exports createUncaughtExceptionHandler", () => {
  assert.ok("createUncaughtExceptionHandler" in StartupModule);
  assert.equal(typeof StartupModule.createUncaughtExceptionHandler, "function");
});

test("startup/index.ts - exports createUnhandledRejectionHandler", () => {
  assert.ok("createUnhandledRejectionHandler" in StartupModule);
  assert.equal(typeof StartupModule.createUnhandledRejectionHandler, "function");
});

test("startup/index.ts - exports registerProcessErrorHandlers", () => {
  assert.ok("registerProcessErrorHandlers" in StartupModule);
  assert.equal(typeof StartupModule.registerProcessErrorHandlers, "function");
});

test("startup/index.ts - exports StartupConsistencyChecker", () => {
  assert.ok("StartupConsistencyChecker" in StartupModule);
  assert.equal(typeof StartupModule.StartupConsistencyChecker, "function");
});

// Interfaces and types are not runtime values and cannot be checked with 'in' operator
// These tests verify TypeScript compilation but cannot work as runtime tests
test.skip("startup/index.ts - exports StartupConsistencyCheckerOptions interface", () => {
  // Interface - cannot be checked at runtime
});

test.skip("startup/index.ts - exports StartupConsistencyReport interface", () => {
  // Interface - cannot be checked at runtime
});

test.skip("startup/index.ts - exports StartupConsistencyOptions interface", () => {
  // Interface - cannot be checked at runtime
});

test.skip("startup/index.ts - exports ConsistencyFinding interface", () => {
  // Interface - cannot be checked at runtime
});

test.skip("startup/index.ts - exports RepairAction interface", () => {
  // Interface - cannot be checked at runtime
});

test.skip("startup/index.ts - exports StartupConfigValidationResult interface", () => {
  // Interface - cannot be checked at runtime
});

test.skip("startup/index.ts - exports ProviderReadinessResult interface", () => {
  // Interface - cannot be checked at runtime
});

test.skip("startup/index.ts - exports ConsistencySeverity type", () => {
  // Type alias - cannot be checked at runtime
});

test.skip("startup/index.ts - exports StartupReportStatus type", () => {
  // Type alias - cannot be checked at runtime
});

test.skip("startup/index.ts - exports RepairActionType type", () => {
  // Type alias - cannot be checked at runtime
});

test("startup/index.ts - exports buildDefaultStartupConfigValidator", () => {
  assert.ok("buildDefaultStartupConfigValidator" in StartupModule);
  assert.equal(typeof StartupModule.buildDefaultStartupConfigValidator, "function");
});

test("startup/index.ts - exports buildEnvironmentProviderReadinessProbe", () => {
  assert.ok("buildEnvironmentProviderReadinessProbe" in StartupModule);
  assert.equal(typeof StartupModule.buildEnvironmentProviderReadinessProbe, "function");
});

test("startup/index.ts - exports createDefaultStartupConsistencyCheckerOptions", () => {
  assert.ok("createDefaultStartupConsistencyCheckerOptions" in StartupModule);
  assert.equal(typeof StartupModule.createDefaultStartupConsistencyCheckerOptions, "function");
});

test("startup/index.ts - exports deriveProviderApiKeyEnvName", () => {
  assert.ok("deriveProviderApiKeyEnvName" in StartupModule);
  assert.equal(typeof StartupModule.deriveProviderApiKeyEnvName, "function");
});

test("startup/index.ts - exports deriveProviderApiKeysJsonEnvNameForStartup", () => {
  assert.ok("deriveProviderApiKeysJsonEnvNameForStartup" in StartupModule);
  assert.equal(typeof StartupModule.deriveProviderApiKeysJsonEnvNameForStartup, "function");
});

test("startup/index.ts - exports deriveProviderApiKeySecretRefEnvNameForStartup", () => {
  assert.ok("deriveProviderApiKeySecretRefEnvNameForStartup" in StartupModule);
  assert.equal(typeof StartupModule.deriveProviderApiKeySecretRefEnvNameForStartup, "function");
});

test("startup/index.ts - exports deriveProviderApiKeySecretRefsJsonEnvNameForStartup", () => {
  assert.ok("deriveProviderApiKeySecretRefsJsonEnvNameForStartup" in StartupModule);
  assert.equal(typeof StartupModule.deriveProviderApiKeySecretRefsJsonEnvNameForStartup, "function");
});
