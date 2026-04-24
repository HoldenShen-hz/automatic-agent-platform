import assert from "node:assert/strict";
import test from "node:test";

import * as StartupModule from "../../../../../src/platform/execution/startup/index.js";
import type {
  StartupConsistencyCheckerOptions,
  StartupConsistencyReport,
  StartupConsistencyOptions,
  ConsistencyFinding,
  RepairAction,
  StartupConfigValidationResult,
  ProviderReadinessResult,
  ConsistencySeverity,
  StartupReportStatus,
  RepairActionType,
} from "../../../../../src/platform/execution/startup/index.js";

type StartupIndexTypeExports = [
  StartupConsistencyCheckerOptions,
  StartupConsistencyReport,
  StartupConsistencyOptions,
  ConsistencyFinding,
  RepairAction,
  StartupConfigValidationResult,
  ProviderReadinessResult,
  ConsistencySeverity,
  StartupReportStatus,
  RepairActionType,
];
void (null as unknown as StartupIndexTypeExports);

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

test("startup/index.ts - exports StartupConsistencyCheckerOptions interface", () => {
  assert.ok(true);
});

test("startup/index.ts - exports StartupConsistencyReport interface", () => {
  assert.ok(true);
});

test("startup/index.ts - exports StartupConsistencyOptions interface", () => {
  assert.ok(true);
});

test("startup/index.ts - exports ConsistencyFinding interface", () => {
  assert.ok(true);
});

test("startup/index.ts - exports RepairAction interface", () => {
  assert.ok(true);
});

test("startup/index.ts - exports StartupConfigValidationResult interface", () => {
  assert.ok(true);
});

test("startup/index.ts - exports ProviderReadinessResult interface", () => {
  assert.ok(true);
});

test("startup/index.ts - exports ConsistencySeverity type", () => {
  assert.ok(true);
});

test("startup/index.ts - exports StartupReportStatus type", () => {
  assert.ok(true);
});

test("startup/index.ts - exports RepairActionType type", () => {
  assert.ok(true);
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
