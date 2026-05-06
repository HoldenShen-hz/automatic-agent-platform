import assert from "node:assert/strict";
import test from "node:test";

import { ConfigAuditService } from "../../../../../src/platform/control-plane/config-center/config-audit-service.js";
import { ConfigVersioningService } from "../../../../../src/platform/control-plane/config-center/config-versioning-service.js";

interface ReplayableEvent {
  eventType: string;
  payload: Record<string, unknown>;
}

class ReplayableEventBus {
  private readonly history: ReplayableEvent[] = [];
  private readonly subscribers = new Map<string, Array<(event: { payloadJson: string }) => void | Promise<void>>>();

  public async subscribe(
    eventType: string,
    handler: (event: { payloadJson: string }) => void | Promise<void>,
  ): Promise<void> {
    const handlers = this.subscribers.get(eventType) ?? [];
    handlers.push(handler);
    this.subscribers.set(eventType, handlers);

    for (const event of this.history) {
      if (event.eventType === eventType) {
        await handler({ payloadJson: JSON.stringify(event.payload) });
      }
    }
  }

  public publish(event: ReplayableEvent): void {
    this.history.push(event);
    const handlers = this.subscribers.get(event.eventType) ?? [];
    for (const handler of handlers) {
      void handler({ payloadJson: JSON.stringify(event.payload) });
    }
  }
}

test("ConfigVersioningService rebuilds version history and rollback points from durable event replay", async () => {
  const eventBus = new ReplayableEventBus();
  const writer = new ConfigVersioningService({ eventBus: eventBus as never });

  const version = await writer.createVersion(
    "platform.runtime.timeout",
    "platform",
    null,
    { value: 30000 },
    "user-123",
    "initial config",
  );
  const rollbackPoint = await writer.createRollbackPoint("platform.runtime.timeout", "platform", null, "user-123");

  const restarted = new ConfigVersioningService({ eventBus: eventBus as never });
  await restarted.initialize();

  const history = await restarted.getVersionHistory("platform.runtime.timeout", "platform", null);
  const rollbackPoints = await restarted.getRollbackPoints("platform.runtime.timeout", "platform", null);

  assert.equal(history.length, 1);
  assert.equal(history[0]?.versionId, version.versionId);
  assert.deepEqual(history[0]?.content, { value: 30000 });
  assert.equal(rollbackPoints.length, 1);
  assert.equal(rollbackPoints[0]?.rollbackId, rollbackPoint?.rollbackId);
});

test("ConfigAuditService rebuilds who/when/what/why entries from durable event replay", async () => {
  const eventBus = new ReplayableEventBus();
  const writer = new ConfigAuditService({ eventBus: eventBus as never });

  const recorded = writer.recordUpdate(
    "tenant-1.runtime.timeout",
    "tenant",
    "tenant-1",
    { value: 30000 },
    { value: 60000 },
    "admin-001",
    "increase timeout",
    {
      approvalRequired: true,
      versionId: "cfgver_001",
      previousVersionId: "cfgver_000",
      metadata: { ticketId: "chg-123" },
    },
  );

  const restarted = new ConfigAuditService({ eventBus: eventBus as never });
  await restarted.initialize();

  const query = await restarted.query({
    configPath: "tenant-1.runtime.timeout",
    layer: "tenant",
    sourceId: "tenant-1",
  });

  assert.equal(query.totalCount, 1);
  assert.equal(query.entries[0]?.auditId, recorded.auditId);
  assert.equal(query.entries[0]?.actor, "admin-001");
  assert.equal(query.entries[0]?.reason, "increase timeout");
  assert.equal(query.entries[0]?.approvalStatus, "pending");
  assert.equal(query.entries[0]?.versionId, "cfgver_001");
  assert.equal(query.entries[0]?.previousVersionId, "cfgver_000");
  assert.deepEqual(query.entries[0]?.metadata, { ticketId: "chg-123" });
});
