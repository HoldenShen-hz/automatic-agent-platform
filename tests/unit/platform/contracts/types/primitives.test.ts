import assert from "node:assert/strict";
import test from "node:test";

import type {
  Timestamp,
  TaskPriority,
  TaskSource,
  BudgetScope,
  EventTier,
  RunKind,
  WorkerStatus,
  LeaseStatus,
  MemoryLayer,
  SecretCategory,
  EnvironmentName,
  ExtensionPackageType,
} from "../../../../../src/platform/contracts/types/domain/primitives.js";

test("Timestamp is string type", () => {
  const ts: Timestamp = "2026-04-09T00:00:00.000Z";
  assert.equal(typeof ts, "string");
  assert.equal(ts, "2026-04-09T00:00:00.000Z");
});

test("TaskPriority type accepts valid values", () => {
  const priorities: TaskPriority[] = ["low", "normal", "high", "urgent"];
  assert.deepEqual(priorities, ["low", "normal", "high", "urgent"]);
});

test("TaskSource type accepts valid values", () => {
  const sources: TaskSource[] = ["user", "perception", "system"];
  assert.deepEqual(sources, ["user", "perception", "system"]);
});

test("BudgetScope type accepts valid values", () => {
  const scopes: BudgetScope[] = [
    "task_execution",
    "compaction",
    "skill_execution",
    "recovery_retry",
    "approval_review",
  ];
  assert.equal(scopes.length, 5);
});

test("EventTier type accepts valid values", () => {
  const tiers: EventTier[] = ["tier_1", "tier_2", "tier_3"];
  assert.deepEqual(tiers, ["tier_1", "tier_2", "tier_3"]);
});

test("RunKind type accepts valid values", () => {
  const runKinds: RunKind[] = ["task_run", "tool_call", "approval_resume", "replay"];
  assert.deepEqual(runKinds, ["task_run", "tool_call", "approval_resume", "replay"]);
});

test("WorkerStatus type accepts valid values", () => {
  const statuses: WorkerStatus[] = ["idle", "busy", "draining", "degraded", "unavailable", "quarantined", "offline"];
  assert.equal(statuses.length, 7);
});

test("LeaseStatus type accepts valid values", () => {
  const statuses: LeaseStatus[] = ["active", "expired", "released", "reclaimed"];
  assert.deepEqual(statuses, ["active", "expired", "released", "reclaimed"]);
});

test("MemoryLayer type accepts valid values", () => {
  const layers: MemoryLayer[] = ["layer_3", "layer_5", "layer_7"];
  assert.deepEqual(layers, ["layer_3", "layer_5", "layer_7"]);
});

test("SecretCategory type accepts valid values", () => {
  const categories: SecretCategory[] = [
    "provider_api_key",
    "tenant_credential",
    "oauth_client_secret",
    "signing_key",
    "db_connection_secret",
    "break_glass_secret",
  ];
  assert.equal(categories.length, 6);
});

test("EnvironmentName type accepts valid values", () => {
  const names: EnvironmentName[] = ["dev", "test", "staging", "pre-prod", "prod"];
  assert.deepEqual(names, ["dev", "test", "staging", "pre-prod", "prod"]);
});

test("ExtensionPackageType type accepts valid values", () => {
  const types: ExtensionPackageType[] = ["tool", "skill", "plugin", "mcp", "template"];
  assert.deepEqual(types, ["tool", "skill", "plugin", "mcp", "template"]);
});
