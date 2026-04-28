import assert from "node:assert/strict";
import test from "node:test";

// HA module barrel - re-exports HA-related services
import {
  CONTROL_PLANE_LOAD_BALANCING_DDL,
  CoordinatorLoadBalancingService,
  CrossRegionDeploymentService,
  CrossRegionEventReplicationService,
  createHaCoordinatorService,
  createLeaderElectionService,
  createLeaseReclaimerService,
  ExecutionRecoveryWorker,
  HaCoordinatorService,
  LeaderElectionService,
  LeaseReclaimerService,
  ProjectionRebuildWorker,
  RecoveryOrchestratorService,
  ReplayWorker,
  StuckRunSweeperService,
  WalCheckpointService,
  WorkflowRepairWorker,
  HA_COORDINATOR_DDL,
  CROSS_REGION_DDL,
  WAL_CHECKPOINT_DDL,
} from "../../../../../src/platform/execution/ha/index.js";

test("CONTROL_PLANE_LOAD_BALANCING_DDL is exported", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL !== undefined);
});

test("CoordinatorLoadBalancingService is exported as function", () => {
  assert.equal(typeof CoordinatorLoadBalancingService, "function");
});

test("CrossRegionDeploymentService is exported as function", () => {
  assert.equal(typeof CrossRegionDeploymentService, "function");
});

test("CrossRegionEventReplicationService is exported as function", () => {
  assert.equal(typeof CrossRegionEventReplicationService, "function");
});

test("ExecutionRecoveryWorker is exported as function", () => {
  assert.equal(typeof ExecutionRecoveryWorker, "function");
});

test("HaCoordinatorService is exported as function", () => {
  assert.equal(typeof HaCoordinatorService, "function");
});

test("LeaderElectionService is exported as function", () => {
  assert.equal(typeof LeaderElectionService, "function");
});

test("LeaseReclaimerService is exported as function", () => {
  assert.equal(typeof LeaseReclaimerService, "function");
});

test("ProjectionRebuildWorker is exported as function", () => {
  assert.equal(typeof ProjectionRebuildWorker, "function");
});

test("RecoveryOrchestratorService is exported as function", () => {
  assert.equal(typeof RecoveryOrchestratorService, "function");
});

test("ReplayWorker is exported as function", () => {
  assert.equal(typeof ReplayWorker, "function");
});

test("StuckRunSweeperService is exported as function", () => {
  assert.equal(typeof StuckRunSweeperService, "function");
});

test("WalCheckpointService is exported as function", () => {
  assert.equal(typeof WalCheckpointService, "function");
});

test("WorkflowRepairWorker is exported as function", () => {
  assert.equal(typeof WorkflowRepairWorker, "function");
});

test("HA_COORDINATOR_DDL is exported", () => {
  assert.ok(HA_COORDINATOR_DDL !== undefined);
});

test("CROSS_REGION_DDL is exported", () => {
  assert.ok(CROSS_REGION_DDL !== undefined);
});

test("WAL_CHECKPOINT_DDL is exported", () => {
  assert.ok(WAL_CHECKPOINT_DDL !== undefined);
});

test("createHaCoordinatorService is exported as function", () => {
  assert.equal(typeof createHaCoordinatorService, "function");
});

test("createLeaderElectionService is exported as function", () => {
  assert.equal(typeof createLeaderElectionService, "function");
});

test("createLeaseReclaimerService is exported as function", () => {
  assert.equal(typeof createLeaseReclaimerService, "function");
});
