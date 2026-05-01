import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { GatewayStoragePort } from "../../../../../src/platform/five-plane-interface/channel-gateway/storage-port.js";
import { GatewayStorageAdapter } from "../../../../../src/platform/five-plane-interface/channel-gateway/storage-adapter.js";
import type { GatewayTargetRecord } from "../../../../../src/platform/contracts/types/domain.js";

function makeMockStore(targets: Map<string, GatewayTargetRecord>): GatewayStoragePort {
  return {
    getGatewayTarget: (targetId: string) => targets.get(targetId) ?? null,
    upsertGatewayTarget: (target: GatewayTargetRecord) => { targets.set(target.targetId, target); },
    listGatewayTargets: (limit = 100, channel?: string) => {
      const all = [...targets.values()];
      const filtered = channel ? all.filter(t => t.channel === channel) : all;
      return filtered.slice(0, limit);
    },
    listGatewaySessionTargetCandidates: () => [],
  };
}

function makeTarget(overrides: Partial<GatewayTargetRecord> = {}): GatewayTargetRecord {
  return {
    targetId: "telegram:user:123456",
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "123456",
    displayName: "Test User",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-15T10:30:00Z",
    createdAt: "2024-01-15T10:30:00Z",
    updatedAt: "2024-01-15T10:30:00Z",
    ...overrides,
  };
}

test("GatewayStorageAdapter getGatewayTarget delegates to store", () => {
  const store = makeMockStore(new Map([["target_123", makeTarget({ targetId: "target_123" })]]));
  const adapter = new GatewayStorageAdapter(store);

  const result = adapter.getGatewayTarget("target_123");

  assert.equal(result?.targetId, "target_123");
});

test("GatewayStorageAdapter getGatewayTarget returns null for missing target", () => {
  const store = makeMockStore(new Map());
  const adapter = new GatewayStorageAdapter(store);

  const result = adapter.getGatewayTarget("nonexistent");

  assert.equal(result, null);
});

test("GatewayStorageAdapter upsertGatewayTarget delegates to store", () => {
  const targets = new Map<string, GatewayTargetRecord>();
  const store = makeMockStore(targets);
  const adapter = new GatewayStorageAdapter(store);

  const target = makeTarget({ targetId: "new_target" });
  adapter.upsertGatewayTarget(target);

  assert.equal(targets.get("new_target")?.targetId, "new_target");
});

test("GatewayStorageAdapter listGatewayTargets delegates to store", () => {
  const targets = new Map([
    ["target_1", makeTarget({ targetId: "target_1", channel: "telegram" })],
    ["target_2", makeTarget({ targetId: "target_2", channel: "slack" })],
    ["target_3", makeTarget({ targetId: "target_3", channel: "telegram" })],
  ]);
  const store = makeMockStore(targets);
  const adapter = new GatewayStorageAdapter(store);

  const result = adapter.listGatewayTargets();

  assert.equal(result.length, 3);
});

test("GatewayStorageAdapter listGatewayTargets filters by channel", () => {
  const targets = new Map([
    ["target_1", makeTarget({ targetId: "target_1", channel: "telegram" })],
    ["target_2", makeTarget({ targetId: "target_2", channel: "slack" })],
    ["target_3", makeTarget({ targetId: "target_3", channel: "telegram" })],
  ]);
  const store = makeMockStore(targets);
  const adapter = new GatewayStorageAdapter(store);

  const result = adapter.listGatewayTargets(100, "telegram");

  assert.equal(result.length, 2);
  assert.ok(result.every(t => t.channel === "telegram"));
});

test("GatewayStorageAdapter listGatewayTargets respects limit", () => {
  const targets = new Map([
    ["target_1", makeTarget({ targetId: "target_1" })],
    ["target_2", makeTarget({ targetId: "target_2" })],
    ["target_3", makeTarget({ targetId: "target_3" })],
  ]);
  const store = makeMockStore(targets);
  const adapter = new GatewayStorageAdapter(store);

  const result = adapter.listGatewayTargets(2);

  assert.equal(result.length, 2);
});

test("GatewayStorageAdapter listGatewaySessionTargetCandidates delegates to store", () => {
  const store = makeMockStore(new Map());
  const adapter = new GatewayStorageAdapter(store);

  // This test just verifies the delegation - the actual return is empty since mock returns empty
  const result = adapter.listGatewaySessionTargetCandidates();
  assert.deepEqual(result, []);
});