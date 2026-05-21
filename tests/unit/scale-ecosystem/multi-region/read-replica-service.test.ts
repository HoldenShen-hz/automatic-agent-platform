/**
 * Tests for ReadReplicaService and ReadWriteSplitRouter
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ReadReplicaService,
  ReadWriteSplitRouter,
  type ReadReplicaConfig,
  type ReadRoutingRequest,
} from "../../../../src/scale-ecosystem/multi-region/read-replica-service.js";

test("ReadReplicaService: registers a replica", () => {
  const service = new ReadReplicaService("us-east-1");
  const config: ReadReplicaConfig = {
    replicaId: "replica-1",
    regionId: "us-east-1",
    endpoint: "http://replica-1.example.com",
    isPrimary: true,
    priority: 1,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  service.registerReplica(config);

  const replicas = service.getReplicas();
  assert.equal(replicas.length, 1);
  assert.equal(replicas[0]!.replicaId, "replica-1");
});

test("ReadReplicaService: unregisters a replica", () => {
  const service = new ReadReplicaService("us-east-1");
  const config: ReadReplicaConfig = {
    replicaId: "replica-1",
    regionId: "us-east-1",
    endpoint: "http://replica-1.example.com",
    isPrimary: true,
    priority: 1,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  service.registerReplica(config);
  service.unregisterReplica("replica-1");

  const replicas = service.getReplicas();
  assert.equal(replicas.length, 0);
});

test("ReadReplicaService: returns primary replica", () => {
  const service = new ReadReplicaService("us-east-1");
  const config: ReadReplicaConfig = {
    replicaId: "primary",
    regionId: "us-east-1",
    endpoint: "http://primary.example.com",
    isPrimary: true,
    priority: 1,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  service.registerReplica(config);

  const primary = service.getPrimaryReplica();
  assert.ok(primary);
  assert.equal(primary!.replicaId, "primary");
  assert.equal(primary!.isPrimary, true);
});

test("ReadReplicaService: returns null when no primary", () => {
  const service = new ReadReplicaService("us-east-1");
  const primary = service.getPrimaryReplica();
  assert.equal(primary, null);
});

test("ReadReplicaService: returns only follower replicas", () => {
  const service = new ReadReplicaService("us-east-1");
  const primaryConfig: ReadReplicaConfig = {
    replicaId: "primary",
    regionId: "us-east-1",
    endpoint: "http://primary.example.com",
    isPrimary: true,
    priority: 1,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  const followerConfig: ReadReplicaConfig = {
    replicaId: "follower-1",
    regionId: "us-west-1",
    endpoint: "http://follower-1.example.com",
    isPrimary: false,
    priority: 2,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  service.registerReplica(primaryConfig);
  service.registerReplica(followerConfig);

  const followers = service.getFollowerReplicas();
  assert.equal(followers.length, 1);
  assert.equal(followers[0]!.replicaId, "follower-1");
});

test("ReadReplicaService: updates replica metrics", () => {
  const service = new ReadReplicaService("us-east-1");
  const config: ReadReplicaConfig = {
    replicaId: "replica-1",
    regionId: "us-east-1",
    endpoint: "http://replica-1.example.com",
    isPrimary: true,
    priority: 1,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  service.registerReplica(config);
  service.updateReplicaMetrics("replica-1", {
    latencyMs: 50,
    lagMs: 100,
    healthStatus: "healthy",
  });

  const replicas = service.getReplicas();
  assert.equal(replicas[0]!.latencyMs, 50);
  assert.equal(replicas[0]!.lagMs, 100);
  assert.equal(replicas[0]!.healthStatus, "healthy");
});

test("ReadReplicaService: routes to primary for strong consistency", () => {
  const service = new ReadReplicaService("us-east-1");
  const primaryConfig: ReadReplicaConfig = {
    replicaId: "primary",
    regionId: "us-east-1",
    endpoint: "http://primary.example.com",
    isPrimary: true,
    priority: 1,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  service.registerReplica(primaryConfig);
  service.updateReplicaMetrics("primary", { latencyMs: 30, healthStatus: "healthy" });

  const request: ReadRoutingRequest = {
    operationId: "op-1",
    aggregateType: "Task",
    aggregateId: "task-123",
    consistencyLevel: "strong",
    routingMode: "nearest",
  };

  const decision = service.routeRead(request);

  assert.equal(decision.isPrimaryRoute, true);
  assert.equal(decision.selectedReplicaId, "primary");
  assert.equal(decision.consistencyLevel, "strong");
  assert.equal(decision.waitForReplication, false);
});

test("ReadReplicaService: routes to nearest replica for eventual consistency", () => {
  const service = new ReadReplicaService("us-east-1");
  const primaryConfig: ReadReplicaConfig = {
    replicaId: "primary",
    regionId: "us-east-1",
    endpoint: "http://primary.example.com",
    isPrimary: true,
    priority: 1,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  const followerConfig: ReadReplicaConfig = {
    replicaId: "follower-1",
    regionId: "us-west-1",
    endpoint: "http://follower-1.example.com",
    isPrimary: false,
    priority: 2,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  service.registerReplica(primaryConfig);
  service.registerReplica(followerConfig);
  service.updateReplicaMetrics("primary", { latencyMs: 30, healthStatus: "healthy" });
  service.updateReplicaMetrics("follower-1", { latencyMs: 50, lagMs: 100, healthStatus: "healthy" });

  const request: ReadRoutingRequest = {
    operationId: "op-1",
    aggregateType: "Task",
    aggregateId: "task-123",
    consistencyLevel: "eventual",
    routingMode: "nearest",
  };

  const decision = service.routeRead(request);

  assert.equal(decision.isPrimaryRoute, false);
  assert.equal(decision.selectedReplicaId, "follower-1");
  assert.equal(decision.consistencyLevel, "eventual");
});

test("ReadReplicaService: routes to any healthy replica for any_healthy mode", () => {
  const service = new ReadReplicaService("us-east-1");
  const primaryConfig: ReadReplicaConfig = {
    replicaId: "primary",
    regionId: "us-east-1",
    endpoint: "http://primary.example.com",
    isPrimary: true,
    priority: 1,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  const follower1Config: ReadReplicaConfig = {
    replicaId: "follower-1",
    regionId: "us-west-1",
    endpoint: "http://follower-1.example.com",
    isPrimary: false,
    priority: 2,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  const follower2Config: ReadReplicaConfig = {
    replicaId: "follower-2",
    regionId: "eu-west-1",
    endpoint: "http://follower-2.example.com",
    isPrimary: false,
    priority: 3,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  service.registerReplica(primaryConfig);
  service.registerReplica(follower1Config);
  service.registerReplica(follower2Config);
  service.updateReplicaMetrics("primary", { latencyMs: 30, healthStatus: "healthy" });
  service.updateReplicaMetrics("follower-1", { latencyMs: 50, lagMs: 100, healthStatus: "healthy" });
  service.updateReplicaMetrics("follower-2", { latencyMs: 80, lagMs: 500, healthStatus: "lagging" });

  const request: ReadRoutingRequest = {
    operationId: "op-1",
    aggregateType: "Task",
    aggregateId: "task-123",
    consistencyLevel: "eventual",
    routingMode: "any_healthy",
  };

  const decision = service.routeRead(request);

  // follower-2 is lagging, so should get follower-1
  assert.equal(decision.selectedReplicaId, "follower-1");
});

test("ReadReplicaService: respects preferred region", () => {
  const service = new ReadReplicaService("us-east-1");
  const primaryConfig: ReadReplicaConfig = {
    replicaId: "primary",
    regionId: "us-east-1",
    endpoint: "http://primary.example.com",
    isPrimary: true,
    priority: 1,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  const followerConfig: ReadReplicaConfig = {
    replicaId: "follower-1",
    regionId: "us-west-1",
    endpoint: "http://follower-1.example.com",
    isPrimary: false,
    priority: 2,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  service.registerReplica(primaryConfig);
  service.registerReplica(followerConfig);
  service.updateReplicaMetrics("primary", { latencyMs: 30, healthStatus: "healthy" });
  service.updateReplicaMetrics("follower-1", { latencyMs: 50, lagMs: 100, healthStatus: "healthy" });

  const request: ReadRoutingRequest = {
    operationId: "op-1",
    aggregateType: "Task",
    aggregateId: "task-123",
    consistencyLevel: "eventual",
    routingMode: "nearest",
    preferredRegionId: "us-west-1",
  };

  const decision = service.routeRead(request);

  // Even though us-west-1 has higher latency, it should be preferred
  assert.equal(decision.selectedRegionId, "us-west-1");
});

test("ReadReplicaService: falls back to primary when no candidates available", () => {
  const service = new ReadReplicaService("us-east-1");
  const primaryConfig: ReadReplicaConfig = {
    replicaId: "primary",
    regionId: "us-east-1",
    endpoint: "http://primary.example.com",
    isPrimary: true,
    priority: 1,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  const followerConfig: ReadReplicaConfig = {
    replicaId: "follower-1",
    regionId: "us-west-1",
    endpoint: "http://follower-1.example.com",
    isPrimary: false,
    priority: 2,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  service.registerReplica(primaryConfig);
  service.registerReplica(followerConfig);
  service.updateReplicaMetrics("primary", { latencyMs: 30, healthStatus: "healthy" });
  service.updateReplicaMetrics("follower-1", { latencyMs: 50, lagMs: 100, healthStatus: "unhealthy" });

  const request: ReadRoutingRequest = {
    operationId: "op-1",
    aggregateType: "Task",
    aggregateId: "task-123",
    consistencyLevel: "eventual",
    routingMode: "nearest",
  };

  const decision = service.routeRead(request);

  assert.equal(decision.isPrimaryRoute, true);
  assert.equal(decision.selectedReplicaId, "primary");
});

test("ReadReplicaService: sets waitForReplication for session consistency on replica", () => {
  const service = new ReadReplicaService("us-east-1");
  const primaryConfig: ReadReplicaConfig = {
    replicaId: "primary",
    regionId: "us-east-1",
    endpoint: "http://primary.example.com",
    isPrimary: true,
    priority: 1,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  const followerConfig: ReadReplicaConfig = {
    replicaId: "follower-1",
    regionId: "us-west-1",
    endpoint: "http://follower-1.example.com",
    isPrimary: false,
    priority: 2,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  service.registerReplica(primaryConfig);
  service.registerReplica(followerConfig);
  service.updateReplicaMetrics("primary", { latencyMs: 30, healthStatus: "healthy" });
  service.updateReplicaMetrics("follower-1", { latencyMs: 50, lagMs: 100, healthStatus: "healthy" });

  const request: ReadRoutingRequest = {
    operationId: "op-1",
    aggregateType: "Task",
    aggregateId: "task-123",
    consistencyLevel: "session",
    routingMode: "nearest",
  };

  const decision = service.routeRead(request);

  assert.equal(decision.consistencyLevel, "session");
  assert.equal(decision.waitForReplication, true);
});

test("ReadReplicaService: includes audit trail in decision", () => {
  const service = new ReadReplicaService("us-east-1");
  const primaryConfig: ReadReplicaConfig = {
    replicaId: "primary",
    regionId: "us-east-1",
    endpoint: "http://primary.example.com",
    isPrimary: true,
    priority: 1,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  const followerConfig: ReadReplicaConfig = {
    replicaId: "follower-1",
    regionId: "us-west-1",
    endpoint: "http://follower-1.example.com",
    isPrimary: false,
    priority: 2,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  service.registerReplica(primaryConfig);
  service.registerReplica(followerConfig);
  service.updateReplicaMetrics("primary", { latencyMs: 30, healthStatus: "healthy" });
  service.updateReplicaMetrics("follower-1", { latencyMs: 50, lagMs: 100, healthStatus: "healthy" });

  const request: ReadRoutingRequest = {
    operationId: "op-1",
    aggregateType: "Task",
    aggregateId: "task-123",
    consistencyLevel: "eventual",
    routingMode: "nearest",
  };

  const decision = service.routeRead(request);

  assert.ok(decision.auditTrail.length > 0);
  assert.ok(decision.auditTrail.some((entry) => entry.startsWith("consistency:")));
  assert.ok(decision.auditTrail.some((entry) => entry.startsWith("mode:")));
});

test("ReadReplicaService: records write for read-after-write tracking", () => {
  const service = new ReadReplicaService("us-east-1");
  // Should not throw
  service.recordWriteForReadAfterWrite("op-1", "aggregate-123", 100, ["us-west-1", "eu-west-1"]);
});

test("ReadReplicaService: returns true for healthy replica with acceptable lag", () => {
  const service = new ReadReplicaService("us-east-1");
  const config: ReadReplicaConfig = {
    replicaId: "replica-1",
    regionId: "us-east-1",
    endpoint: "http://replica-1.example.com",
    isPrimary: false,
    priority: 1,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  service.registerReplica(config);
  service.updateReplicaMetrics("replica-1", {
    lagMs: 100,
    healthStatus: "healthy",
  });

  const healthy = service.isReplicaHealthyForRead("replica-1", 5000);
  assert.equal(healthy, true);
});

test("ReadReplicaService: returns false for unhealthy replica", () => {
  const service = new ReadReplicaService("us-east-1");
  const config: ReadReplicaConfig = {
    replicaId: "replica-1",
    regionId: "us-east-1",
    endpoint: "http://replica-1.example.com",
    isPrimary: false,
    priority: 1,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  service.registerReplica(config);
  service.updateReplicaMetrics("replica-1", { healthStatus: "unhealthy" });

  const healthy = service.isReplicaHealthyForRead("replica-1", 5000);
  assert.equal(healthy, false);
});

test("ReadReplicaService: returns false for replica exceeding max lag", () => {
  const service = new ReadReplicaService("us-east-1");
  const config: ReadReplicaConfig = {
    replicaId: "replica-1",
    regionId: "us-east-1",
    endpoint: "http://replica-1.example.com",
    isPrimary: false,
    priority: 1,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  service.registerReplica(config);
  service.updateReplicaMetrics("replica-1", {
    lagMs: 10000,
    healthStatus: "healthy",
  });

  const healthy = service.isReplicaHealthyForRead("replica-1", 5000);
  assert.equal(healthy, false);
});

test("ReadReplicaService: returns true for primary regardless of lag", () => {
  const service = new ReadReplicaService("us-east-1");
  const config: ReadReplicaConfig = {
    replicaId: "primary",
    regionId: "us-east-1",
    endpoint: "http://primary.example.com",
    isPrimary: true,
    priority: 1,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  service.registerReplica(config);
  service.updateReplicaMetrics("primary", {
    lagMs: 10000,
    healthStatus: "healthy",
  });

  const healthy = service.isReplicaHealthyForRead("primary", 5000);
  assert.equal(healthy, true);
});

// ReadWriteSplitRouter tests

test("ReadWriteSplitRouter: routeRead delegates to ReadReplicaService", () => {
  const service = new ReadReplicaService("us-east-1");
  const primaryConfig: ReadReplicaConfig = {
    replicaId: "primary",
    regionId: "us-east-1",
    endpoint: "http://primary.example.com",
    isPrimary: true,
    priority: 1,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  service.registerReplica(primaryConfig);

  const router = new ReadWriteSplitRouter("us-east-1", service);

  const request: ReadRoutingRequest = {
    operationId: "op-1",
    aggregateType: "Task",
    aggregateId: "task-123",
    consistencyLevel: "eventual",
    routingMode: "nearest",
  };

  const decision = router.routeRead(request);

  assert.equal(decision.operationId, "op-1");
});

test("ReadWriteSplitRouter: routeWrite always routes to primary", () => {
  const service = new ReadReplicaService("us-east-1");
  const primaryConfig: ReadReplicaConfig = {
    replicaId: "primary",
    regionId: "us-east-1",
    endpoint: "http://primary.example.com",
    isPrimary: true,
    priority: 1,
    maxLagMs: 5000,
    healthCheckIntervalMs: 30000,
  };

  service.registerReplica(primaryConfig);

  const router = new ReadWriteSplitRouter("us-east-1", service);
  const result = router.routeWrite("op-1", "Task", "task-123");

  assert.equal(result.primaryReplicaId, "primary");
  assert.equal(result.primaryRegionId, "us-east-1");
});

test("ReadWriteSplitRouter: routeWrite throws when no primary available", () => {
  const emptyRouter = new ReadWriteSplitRouter("us-east-1");

  assert.throws(
    () => emptyRouter.routeWrite("op-1", "Task", "task-123"),
    /No primary replica available/,
  );
});

test("ReadWriteSplitRouter: getReadReplicaService returns the underlying service", () => {
  const service = new ReadReplicaService("us-east-1");
  const router = new ReadWriteSplitRouter("us-east-1", service);

  const returned = router.getReadReplicaService();
  assert.equal(returned, service);
});

test("ReadWriteSplitRouter: creates its own ReadReplicaService when not provided", () => {
  const router = new ReadWriteSplitRouter("us-east-1");
  const returned = router.getReadReplicaService();
  assert.ok(returned instanceof ReadReplicaService);
});