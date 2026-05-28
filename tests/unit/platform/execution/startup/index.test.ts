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

const sampleFinding: ConsistencyFinding = {
  code: "config_invalid",
  severity: "p0",
  message: "config issue",
  entityType: "config",
  entityId: "providers/default",
};

const sampleRepairAction: RepairAction = {
  action: "manual_intervention_required",
  reasonCode: sampleFinding.code,
  targetType: sampleFinding.entityType,
  targetId: sampleFinding.entityId,
};

const sampleConfigValidation: StartupConfigValidationResult = {
  ok: false,
  environment: "test",
  configRoot: "/workspace/config",
  issues: ["config invalid"],
  bundle: null,
};

const sampleProviderReadiness: ProviderReadinessResult = {
  provider: "openai",
  ready: false,
  reasonCode: "provider.credentials_missing",
  message: "missing credentials",
};

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
  const options: StartupConsistencyCheckerOptions = {
    configValidator: () => sampleConfigValidation,
    providerReadinessProbe: () => [sampleProviderReadiness],
    onTrafficBlocked: () => undefined,
  };
  assert.equal(options.configValidator?.().issues[0], "config invalid");
  assert.equal(options.providerReadinessProbe?.(sampleConfigValidation)[0]?.provider, "openai");
  assert.equal(typeof options.onTrafficBlocked, "function");
});

test("startup/index.ts - exports StartupConsistencyReport interface [index]", () => {
  const report: StartupConsistencyReport = {
    checkedAt: "2026-05-28T00:00:00.000Z",
    status: "repairable",
    findings: [sampleFinding],
    repairActions: [sampleRepairAction],
  };
  assert.equal(report.status, "repairable");
  assert.equal(report.findings[0]?.code, "config_invalid");
  assert.equal(report.repairActions[0]?.action, "manual_intervention_required");
});

test("startup/index.ts - exports StartupConsistencyOptions interface [index]", () => {
  const options: StartupConsistencyOptions = {
    now: "2026-05-28T00:00:00.000Z",
    staleExecutionAfterMs: 60_000,
    pendingAckOlderThanMs: 30_000,
  };
  assert.equal(options.now, "2026-05-28T00:00:00.000Z");
  assert.equal(options.staleExecutionAfterMs, 60_000);
  assert.equal(options.pendingAckOlderThanMs, 30_000);
});

test("startup/index.ts - exports ConsistencyFinding interface [index]", () => {
  assert.equal(sampleFinding.severity, "p0");
  assert.equal(sampleFinding.entityType, "config");
  assert.equal(sampleFinding.message, "config issue");
});

test("startup/index.ts - exports RepairAction interface [index]", () => {
  assert.equal(sampleRepairAction.action, "manual_intervention_required");
  assert.equal(sampleRepairAction.reasonCode, "config_invalid");
  assert.equal(sampleRepairAction.targetId, "providers/default");
});

test("startup/index.ts - exports StartupConfigValidationResult interface [index]", () => {
  assert.equal(sampleConfigValidation.ok, false);
  assert.equal(sampleConfigValidation.environment, "test");
  assert.equal(sampleConfigValidation.bundle, null);
});

test("startup/index.ts - exports ProviderReadinessResult interface [index]", () => {
  assert.equal(sampleProviderReadiness.provider, "openai");
  assert.equal(sampleProviderReadiness.ready, false);
  assert.equal(sampleProviderReadiness.reasonCode, "provider.credentials_missing");
});

test("startup/index.ts - exports ConsistencySeverity type [index]", () => {
  const severity: ConsistencySeverity = "p1";
  assert.equal(severity, "p1");
});

test("startup/index.ts - exports StartupReportStatus type [index]", () => {
  const status: StartupReportStatus = "fail_closed";
  assert.equal(status, "fail_closed");
});

test("startup/index.ts - exports RepairActionType type [index]", () => {
  const actionType: RepairActionType = "reconcile_dispatch_ticket";
  assert.equal(actionType, "reconcile_dispatch_ticket");
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
