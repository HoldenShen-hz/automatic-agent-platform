import assert from "node:assert/strict";
import test from "node:test";

import * as StartupModule from "../../../../../src/platform/five-plane-execution/startup/index.js";
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
} from "../../../../../src/platform/five-plane-execution/startup/index.js";

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

test("startup/index.ts - exports GracefulShutdown class [index]", () => {
  assert.ok("GracefulShutdown" in StartupModule);
  assert.equal(typeof StartupModule.GracefulShutdown, "function");
});

test("startup/index.ts - exports createGracefulShutdown factory [index]", () => {
  assert.ok("createGracefulShutdown" in StartupModule);
  assert.equal(typeof StartupModule.createGracefulShutdown, "function");
});

test("startup/index.ts - exports getGlobalGracefulShutdown [index]", () => {
  assert.ok("getGlobalGracefulShutdown" in StartupModule);
  assert.equal(typeof StartupModule.getGlobalGracefulShutdown, "function");
});

test("startup/index.ts - exports createUncaughtExceptionHandler [index]", () => {
  assert.ok("createUncaughtExceptionHandler" in StartupModule);
  assert.equal(typeof StartupModule.createUncaughtExceptionHandler, "function");
});

test("startup/index.ts - exports createUnhandledRejectionHandler [index]", () => {
  assert.ok("createUnhandledRejectionHandler" in StartupModule);
  assert.equal(typeof StartupModule.createUnhandledRejectionHandler, "function");
});

test("startup/index.ts - exports registerProcessErrorHandlers [index]", () => {
  assert.ok("registerProcessErrorHandlers" in StartupModule);
  assert.equal(typeof StartupModule.registerProcessErrorHandlers, "function");
});

test("startup/index.ts - exports StartupConsistencyChecker [index]", () => {
  assert.ok("StartupConsistencyChecker" in StartupModule);
  assert.equal(typeof StartupModule.StartupConsistencyChecker, "function");
});

test("startup/index.ts - exports StartupConsistencyCheckerOptions interface [index]", () => {
  assert.ok(true);
});

test("startup/index.ts - exports StartupConsistencyReport interface [index]", () => {
  assert.ok(true);
});

test("startup/index.ts - exports StartupConsistencyOptions interface [index]", () => {
  assert.ok(true);
});

test("startup/index.ts - exports ConsistencyFinding interface [index]", () => {
  assert.ok(true);
});

test("startup/index.ts - exports RepairAction interface [index]", () => {
  assert.ok(true);
});

test("startup/index.ts - exports StartupConfigValidationResult interface [index]", () => {
  assert.ok(true);
});

test("startup/index.ts - exports ProviderReadinessResult interface [index]", () => {
  assert.ok(true);
});

test("startup/index.ts - exports ConsistencySeverity type [index]", () => {
  assert.ok(true);
});

test("startup/index.ts - exports StartupReportStatus type [index]", () => {
  assert.ok(true);
});

test("startup/index.ts - exports RepairActionType type [index]", () => {
  assert.ok(true);
});

test("startup/index.ts - exports buildDefaultStartupConfigValidator [index]", () => {
  assert.ok("buildDefaultStartupConfigValidator" in StartupModule);
  assert.equal(typeof StartupModule.buildDefaultStartupConfigValidator, "function");
});

test("startup/index.ts - exports buildEnvironmentProviderReadinessProbe [index]", () => {
  assert.ok("buildEnvironmentProviderReadinessProbe" in StartupModule);
  assert.equal(typeof StartupModule.buildEnvironmentProviderReadinessProbe, "function");
});

test("startup/index.ts - exports createDefaultStartupConsistencyCheckerOptions [index]", () => {
  assert.ok("createDefaultStartupConsistencyCheckerOptions" in StartupModule);
  assert.equal(typeof StartupModule.createDefaultStartupConsistencyCheckerOptions, "function");
});

test("startup/index.ts - exports deriveProviderApiKeyEnvName [index]", () => {
  assert.ok("deriveProviderApiKeyEnvName" in StartupModule);
  assert.equal(typeof StartupModule.deriveProviderApiKeyEnvName, "function");
});

test("startup/index.ts - exports deriveProviderApiKeysJsonEnvNameForStartup [index]", () => {
  assert.ok("deriveProviderApiKeysJsonEnvNameForStartup" in StartupModule);
  assert.equal(typeof StartupModule.deriveProviderApiKeysJsonEnvNameForStartup, "function");
});

test("startup/index.ts - exports deriveProviderApiKeySecretRefEnvNameForStartup [index]", () => {
  assert.ok("deriveProviderApiKeySecretRefEnvNameForStartup" in StartupModule);
  assert.equal(typeof StartupModule.deriveProviderApiKeySecretRefEnvNameForStartup, "function");
});

test("startup/index.ts - exports deriveProviderApiKeySecretRefsJsonEnvNameForStartup [index]", () => {
  assert.ok("deriveProviderApiKeySecretRefsJsonEnvNameForStartup" in StartupModule);
  assert.equal(typeof StartupModule.deriveProviderApiKeySecretRefsJsonEnvNameForStartup, "function");
});
