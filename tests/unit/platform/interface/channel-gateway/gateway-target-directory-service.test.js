import assert from "node:assert/strict";
import test from "node:test";

import { GatewayTargetDirectoryService } from "../../../../../src/platform/interface/channel-gateway/gateway-target-directory-service.js";
import type { GatewayStoragePort } from "../../../../../src/platform/interface/channel-gateway/storage-port.js";
import type { GatewayTargetRecord } from "../../../../../src/platform/contracts/types/domain.js";

class MockGatewayStoragePort implements GatewayStoragePort {
  private targets = new Map<string, GatewayTargetRecord>();

  getGatewayTarget(targetId: string): GatewayTargetRecord | null {
    return this.targets.get(targetId) ?? null;
  }

  upsertGatewayTarget(target: GatewayTargetRecord): void {
    this.targets.set(target.targetId, target);
  }

  listGatewayTargets(_limit?: number, _channel?: string): GatewayTargetRecord[] {
    return [...this.targets.values()];
  }

  listGatewaySessionTargetCandidates(_limit?: number, _channel?: string, _tenantId?: string | null): never[] {
    return [];
  }
}

test("GatewayTargetDirectoryService registers and retrieves target", () => {
  const store = new MockGatewayStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  const target = service.registerTarget({
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "12345",
    displayName: "Test User",
    aliases: ["testuser", "tu"],
  });

  assert.equal(target.channel, "telegram");
  assert.equal(target.targetKind, "user");
  assert.equal(target.displayName, "Test User");
  assert.ok(target.targetId.includes("telegram"));
  assert.ok(target.targetId.includes("user"));
});

test("GatewayTargetDirectoryService resolves target by exact match on displayName", () => {
  const store = new MockGatewayStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  service.registerTarget({
    channel: "slack",
    targetKind: "channel",
    externalTargetId: "C001",
    displayName: "general",
  });

  const resolution = service.resolveTarget({ query: "general" });

  assert.equal(resolution.entry.displayName, "general");
  assert.equal(resolution.matchedBy, "display_name_exact");
});

test("GatewayTargetDirectoryService resolves target by exact match on alias", () => {
  const store = new MockGatewayStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  service.registerTarget({
    channel: "slack",
    targetKind: "channel",
    externalTargetId: "C002",
    displayName: "Random",
    aliases: ["random-channel", "rand"],
  });

  const resolution = service.resolveTarget({ query: "random-channel" });

  assert.equal(resolution.entry.displayName, "Random");
  assert.equal(resolution.matchedBy, "alias_exact");
});

test("GatewayTargetDirectoryService resolves target by targetId exact match", () => {
  const store = new MockGatewayStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  const target = service.registerTarget({
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "999",
    displayName: "Direct User",
  });

  const resolution = service.resolveTarget({ query: target.targetId });

  assert.equal(resolution.entry.targetId, target.targetId);
  assert.equal(resolution.matchedBy, "target_id_exact");
});

test("GatewayTargetDirectoryService resolves target by prefix match", () => {
  const store = new MockGatewayStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  service.registerTarget({
    channel: "telegram",
    targetKind: "user",
    externalTargetId: "user123",
    displayName: "Username Here",
  });

  const resolution = service.resolveTarget({ query: "user" });

  assert.ok(resolution.matchedBy.endsWith("_prefix"));
});

test("GatewayTargetDirectoryService throws GatewayTargetNotFoundError when no match", () => {
  const store = new MockGatewayStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  assert.throws(
    () => service.resolveTarget({ query: "nonexistent" }),
    (err: unknown) => {
      return err instanceof Error && err.name === "GatewayTargetNotFoundError";
    },
  );
});

test("GatewayTargetDirectoryService throws GatewayTargetAmbiguousError for multiple matches", () => {
  const store = new MockGatewayStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  service.registerTarget({
    channel: "slack",
    targetKind: "channel",
    externalTargetId: "C100",
    displayName: "Team Alpha",
  });

  service.registerTarget({
    channel: "slack",
    targetKind: "channel",
    externalTargetId: "C101",
    displayName: "Team Alpha Beta",
  });

  assert.throws(
    () => service.resolveTarget({ query: "Team Alpha" }),
    (err: unknown) => {
      return err instanceof Error && err.name === "GatewayTargetAmbiguousError";
    },
  );
});

test("GatewayTargetDirectoryService throws on empty query", () => {
  const store = new MockGatewayStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  assert.throws(
    () => service.resolveTarget({ query: "" }),
    (err: unknown) => {
      return err instanceof Error && "code" in err && (err as { code: string }).code === "gateway.target_query_required";
    },
  );
});

test("GatewayTargetDirectoryService throws on whitespace-only query", () => {
  const store = new MockGatewayStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  assert.throws(
    () => service.resolveTarget({ query: "   " }),
    (err: unknown) => {
      return err instanceof Error && "code" in err && (err as { code: string }).code === "gateway.target_query_required";
    },
  );
});

test("GatewayTargetDirectoryService listTargets returns all targets without filter", () => {
  const store = new MockGatewayStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  service.registerTarget({ channel: "telegram", targetKind: "user", externalTargetId: "1", displayName: "User 1" });
  service.registerTarget({ channel: "slack", targetKind: "channel", externalTargetId: "C1", displayName: "Channel 1" });

  const targets = service.listTargets();

  assert.equal(targets.length, 2);
});

test("GatewayTargetDirectoryService listTargets filters by channel", () => {
  const store = new MockGatewayStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  service.registerTarget({ channel: "telegram", targetKind: "user", externalTargetId: "1", displayName: "Telegram User" });
  service.registerTarget({ channel: "slack", targetKind: "channel", externalTargetId: "C1", displayName: "Slack Channel" });

  const targets = service.listTargets({ channel: "telegram" });

  assert.equal(targets.length, 1);
  assert.equal(targets[0]?.channel, "telegram");
});

test("GatewayTargetDirectoryService listTargets filters by query string", () => {
  const store = new MockGatewayStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  service.registerTarget({ channel: "telegram", targetKind: "user", externalTargetId: "1", displayName: "Alice" });
  service.registerTarget({ channel: "telegram", targetKind: "user", externalTargetId: "2", displayName: "Bob" });

  const targets = service.listTargets({ query: "Ali" });

  assert.equal(targets.length, 1);
  assert.equal(targets[0]?.displayName, "Alice");
});

test("GatewayTargetDirectoryService listTargets respects limit", () => {
  const store = new MockGatewayStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  for (let i = 0; i < 5; i++) {
    service.registerTarget({ channel: "telegram", targetKind: "user", externalTargetId: String(i), displayName: `User ${i}` });
  }

  const targets = service.listTargets({ limit: 3 });

  assert.equal(targets.length, 3);
});

test("GatewayTargetDirectoryService normalizes channel to lowercase", () => {
  const store = new MockGatewayStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  const target = service.registerTarget({
    channel: "TELEGRAM",
    targetKind: "user",
    externalTargetId: "123",
    displayName: "Test User",
  });

  assert.equal(target.channel, "telegram");
});

test("GatewayTargetDirectoryService rejects empty display name", () => {
  const store = new MockGatewayStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  assert.throws(
    () =>
      service.registerTarget({
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "123",
        displayName: "   ",
      }),
    (err: unknown) => {
      return err instanceof Error && "code" in err && (err as { code: string }).code === "gateway.invalid_display_name";
    },
  );
});

test("GatewayTargetDirectoryService rejects empty external target id", () => {
  const store = new MockGatewayStoragePort();
  const service = new GatewayTargetDirectoryService(store);

  assert.throws(
    () =>
      service.registerTarget({
        channel: "telegram",
        targetKind: "user",
        externalTargetId: "   ",
        displayName: "Test User",
      }),
    (err: unknown) => {
      return err instanceof Error && "code" in err && (err as { code: string }).code === "gateway.invalid_external_target_id";
    },
  );
});
