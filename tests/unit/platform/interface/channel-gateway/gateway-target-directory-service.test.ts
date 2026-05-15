/**
 * Unit tests for gateway-target-directory-service
 * Tests target registration, resolution, and directory management
 */

import assert from "node:assert/strict";
import test from "node:test";
import { GatewayTargetDirectoryService, GatewayTargetNotFoundError, GatewayTargetAmbiguousError } from "../../../../../src/platform/five-plane-interface/channel-gateway/gateway-target-directory-service.js";
import type { GatewayStoragePort } from "../../../../../src/platform/five-plane-interface/channel-gateway/storage-port.js";
import type { GatewayTargetRecord } from "../../../../../src/platform/contracts/types/domain.js";
import type { GatewaySessionTargetCandidate } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

function createMockStoragePort(): GatewayStoragePort & {
  targets: Map<string, GatewayTargetRecord>;
  sessionCandidates: GatewaySessionTargetCandidate[];
} {
  const targets = new Map<string, GatewayTargetRecord>();
  const sessionCandidates: GatewaySessionTargetCandidate[] = [];

  return {
    targets,
    sessionCandidates,
    upsertGatewayTarget(target: GatewayTargetRecord): void {
      targets.set(target.targetId, target);
    },
    getGatewayTarget(targetId: string): GatewayTargetRecord | null {
      return targets.get(targetId) ?? null;
    },
    listGatewayTargets(_limit: number, channel?: string): GatewayTargetRecord[] {
      const all = [...targets.values()];
      if (channel == null) return all;
      return all.filter(t => t.channel === channel);
    },
    listGatewaySessionTargetCandidates(_limit: number, _channel?: string): GatewaySessionTargetCandidate[] {
      return sessionCandidates;
    },
  };
}

function createTestTarget(
  channel: string,
  targetKind: GatewayTargetRecord["targetKind"],
  externalId: string,
  displayName: string,
): GatewayTargetRecord {
  return {
    targetId: `${channel}:${targetKind}:${externalId.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`,
    channel,
    targetKind: targetKind as GatewayTargetRecord["targetKind"],
    externalTargetId: externalId,
    displayName,
    aliasesJson: "[]",
    metadataJson: null,
    source: "directory",
    lastSeenAt: "2026-04-01T00:00:00.000Z",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  };
}

test("registerTarget creates a new target in the directory", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  const result = service.registerTarget({
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "user_12345",
    displayName: "Test User",
  });

  assert.ok(result.targetId.includes("telegram"));
  assert.ok(result.targetId.includes("user"));
  assert.equal(result.displayName, "Test User");
  assert.equal(result.channel, "telegram");
});

test("registerTarget updates existing target with same channel+kind+externalId", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  const first = service.registerTarget({
    channel: "slack",
    targetKind: "room",
    externalTargetId: "C12345",
    displayName: "Original Name",
  });

  const second = service.registerTarget({
    channel: "slack",
    targetKind: "room",
    externalTargetId: "C12345",
    displayName: "Updated Name",
  });

  assert.equal(second.displayName, "Updated Name");
  assert.equal(second.targetId, first.targetId);
});

test("registerTarget normalizes display name whitespace", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  const result = service.registerTarget({
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "user_123",
    displayName: "  Multiple   Spaces  ",
  });

  assert.equal(result.displayName, "Multiple Spaces");
});

test("registerTarget throws for empty external target ID", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  assert.throws(
    () => service.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "   ",
      displayName: "Test",
    }),
    (err: unknown) => err instanceof Error && err.message.includes("external_target_id"),
  );
});

test("registerTarget throws for empty display name", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  assert.throws(
    () => service.registerTarget({
      channel: "telegram",
      targetKind: "user",
      externalTargetId: "user_123",
      displayName: "   ",
    }),
    (err: unknown) => err instanceof Error && err.message.includes("display_name"),
  );
});

test("registerTarget normalizes channel to lowercase", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  const result = service.registerTarget({
    channel: "TELEGRAM",
    targetKind: "user",
    externalTargetId: "user_456",
    displayName: "Test",
  });

  assert.equal(result.channel, "telegram");
});

test("registerTarget applies aliases", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  const result = service.registerTarget({
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "user_789",
    displayName: "Aliased User",
    aliases: ["alias1", "alias2", "alias1"],
  });

  assert.ok(result.targetId);
  const stored = store.getGatewayTarget(result.targetId);
  assert.ok(stored);
  const aliases = JSON.parse(stored.aliasesJson) as string[];
  assert.equal(aliases.length, 2);
  assert.ok(aliases.includes("alias1"));
  assert.ok(aliases.includes("alias2"));
});

test("listTargets returns empty array when no targets", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  const result = service.listTargets();

  assert.deepEqual(result, []);
});

test("listTargets returns all registered targets", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  service.registerTarget({ channel: "telegram", targetKind: "user", externalTargetId: "u1", displayName: "User 1" });
  service.registerTarget({ channel: "slack", targetKind: "room", externalTargetId: "c1", displayName: "Channel 1" });

  const result = service.listTargets();

  assert.equal(result.length, 2);
});

test("listTargets filters by channel", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  service.registerTarget({ channel: "telegram", targetKind: "user", externalTargetId: "u1", displayName: "Telegram User" });
  service.registerTarget({ channel: "slack", targetKind: "room", externalTargetId: "c1", displayName: "Slack Channel" });

  const telegramOnly = service.listTargets({ channel: "telegram" });

  assert.equal(telegramOnly.length, 1);
  assert.equal(telegramOnly[0]?.channel, "telegram");
});

test("listTargets filters by query string", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  service.registerTarget({ channel: "telegram", targetKind: "user", externalTargetId: "u1", displayName: "Alice Smith" });
  service.registerTarget({ channel: "telegram", targetKind: "user", externalTargetId: "u2", displayName: "Bob Jones" });

  const result = service.listTargets({ query: "alice" });

  assert.equal(result.length, 1);
  assert.ok(result[0]?.displayName.includes("Alice"));
});

test("listTargets respects limit parameter", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  for (let i = 0; i < 10; i++) {
    service.registerTarget({ channel: "telegram", targetKind: "user", externalTargetId: `u${i}`, displayName: `User ${i}` });
  }

  const result = service.listTargets({ limit: 3 });

  assert.equal(result.length, 3);
});

test("listTargets defaults limit to 50", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  for (let i = 0; i < 60; i++) {
    service.registerTarget({ channel: "telegram", targetKind: "user", externalTargetId: `u${i}`, displayName: `User ${i}` });
  }

  const result = service.listTargets({});

  assert.ok(result.length <= 50);
});

test("resolveTarget resolves by exact targetId", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  const registered = service.registerTarget({ channel: "telegram", targetKind: "user", externalTargetId: "user_exact", displayName: "Exact User" });

  const result = service.resolveTarget({ query: registered.targetId });

  assert.equal(result.entry.displayName, "Exact User");
  assert.equal(result.matchedBy, "target_id_exact");
});

test("resolveTarget resolves by exact displayName", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  service.registerTarget({ channel: "telegram", targetKind: "user", externalTargetId: "user_abc", displayName: "Display Name Test" });

  const result = service.resolveTarget({ query: "Display Name Test" });

  assert.equal(result.entry.displayName, "Display Name Test");
  assert.equal(result.matchedBy, "display_name_exact");
});

test("resolveTarget resolves by alias", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  service.registerTarget({
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "user_alias",
    displayName: "Alias User",
    aliases: ["my-alias", "another-alias"],
  });

  const result = service.resolveTarget({ query: "my-alias" });

  assert.equal(result.entry.displayName, "Alias User");
  assert.equal(result.matchedBy, "alias_exact");
});

test("resolveTarget throws GatewayTargetNotFoundError when no match", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  service.registerTarget({ channel: "telegram", targetKind: "user", externalTargetId: "u1", displayName: "User 1" });

  assert.throws(
    () => service.resolveTarget({ query: "nonexistent" }),
    (err: unknown) => err instanceof Error && err.message.includes("target_not_found"),
  );
});

test("resolveTarget throws GatewayTargetAmbiguousError when multiple matches", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  // Register two targets with similar display names that would prefix match the same query
  service.registerTarget({ channel: "telegram", targetKind: "user", externalTargetId: "prefix1", displayName: "prefix test 1" });
  service.registerTarget({ channel: "telegram", targetKind: "user", externalTargetId: "prefix2", displayName: "prefix test 2" });

  assert.throws(
    () => service.resolveTarget({ query: "prefix" }),
    GatewayTargetAmbiguousError,
  );
});

test("resolveTarget throws for empty query", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  assert.throws(
    () => service.resolveTarget({ query: "   " }),
    (err: unknown) => err instanceof Error && err.message.includes("target_query_required"),
  );
});

test("resolveTarget includes session candidates from session history", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  // Add session candidates directly to store
  store.sessionCandidates.push({
    channel: "telegram",
    sessionId: "session_abc",
    sessionStatus: "open",
    externalSessionId: "ext_session_abc",
    taskId: "task_123",
    taskTitle: "Session Task Title",
    lastSeenAt: "2026-04-20T12:00:00.000Z",
    latestMessage: "Hello from session",
    latestMessageAt: "2026-04-20T12:00:00.000Z",
  });

  const result = service.resolveTarget({ query: "session_abc" });

  assert.equal(result.entry.source, "session_history");
  assert.ok(result.entry.displayName.includes("Session Task Title"));
});

test("listTargets merges directory and session history targets", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  service.registerTarget({ channel: "telegram", targetKind: "user", externalTargetId: "dir_user", displayName: "Directory User" });

  store.sessionCandidates.push({
    channel: "slack",
    sessionId: "sess_xyz",
    sessionStatus: "open",
    externalSessionId: null,
    taskId: "task_456",
    taskTitle: "Slack Session",
    lastSeenAt: "2026-04-20T12:00:00.000Z",
    latestMessage: null,
    latestMessageAt: null,
  });

  const result = service.listTargets();

  assert.equal(result.length, 2);
});

test("directory target takes precedence over session candidate with same targetId", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  // Register a target
  service.registerTarget({ channel: "telegram", targetKind: "session", externalTargetId: "sess_duplicate", displayName: "Directory Session" });

  // Add session candidate that would create same targetId
  store.sessionCandidates.push({
    channel: "telegram",
    sessionId: "sess_duplicate",
    sessionStatus: "open",
    externalSessionId: null,
    taskId: "task_789",
    taskTitle: "Session Candidate",
    lastSeenAt: "2026-04-20T12:00:00.000Z",
    latestMessage: null,
    latestMessageAt: null,
  });

  const result = service.listTargets();

  assert.equal(result.length, 1);
  assert.equal(result[0]?.source, "directory");
  assert.equal(result[0]?.displayName, "Directory Session");
});

test("registerTarget stores metadata as JSON", () => {
  const store = createMockStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  const result = service.registerTarget({
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "user_meta",
    displayName: "Metadata User",
    metadata: { role: "admin", tier: "premium" },
  });

  const stored = store.getGatewayTarget(result.targetId);
  assert.ok(stored?.metadataJson);
  const metadata = JSON.parse(stored!.metadataJson!) as { role: string; tier: string };
  assert.equal(metadata.role, "admin");
  assert.equal(metadata.tier, "premium");
});
