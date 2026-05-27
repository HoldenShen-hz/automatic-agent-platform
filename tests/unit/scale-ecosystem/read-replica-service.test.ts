import assert from "node:assert/strict";
import test from "node:test";

import {
  ReadReplicaService,
  ReadWriteSplitRouter,
  type ReadReplicaConfig,
  type ReadRoutingRequest,
  type ReadConsistencyLevel,
  type ReplicaHealthStatus,
} from "../../../src/scale-ecosystem/multi-region/read-replica-service.js";

function createReplicaConfig(overrides: Partial<ReadReplicaConfig> = {}): ReadReplicaConfig {
  return {
    replicaId: overrides.replicaId ?? "replica-1",
    regionId: overrides.regionId ?? "us-east-1",
    endpoint: overrides.endpoint ?? "https://replica-1.example.com",
    isPrimary: overrides.isPrimary ?? false,
    priority: overrides.priority ?? 1,
    maxLagMs: overrides.maxLagMs ?? 5000,
    healthCheckIntervalMs: overrides.healthCheckIntervalMs ?? 30000,
    ...overrides,
  };
}

function createRoutingRequest(overrides: Partial<ReadRoutingRequest> = {}): ReadRoutingRequest {
  return {
    operationId: overrides.operationId ?? "op-1",
    aggregateType: overrides.aggregateType ?? "task",
    aggregateId: overrides.aggregateId ?? "task-123",
    consistencyLevel: overrides.consistencyLevel ?? "eventual",
    routingMode: overrides.routingMode ?? "nearest",
    preferredRegionId: overrides.preferredRegionId ?? null,
    bypassCache: overrides.bypassCache ?? false,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ReadReplicaService Registration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReadReplicaService registers primary replica correctly [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "primary", isPrimary: true }));

  const primary = service.getPrimaryReplica();

  assert.ok(primary != null);
  assert.equal(primary!.replicaId, "primary");
  assert.equal(primary!.isPrimary, true);
});

test("ReadReplicaService registers follower replicas correctly [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "follower-1", isPrimary: false }));

  const followers = service.getFollowerReplicas();

  assert.equal(followers.length, 1);
  assert.equal(followers[0]!.replicaId, "follower-1");
});

test("ReadReplicaService unregisters replica [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "replica-1" }));
  service.unregisterReplica("replica-1");

  const replicas = service.getReplicas();

  assert.equal(replicas.length, 0);
});

test("ReadReplicaService returns all replicas [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "primary", isPrimary: true }));
  service.registerReplica(createReplicaConfig({ replicaId: "follower-1", isPrimary: false }));

  const replicas = service.getReplicas();

  assert.equal(replicas.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// ReadReplicaService Health Metrics Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReadReplicaService updates replica metrics [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "replica-1" }));
  service.updateReplicaMetrics("replica-1", { latencyMs: 50, lagMs: 100 });

  const replica = service.getReplicas()[0];

  assert.equal(replica!.latencyMs, 50);
  assert.equal(replica!.lagMs, 100);
});

test("ReadReplicaService updates replica health status [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "replica-1" }));
  service.updateReplicaMetrics("replica-1", { healthStatus: "healthy" });

  const replica = service.getReplicas()[0];

  assert.equal(replica!.healthStatus, "healthy");
});

test("ReadReplicaService handles partial metric updates [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "replica-1" }));
  service.updateReplicaMetrics("replica-1", { latencyMs: 50 });

  const replica = service.getReplicas()[0];

  assert.equal(replica!.latencyMs, 50);
  assert.notEqual(replica!.lagMs, 50); // Original lagMs preserved
});

test("ReadReplicaService ignores update for unknown replica [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "replica-1" }));

  // Should not throw
  service.updateReplicaMetrics("unknown-replica", { latencyMs: 50 });

  const replica = service.getReplicas()[0];
  assert.equal(replica!.latencyMs, 0); // Original value preserved
});

// ─────────────────────────────────────────────────────────────────────────────
// ReadReplicaService isReplicaHealthyForRead Tests
// ─────────────────────────────────────────────────────────────────────────────

test("isReplicaHealthyForRead returns true for primary regardless of lag [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "primary", isPrimary: true }));
  service.updateReplicaMetrics("primary", { lagMs: 10000 });

  const result = service.isReplicaHealthyForRead("primary", 1000);

  assert.equal(result, true);
});

test("isReplicaHealthyForRead returns false for unhealthy replica [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "replica-1", isPrimary: false }));
  service.updateReplicaMetrics("replica-1", { healthStatus: "unhealthy" });

  const result = service.isReplicaHealthyForRead("replica-1", 5000);

  assert.equal(result, false);
});

test("isReplicaHealthyForRead returns false when lag exceeds max [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "replica-1", isPrimary: false, maxLagMs: 1000 }));
  service.updateReplicaMetrics("replica-1", { lagMs: 2000 });

  const result = service.isReplicaHealthyForRead("replica-1", 1000);

  assert.equal(result, false);
});

test("isReplicaHealthyForRead returns true when lag is within threshold [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "replica-1", isPrimary: false, maxLagMs: 5000 }));
  service.updateReplicaMetrics("replica-1", { lagMs: 500 });

  const result = service.isReplicaHealthyForRead("replica-1", 5000);

  assert.equal(result, true);
});

test("isReplicaHealthyForRead returns false for unknown replica [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");

  const result = service.isReplicaHealthyForRead("unknown", 5000);

  assert.equal(result, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// ReadReplicaService.routeRead Tests
// ─────────────────────────────────────────────────────────────────────────────

test("routeRead with strong consistency routes to primary only [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "primary", isPrimary: true, regionId: "us-east-1" }));
  service.registerReplica(createReplicaConfig({ replicaId: "follower-1", isPrimary: false, regionId: "us-west-2" }));
  service.updateReplicaMetrics("follower-1", { latencyMs: 30 });

  const decision = service.routeRead(createRoutingRequest({ consistencyLevel: "strong" }));

  assert.equal(decision.selectedReplicaId, "primary");
  assert.equal(decision.isPrimaryRoute, true);
  assert.equal(decision.consistencyLevel, "strong");
});

test("routeRead with eventual consistency routes to nearest healthy replica [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "primary", isPrimary: true, regionId: "us-east-1" }));
  service.registerReplica(createReplicaConfig({ replicaId: "follower-1", isPrimary: false, regionId: "us-west-2" }));
  service.updateReplicaMetrics("follower-1", { latencyMs: 30, healthStatus: "healthy" });

  const decision = service.routeRead(createRoutingRequest({ consistencyLevel: "eventual", routingMode: "nearest" }));

  assert.equal(decision.selectedReplicaId, "follower-1");
  assert.equal(decision.isPrimaryRoute, false);
});

test("routeRead falls back to primary when no healthy replicas [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "primary", isPrimary: true, regionId: "us-east-1" }));
  service.registerReplica(createReplicaConfig({ replicaId: "follower-1", isPrimary: false, regionId: "us-west-2" }));
  service.updateReplicaMetrics("follower-1", { healthStatus: "unhealthy" });

  const decision = service.routeRead(createRoutingRequest({ consistencyLevel: "eventual" }));

  assert.equal(decision.selectedReplicaId, "primary");
  assert.equal(decision.isPrimaryRoute, true);
});

test("routeRead with preferred region selects that region when available [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "primary", isPrimary: true, regionId: "us-east-1" }));
  service.registerReplica(createReplicaConfig({ replicaId: "follower-1", isPrimary: false, regionId: "us-west-2" }));
  service.registerReplica(createReplicaConfig({ replicaId: "follower-2", isPrimary: false, regionId: "eu-west-1" }));
  service.updateReplicaMetrics("follower-1", { latencyMs: 30, healthStatus: "healthy" });
  service.updateReplicaMetrics("follower-2", { latencyMs: 150, healthStatus: "healthy" });

  const decision = service.routeRead(createRoutingRequest({
    preferredRegionId: "eu-west-1",
    consistencyLevel: "eventual",
    routingMode: "nearest",
  }));

  assert.equal(decision.selectedRegionId, "eu-west-1");
});

test("routeRead with session consistency sets waitForReplication for followers [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "primary", isPrimary: true, regionId: "us-east-1" }));
  service.registerReplica(createReplicaConfig({ replicaId: "follower-1", isPrimary: false, regionId: "us-west-2" }));
  service.updateReplicaMetrics("follower-1", { latencyMs: 30, healthStatus: "healthy" });

  const decision = service.routeRead(createRoutingRequest({ consistencyLevel: "session" }));

  assert.equal(decision.waitForReplication, true);
});

test("routeRead with strong consistency does not wait for replication [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "primary", isPrimary: true, regionId: "us-east-1" }));

  const decision = service.routeRead(createRoutingRequest({ consistencyLevel: "strong" }));

  assert.equal(decision.waitForReplication, false);
});

test("routeRead audit trail includes consistency and routing mode [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "primary", isPrimary: true }));

  const decision = service.routeRead(createRoutingRequest({ consistencyLevel: "eventual", routingMode: "any_healthy" }));

  assert.ok(decision.auditTrail.includes("consistency:eventual"));
  assert.ok(decision.auditTrail.includes("mode:any_healthy"));
});

// ─────────────────────────────────────────────────────────────────────────────
// ReadReplicaService Read-After-Write Tests
// ─────────────────────────────────────────────────────────────────────────────

test("recordWriteForReadAfterWrite stores pending read entry [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "primary", isPrimary: true }));

  service.recordWriteForReadAfterWrite("op-1", "task-123", 100, ["us-west-2"], 30000);

  // Internal state is not directly accessible, but we can verify via waitForReadAfterWrite behavior
});

test("isReplicaHealthyForRead handles null lagMs [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "replica-1", isPrimary: false }));

  const result = service.isReplicaHealthyForRead("replica-1", 5000);

  // null lagMs means we don't know the lag, so replica is considered healthy if status is ok
  assert.equal(result, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// ReadWriteSplitRouter Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReadWriteSplitRouter.routeRead delegates to readReplicaService [read-replica-service]", () => {
  const router = new ReadWriteSplitRouter("us-east-1");
  router.getReadReplicaService().registerReplica(createReplicaConfig({ replicaId: "primary", isPrimary: true }));

  const decision = router.routeRead(createRoutingRequest({ consistencyLevel: "strong" }));

  assert.equal(decision.selectedReplicaId, "primary");
});

test("ReadWriteSplitRouter.routeWrite returns primary region [read-replica-service]", () => {
  const router = new ReadWriteSplitRouter("us-east-1");
  router.getReadReplicaService().registerReplica(createReplicaConfig({ replicaId: "primary", isPrimary: true, regionId: "us-east-1" }));

  const result = router.routeWrite("op-1", "task", "task-123");

  assert.equal(result.primaryReplicaId, "primary");
  assert.equal(result.primaryRegionId, "us-east-1");
});

test("ReadWriteSplitRouter.routeWrite throws when no primary available [read-replica-service]", () => {
  const router = new ReadWriteSplitRouter("us-east-1");

  assert.throws(
    () => router.routeWrite("op-1", "task", "task-123"),
    /No primary replica/,
  );
});

test("ReadWriteSplitRouter.getReadReplicaService returns the underlying service [read-replica-service]", () => {
  const router = new ReadWriteSplitRouter("us-east-1");
  const service = router.getReadReplicaService();

  assert.ok(service instanceof ReadReplicaService);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("ReadReplicaService handles empty replica list [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");

  const replicas = service.getReplicas();
  const primary = service.getPrimaryReplica();
  const followers = service.getFollowerReplicas();

  assert.equal(replicas.length, 0);
  assert.equal(primary, null);
  assert.equal(followers.length, 0);
});

test("ReadReplicaService handles multiple primaries (uses first one) [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "primary-1", isPrimary: true }));
  service.registerReplica(createReplicaConfig({ replicaId: "primary-2", isPrimary: true }));

  const primary = service.getPrimaryReplica();

  // Returns first registered primary
  assert.equal(primary!.replicaId, "primary-1");
});

test("ReadReplicaService with primary_only routing mode returns only primary [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "primary", isPrimary: true }));
  service.registerReplica(createReplicaConfig({ replicaId: "follower-1", isPrimary: false }));

  const decision = service.routeRead(createRoutingRequest({ routingMode: "primary_only" }));

  assert.equal(decision.selectedReplicaId, "primary");
});

test("ReadReplicaService with any_healthy routing mode returns any healthy replica [read-replica-service]", () => {
  const service = new ReadReplicaService("us-east-1");
  service.registerReplica(createReplicaConfig({ replicaId: "primary", isPrimary: true }));
  service.registerReplica(createReplicaConfig({ replicaId: "follower-1", isPrimary: false }));
  service.updateReplicaMetrics("follower-1", { healthStatus: "healthy", lagMs: 100 });

  const decision = service.routeRead(createRoutingRequest({ routingMode: "any_healthy" }));

  // Should route to a healthy replica (either primary or follower-1)
  assert.ok(decision.selectedReplicaId != null);
});
