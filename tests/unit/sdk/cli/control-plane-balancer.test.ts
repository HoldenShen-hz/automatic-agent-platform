/**
 * Control Plane Balancer CLI Tests
 *
 * Tests for control-plane-balancer CLI module which manages coordinator
 * load balancing via heartbeat registration and coordinator selection.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { loadControlPlaneBalancerCliEnv } from "../../../../src/platform/five-plane-control-plane/config-center/remaining-cli-env-loaders.js";

test("loadControlPlaneBalancerCliEnv parses heartbeat action", () => {
  const config = loadControlPlaneBalancerCliEnv({
    AA_CONTROL_PLANE_ACTION: "heartbeat",
    AA_DB_PATH: "/tmp/test.db",
    AA_COORDINATOR_ID: "coord-123",
    AA_COORDINATOR_REGION: "us-east-1",
  });

  assert.equal(config.action, "heartbeat");
  assert.equal(config.coordinatorId, "coord-123");
  assert.equal(config.coordinatorRegion, "us-east-1");
});

test("loadControlPlaneBalancerCliEnv parses heartbeat with optional parameters", () => {
  const config = loadControlPlaneBalancerCliEnv({
    AA_CONTROL_PLANE_ACTION: "heartbeat",
    AA_DB_PATH: "/tmp/test.db",
    AA_COORDINATOR_ID: "coord-456",
    AA_COORDINATOR_REGION: "eu-west-1",
    AA_COORDINATOR_ROLE: "primary",
    AA_COORDINATOR_STATUS: "active",
    AA_COORDINATOR_MAX_DISPATCHES: "100",
    AA_COORDINATOR_ACTIVE_DISPATCHES: "25",
    AA_COORDINATOR_BACKLOG: "50",
    AA_COORDINATOR_CPU_PCT: "45",
  });

  assert.equal(config.role, "primary");
  assert.equal(config.status, "active");
  assert.equal(config.maxConcurrentDispatches, 100);
  assert.equal(config.activeDispatchCount, 25);
  assert.equal(config.backlogCount, 50);
  assert.equal(config.cpuPct, 45);
});

test("loadControlPlaneBalancerCliEnv parses select action", () => {
  const config = loadControlPlaneBalancerCliEnv({
    AA_CONTROL_PLANE_ACTION: "select",
    AA_DB_PATH: "/tmp/test.db",
    AA_CONTROL_PLANE_QUEUE: "default-queue",
    AA_CONTROL_PLANE_REGION: "us-east-1",
    AA_CONTROL_PLANE_TENANT_ID: "tenant-123",
  });

  assert.equal(config.action, "select");
  assert.equal(config.queueName, "default-queue");
  assert.equal(config.preferredRegion, "us-east-1");
  assert.equal(config.tenantId, "tenant-123");
});

test("loadControlPlaneBalancerCliEnv parses select with request_key", () => {
  const config = loadControlPlaneBalancerCliEnv({
    AA_CONTROL_PLANE_ACTION: "select",
    AA_DB_PATH: "/tmp/test.db",
    AA_CONTROL_PLANE_REQUEST_KEY: "req-key-abc",
  });

  assert.equal(config.requestKey, "req-key-abc");
});

test("loadControlPlaneBalancerCliEnv parses summary action (default)", () => {
  const config = loadControlPlaneBalancerCliEnv({
    AA_CONTROL_PLANE_ACTION: "summary",
    AA_DB_PATH: "/tmp/test.db",
  });

  assert.equal(config.action, "summary");
});

test("loadControlPlaneBalancerCliEnv uses summary as default action", () => {
  const config = loadControlPlaneBalancerCliEnv({
    AA_DB_PATH: "/tmp/test.db",
  });

  assert.equal(config.action, "summary");
});

test("loadControlPlaneBalancerCliEnv parses shards parameter", () => {
  const config = loadControlPlaneBalancerCliEnv({
    AA_CONTROL_PLANE_ACTION: "heartbeat",
    AA_DB_PATH: "/tmp/test.db",
    AA_COORDINATOR_ID: "coord-789",
    AA_COORDINATOR_REGION: "ap-south-1",
    AA_COORDINATOR_SHARDS_JSON: '["shard1","shard2"]',
  });

  assert.deepEqual(config.shards, ["shard1", "shard2"]);
});

test("loadControlPlaneBalancerCliEnv parses queue_affinity parameter", () => {
  const config = loadControlPlaneBalancerCliEnv({
    AA_CONTROL_PLANE_ACTION: "heartbeat",
    AA_DB_PATH: "/tmp/test.db",
    AA_COORDINATOR_ID: "coord-abc",
    AA_COORDINATOR_REGION: "us-west-2",
    AA_COORDINATOR_QUEUE: "high-priority",
  });

  assert.equal(config.queueAffinity, "high-priority");
});
