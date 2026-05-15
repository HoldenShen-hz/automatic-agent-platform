import assert from "node:assert/strict";
import test from "node:test";

import { CONTROL_PLANE_LOAD_BALANCING_DDL } from "../../../../../src/platform/five-plane-execution/ha/control-plane-load-balancing-schema.js";

test("CONTROL_PLANE_LOAD_BALANCING_DDL is a non-empty string", () => {
  assert.equal(typeof CONTROL_PLANE_LOAD_BALANCING_DDL, "string");
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.length > 0);
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL creates coordinator_instance_snapshots table", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("CREATE TABLE"));
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("coordinator_instance_snapshots"));
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL defines coordinator_id as TEXT PRIMARY KEY", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("coordinator_id TEXT PRIMARY KEY"));
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL includes region column", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("region TEXT NOT NULL"));
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL includes role column", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("role TEXT NOT NULL"));
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL includes queue_affinity column", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("queue_affinity TEXT NULL"));
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL includes status column", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("status TEXT NOT NULL"));
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL includes max_concurrent_dispatches column", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("max_concurrent_dispatches INTEGER NOT NULL"));
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL includes active_dispatch_count column", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("active_dispatch_count INTEGER NOT NULL"));
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL includes backlog_count column", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("backlog_count INTEGER NOT NULL"));
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL includes cpu_pct column", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("cpu_pct REAL NULL"));
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL includes shard_json column", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("shard_json TEXT NOT NULL"));
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL includes last_heartbeat_at column", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("last_heartbeat_at TEXT NOT NULL"));
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL includes metadata_json column", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("metadata_json TEXT NULL"));
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL includes created_at and updated_at columns", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("created_at TEXT NOT NULL"));
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("updated_at TEXT NOT NULL"));
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL creates status index", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("CREATE INDEX"));
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("idx_coordinator_instance_status_updated_at"));
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("status, updated_at DESC"));
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL creates region index", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("idx_coordinator_instance_region_updated_at"));
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("region, updated_at DESC"));
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL uses IF NOT EXISTS for table", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("CREATE TABLE IF NOT EXISTS"));
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL uses IF NOT EXISTS for indexes", () => {
  assert.ok(CONTROL_PLANE_LOAD_BALANCING_DDL.includes("CREATE INDEX IF NOT EXISTS"));
});

test("CONTROL_PLANE_LOAD_BALANCING_DDL contains multiple statements", () => {
  const statements = CONTROL_PLANE_LOAD_BALANCING_DDL.split(";").filter(s => s.trim().length > 0);
  assert.ok(statements.length >= 3); // 1 CREATE TABLE + 2 CREATE INDEX
});