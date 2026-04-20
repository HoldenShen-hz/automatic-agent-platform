import assert from "node:assert/strict";
import test from "node:test";

import type {
  PlatformOperatorBuildInput,
  PlatformOperatorExecutionPlaneSummary,
  PlatformOperatorReport,
  PlatformOperatorExportResult,
  PlatformOperatorServiceOptions,
} from "../../../../src/scale-ecosystem/marketplace/platform-operator-service.js";
import type { EnvironmentName, WorkerSchedulingStatus, ExecutionTicketRecord, ExecutionLeaseRecord, EnvironmentReadinessComponentType } from "../../../../src/platform/contracts/types/domain.js";
import type { StableGateTargetStatus } from "../../../../src/platform/shared/stability/stable-release-gate.js";

test("EnvironmentName accepts all valid values", () => {
  const names: EnvironmentName[] = ["dev", "test", "staging", "pre-prod", "prod"];
  assert.equal(names.length, 5);
});

test("StableGateTargetStatus accepts all valid values", () => {
  const statuses: StableGateTargetStatus[] = ["canary", "tenant_gray", "production_ready"];
  assert.equal(statuses.length, 3);
});

test("PlatformOperatorBuildInput structure is correct", () => {
  const input: PlatformOperatorBuildInput = {
    environment: "prod",
    evidenceRootDir: "/var/evidence",
    packageOutputDir: "/var/packages",
  };

  assert.equal(input.environment, "prod");
  assert.equal(input.evidenceRootDir, "/var/evidence");
  assert.equal(input.packageOutputDir, "/var/packages");
});

test("PlatformOperatorBuildInput allows optional fields", () => {
  const input: PlatformOperatorBuildInput = {
    environment: "staging",
    evidenceRootDir: "/var/evidence/staging",
    packageOutputDir: "/var/packages/staging",
    targetStatus: "canary",
    generatedAt: "2026-04-14T00:00:00.000Z",
  };

  assert.equal(input.targetStatus, "canary");
  assert.equal(input.generatedAt, "2026-04-14T00:00:00.000Z");
});

test("WorkerSchedulingStatus accepts all valid values", () => {
  const statuses: WorkerSchedulingStatus[] = [
    "healthy",
    "degraded",
    "draining",
    "quarantined",
    "offline",
    "unavailable",
  ];
  assert.equal(statuses.length, 6);
});

test("ExecutionTicketRecord status accepts all valid values", () => {
  const statuses: ExecutionTicketRecord["status"][] = [
    "pending",
    "claimed",
    "consumed",
    "expired",
  ];
  assert.equal(statuses.length, 4);
});

test("ExecutionLeaseRecord status accepts all valid values", () => {
  const statuses: ExecutionLeaseRecord["status"][] = [
    "active",
    "expired",
    "released",
  ];
  assert.equal(statuses.length, 3);
});

test("EnvironmentReadinessComponentType accepts all valid values", () => {
  const types: EnvironmentReadinessComponentType[] = [
    "provider",
    "gateway",
    "sandbox",
    "worker_fleet",
    "artifact_store",
  ];
  assert.equal(types.length, 5);
});

test("PlatformOperatorServiceOptions structure is correct", () => {
  const options: PlatformOperatorServiceOptions = {
    artifactStoreOptions: {
      rootDir: "/var/platform/artifacts",
    },
    staleWorkerThresholdMs: 600000,
    readinessStaleThresholdMs: 86400000,
  };

  assert.ok(options.artifactStoreOptions !== undefined);
  assert.equal(options.staleWorkerThresholdMs, 600000);
  assert.equal(options.readinessStaleThresholdMs, 86400000);
});

test("PlatformOperatorServiceOptions allows empty options", () => {
  const options: PlatformOperatorServiceOptions = {};
  assert.equal(options.artifactStoreOptions, undefined);
  assert.equal(options.staleWorkerThresholdMs, undefined);
});

test("PlatformOperatorServiceOptions allows partial options", () => {
  const options: PlatformOperatorServiceOptions = {
    staleWorkerThresholdMs: 300000,
  };

  assert.equal(options.staleWorkerThresholdMs, 300000);
  assert.equal(options.artifactStoreOptions, undefined);
});
