import assert from "node:assert/strict";
import test from "node:test";

// Stability module barrel - re-exports stability-related services and utilities
import {
  BenchmarkInventoryService,
  DeploymentInventoryService,
  EnvironmentReadinessOrchestrationService,
  VcrFixtureStore,
  runGoldenTaskCase,
  runStableBackupRestoreRehearsal,
  runStableChaosSmoke,
  runStableConcurrencyRehearsal,
  runStableCrossDivisionRecoveryDrill,
  runStableDbQueueDisconnectRehearsal,
  runStableDbWritabilityRehearsal,
  runStableDispatchReconciliationRehearsal,
  runStableDispatchRehearsal,
  runStableEventReplayRehearsal,
  runStableEvidenceCampaign,
  runStableEvidenceSequence,
  runStableGrayReleaseRehearsal,
  runStableLeaseRehearsal,
  runStableMaintenanceRehearsal,
  runStableMigrationCompatibilityRehearsal,
  runStablePromptInjectionRedTeam,
  runStableQueueDeliveryRehearsal,
  runStableRollbackRehearsal,
  runStableRollingUpgradeRehearsal,
  runStableSoak,
  runStableValidation,
  runStableWorkerHandshakeRehearsal,
  runStableWorkerWritebackRehearsal,
  buildStableValidationBaseline,
  createStableEvidenceBundle,
  createStableReleasePackage,
} from "../../../../src/platform/stability/index.js";

test("stability barrel exports BenchmarkInventoryService", () => {
  assert.equal(typeof BenchmarkInventoryService, "function");
});

test("stability barrel exports DeploymentInventoryService", () => {
  assert.equal(typeof DeploymentInventoryService, "function");
});

test("stability barrel exports EnvironmentReadinessOrchestrationService", () => {
  assert.equal(typeof EnvironmentReadinessOrchestrationService, "function");
});

test("stability barrel exports VcrFixtureStore", () => {
  assert.equal(typeof VcrFixtureStore, "function");
});

test("stability barrel exports runGoldenTaskCase", () => {
  assert.equal(typeof runGoldenTaskCase, "function");
});

test("stability barrel exports runStableBackupRestoreRehearsal", () => {
  assert.equal(typeof runStableBackupRestoreRehearsal, "function");
});

test("stability barrel exports runStableChaosSmoke", () => {
  assert.equal(typeof runStableChaosSmoke, "function");
});

test("stability barrel exports runStableConcurrencyRehearsal", () => {
  assert.equal(typeof runStableConcurrencyRehearsal, "function");
});

test("stability barrel exports runStableCrossDivisionRecoveryDrill", () => {
  assert.equal(typeof runStableCrossDivisionRecoveryDrill, "function");
});

test("stability barrel exports runStableDbQueueDisconnectRehearsal", () => {
  assert.equal(typeof runStableDbQueueDisconnectRehearsal, "function");
});

test("stability barrel exports runStableDbWritabilityRehearsal", () => {
  assert.equal(typeof runStableDbWritabilityRehearsal, "function");
});

test("stability barrel exports runStableDispatchReconciliationRehearsal", () => {
  assert.equal(typeof runStableDispatchReconciliationRehearsal, "function");
});

test("stability barrel exports runStableDispatchRehearsal", () => {
  assert.equal(typeof runStableDispatchRehearsal, "function");
});

test("stability barrel exports runStableEventReplayRehearsal", () => {
  assert.equal(typeof runStableEventReplayRehearsal, "function");
});

test("stability barrel exports runStableEvidenceCampaign", () => {
  assert.equal(typeof runStableEvidenceCampaign, "function");
});

test("stability barrel exports runStableEvidenceSequence", () => {
  assert.equal(typeof runStableEvidenceSequence, "function");
});

test("stability barrel exports runStableGrayReleaseRehearsal", () => {
  assert.equal(typeof runStableGrayReleaseRehearsal, "function");
});

test("stability barrel exports runStableLeaseRehearsal", () => {
  assert.equal(typeof runStableLeaseRehearsal, "function");
});

test("stability barrel exports runStableMaintenanceRehearsal", () => {
  assert.equal(typeof runStableMaintenanceRehearsal, "function");
});

test("stability barrel exports runStableMigrationCompatibilityRehearsal", () => {
  assert.equal(typeof runStableMigrationCompatibilityRehearsal, "function");
});

test("stability barrel exports runStablePromptInjectionRedTeam", () => {
  assert.equal(typeof runStablePromptInjectionRedTeam, "function");
});

test("stability barrel exports runStableQueueDeliveryRehearsal", () => {
  assert.equal(typeof runStableQueueDeliveryRehearsal, "function");
});

test("stability barrel exports runStableRollbackRehearsal", () => {
  assert.equal(typeof runStableRollbackRehearsal, "function");
});

test("stability barrel exports runStableRollingUpgradeRehearsal", () => {
  assert.equal(typeof runStableRollingUpgradeRehearsal, "function");
});

test("stability barrel exports runStableSoak", () => {
  assert.equal(typeof runStableSoak, "function");
});

test("stability barrel exports runStableValidation", () => {
  assert.equal(typeof runStableValidation, "function");
});

test("stability barrel exports runStableWorkerHandshakeRehearsal", () => {
  assert.equal(typeof runStableWorkerHandshakeRehearsal, "function");
});

test("stability barrel exports runStableWorkerWritebackRehearsal", () => {
  assert.equal(typeof runStableWorkerWritebackRehearsal, "function");
});

test("stability module exports buildStableValidationBaseline", () => {
  assert.equal(typeof buildStableValidationBaseline, "function");
});

test("stability module exports createStableEvidenceBundle", () => {
  assert.equal(typeof createStableEvidenceBundle, "function");
});

test("stability module exports createStableReleasePackage", () => {
  assert.equal(typeof createStableReleasePackage, "function");
});