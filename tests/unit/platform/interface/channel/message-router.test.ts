import { test } from "node:test";
import assert from "node:assert/strict";

import { GatewayTargetDirectoryService, GatewayTargetNotFoundError, GatewayTargetAmbiguousError } from "../../../../../src/platform/five-plane-interface/channel-gateway/gateway-target-directory-service.js";
import type { GatewayStoragePort } from "../../../../../src/platform/five-plane-interface/channel-gateway/storage-port.js";
import type { GatewayTargetRecord, GatewayTargetKind } from "../../../../../src/platform/contracts/types/domain.js";
import type { GatewaySessionTargetCandidate } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

/**
 * Manual mock implementations for unit testing GatewayTargetDirectoryService
 * without requiring database or external dependencies.
 */

type MockGatewayTarget = GatewayTargetRecord;

function createMockStoragePort(targets: Map<string, MockGatewayTarget> = new Map(), sessionCandidates: GatewaySessionTargetCandidate[] = []): GatewayStoragePort {
  return {
    getGatewayTarget(targetId: string): GatewayTargetRecord | null {
      return targets.get(targetId) ?? null;
    },
    upsertGatewayTarget(target: GatewayTargetRecord): void {
      const mock: MockGatewayTarget = {
        targetId: target.targetId,
        channel: target.channel,
        targetKind: target.targetKind,
        externalTargetId: target.externalTargetId,
        displayName: target.displayName,
        aliasesJson: target.aliasesJson,
        metadataJson: target.metadataJson,
        source: target.source,
        lastSeenAt: target.lastSeenAt,
        createdAt: target.createdAt,
        updatedAt: target.updatedAt,
      };
      targets.set(target.targetId, mock);
    },
    listGatewayTargets(_limit?: number, channel?: string): GatewayTargetRecord[] {
      const all = [...targets.values()];
      if (channel) {
        return all.filter(t => t.channel === channel);
      }
      return all;
    },
    listGatewaySessionTargetCandidates(_limit?: number, channel?: string, _tenantId?: string | null) {
      if (channel) {
        return sessionCandidates.filter(c => c.channel === channel);
      }
      return sessionCandidates;
    },
  };
}

test("GatewayTargetDirectoryService registers new target and returns canonical record", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  const result = service.registerTarget({
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "chat123",
    displayName: "Test User",
    aliases: ["testuser", "tu"],
  });

  assert.equal(result.channel, "telegram");
  assert.equal(result.targetKind, "user");
  assert.equal(result.externalTargetId, "chat123");
  assert.ok(result.targetId.startsWith("telegram:user:"));
});

test("GatewayTargetDirectoryService builds canonical target ID with normalized segments", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  const result = service.registerTarget({
    channel: "TELEGRAM",
    targetKind: "user",
    externalTargetId: "Chat-123",
    displayName: "Test User",
  });

  // Target ID should have normalized channel, kind, and external ID
  assert.ok(result.targetId.startsWith("telegram:user:"));
  // The external ID should be normalized (dash preserved, lowercased)
  assert.ok(result.targetId.endsWith("chat-123"));
});

test("GatewayTargetDirectoryService normalizes display name whitespace", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  const result = service.registerTarget({
    channel: "slack",
    targetKind: "room",
    externalTargetId: "C001",
    displayName: "  Test   Room  ",
  });

  assert.equal(result.displayName, "Test Room");
});

test("GatewayTargetDirectoryService deduplicates and normalizes aliases", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  const result = service.registerTarget({
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "chat456",
    displayName: "User",
    aliases: ["alias1", "  alias1  ", "alias2", "alias1"],
  });

  const stored = store.getGatewayTarget(result.targetId);
  assert.ok(stored);
  const aliases = JSON.parse(stored!.aliasesJson);
  assert.deepEqual(aliases, ["alias1", "alias2"]);
});

test("GatewayTargetDirectoryService resolves target by exact targetId match", () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("telegram:user:chat123", {
    targetId: "telegram:user:chat123",
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "chat123",
    displayName: "Test User",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const store = createMockStoragePort(targets);
  const service = new GatewayTargetDirectoryService(store);

  const result = service.resolveTarget({ query: "telegram:user:chat123" });

  assert.equal(result.entry.targetId, "telegram:user:chat123");
  assert.equal(result.matchedBy, "target_id_exact");
});

test("GatewayTargetDirectoryService resolves target by exact displayName match", () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("telegram:user:chat123", {
    targetId: "telegram:user:chat123",
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "chat123",
    displayName: "Finance Team",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const store = createMockStoragePort(targets);
  const service = new GatewayTargetDirectoryService(store);

  const result = service.resolveTarget({ query: "Finance Team" });

  assert.equal(result.entry.targetId, "telegram:user:chat123");
  assert.equal(result.matchedBy, "display_name_exact");
});

test("GatewayTargetDirectoryService resolves target by exact alias match", () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("slack:room:C001", {
    targetId: "slack:room:C001",
    channel: "slack",
    targetKind: "room",
    externalTargetId: "C001",
    displayName: "Ops Room",
    aliasesJson: JSON.stringify(["ops-room", "opsroom"]),
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const store = createMockStoragePort(targets);
  const service = new GatewayTargetDirectoryService(store);

  const result = service.resolveTarget({ query: "ops-room" });

  assert.equal(result.entry.targetId, "slack:room:C001");
  assert.equal(result.matchedBy, "alias_exact");
});

test("GatewayTargetDirectoryService resolves target by prefix match on targetId", () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("telegram:user:chat789", {
    targetId: "telegram:user:chat789",
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "chat789",
    displayName: "Test User",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const store = createMockStoragePort(targets);
  const service = new GatewayTargetDirectoryService(store);

  const result = service.resolveTarget({ query: "telegram:user:chat" });

  assert.equal(result.entry.targetId, "telegram:user:chat789");
  assert.equal(result.matchedBy, "target_id_prefix");
});

test("GatewayTargetDirectoryService throws GatewayTargetNotFoundError when no match", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  assert.throws(
    () => service.resolveTarget({ query: "nonexistent" }),
    GatewayTargetNotFoundError,
  );
});

test("GatewayTargetDirectoryService throws GatewayTargetAmbiguousError on multiple exact matches", () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("telegram:user:chat1", {
    targetId: "telegram:user:chat1",
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "chat1",
    displayName: "Test User",
    aliasesJson: JSON.stringify(["test"]),
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });
  targets.set("telegram:user:chat2", {
    targetId: "telegram:user:chat2",
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "chat2",
    displayName: "Test User",
    aliasesJson: JSON.stringify(["test"]),
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const store = createMockStoragePort(targets);
  const service = new GatewayTargetDirectoryService(store);

  assert.throws(
    () => service.resolveTarget({ query: "test" }),
    GatewayTargetAmbiguousError,
  );
});

test("GatewayTargetDirectoryService throws GatewayTargetAmbiguousError on multiple prefix matches", () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("slack:room:alpha", {
    targetId: "slack:room:alpha",
    channel: "slack",
    targetKind: "room",
    externalTargetId: "alpha",
    displayName: "Alpha Room",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });
  targets.set("slack:room:alpha-beta", {
    targetId: "slack:room:alpha-beta",
    channel: "slack",
    targetKind: "room",
    externalTargetId: "alpha-beta",
    displayName: "Alpha Beta Room",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const store = createMockStoragePort(targets);
  const service = new GatewayTargetDirectoryService(store);

  assert.throws(
    () => service.resolveTarget({ query: "alpha" }),
    GatewayTargetAmbiguousError,
  );
});

test("GatewayTargetDirectoryService filters listTargets by channel", () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("telegram:user:chat1", {
    targetId: "telegram:user:chat1",
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "chat1",
    displayName: "Telegram User",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });
  targets.set("slack:room:C001", {
    targetId: "slack:room:C001",
    channel: "slack",
    targetKind: "room",
    externalTargetId: "C001",
    displayName: "Slack Room",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const store = createMockStoragePort(targets);
  const service = new GatewayTargetDirectoryService(store);

  const results = service.listTargets({ channel: "telegram" });

  assert.equal(results.length, 1);
  assert.equal(results[0]?.channel, "telegram");
});

test("GatewayTargetDirectoryService filters listTargets by query string", () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("telegram:user:chat1", {
    targetId: "telegram:user:chat1",
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "chat1",
    displayName: "Alice User",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });
  targets.set("telegram:user:chat2", {
    targetId: "telegram:user:chat2",
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "chat2",
    displayName: "Bob User",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const store = createMockStoragePort(targets);
  const service = new GatewayTargetDirectoryService(store);

  const results = service.listTargets({ query: "Alice" });

  assert.equal(results.length, 1);
  assert.equal(results[0]?.displayName, "Alice User");
});

test("GatewayTargetDirectoryService limits listTargets results", () => {
  const targets = new Map<string, MockGatewayTarget>();
  for (let i = 0; i < 10; i++) {
    targets.set(`telegram:user:chat${i}`, {
      targetId: `telegram:user:chat${i}`,
      channel: "telegram",
      targetKind: "user",
      externalTargetId: `chat${i}`,
      displayName: `User ${i}`,
      aliasesJson: "[]",
      metadataJson: null,
      source: "directory",
      lastSeenAt: new Date(2024, 0, i + 1).toISOString(),
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
  }

  const store = createMockStoragePort(targets);
  const service = new GatewayTargetDirectoryService(store);

  const results = service.listTargets({ limit: 3 });

  assert.equal(results.length, 3);
});

test("GatewayTargetDirectoryService throws on empty query string", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  assert.throws(
    () => service.resolveTarget({ query: "" }),
    (err: unknown) => (err as any)?.code === "gateway.target_query_required",
  );
});

test("GatewayTargetDirectoryService merges session history targets with directory targets", () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("telegram:user:chat1", {
    targetId: "telegram:user:chat1",
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "chat1",
    displayName: "Registered User",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const sessionCandidates: GatewaySessionTargetCandidate[] = [
    {
      channel: "slack",
      sessionId: "session123",
      sessionStatus: "open",
      externalSessionId: "ext-session-123",
      taskId: "task456",
      taskTitle: "Test Task",
      lastSeenAt: "2024-01-02T00:00:00.000Z",
      latestMessage: "Hello from session",
      latestMessageAt: "2024-01-02T00:00:00.000Z",
    },
  ];

  const store = createMockStoragePort(targets, sessionCandidates);
  const service = new GatewayTargetDirectoryService(store);

  const results = service.listTargets({});

  // Should have both directory and session targets
  assert.ok(results.length >= 2);
});

test("GatewayTargetDirectoryService prioritizes directory targets over session history", () => {
  const targets = new Map<string, MockGatewayTarget>();
  // Directory target with externalTargetId that normalizes to "session123"
  targets.set("slack:session:session123", {
    targetId: "slack:session:session123",
    channel: "slack",
    targetKind: "session",
    externalTargetId: "session123",
    displayName: "Directory Session",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  // Session candidate with same sessionId so targetId matches directory
  const sessionCandidates: GatewaySessionTargetCandidate[] = [
    {
      channel: "slack",
      sessionId: "session123",
      sessionStatus: "open",
      externalSessionId: "session123", // Same value ensures same targetId after normalization
      taskId: "task456",
      taskTitle: "Test Task",
      lastSeenAt: "2024-01-02T00:00:00.000Z",
      latestMessage: "Hello from session",
      latestMessageAt: "2024-01-02T00:00:00.000Z",
    },
  ];

  const store = createMockStoragePort(targets, sessionCandidates);
  const service = new GatewayTargetDirectoryService(store);

  const results = service.listTargets({});

  // Directory target should appear, session candidate with same targetId should be skipped
  const directoryTarget = results.find(r => r.source === "directory");
  const sessionTarget = results.find(r => r.source === "session_history");
  assert.ok(directoryTarget);
  assert.ok(!sessionTarget);
});

test("GatewayTargetDirectoryService sorts results by lastSeenAt descending", () => {
  const targets = new Map<string, MockGatewayTarget>();
  targets.set("telegram:user:old", {
    targetId: "telegram:user:old",
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "old",
    displayName: "Old User",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });
  targets.set("telegram:user:new", {
    targetId: "telegram:user:new",
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "new",
    displayName: "New User",
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2024-01-03T00:00:00.000Z",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  });

  const store = createMockStoragePort(targets);
  const service = new GatewayTargetDirectoryService(store);

  const results = service.listTargets({});

  assert.equal(results[0]?.displayName, "New User");
  assert.equal(results[1]?.displayName, "Old User");
});
