import assert from "node:assert/strict";
import test from "node:test";

import { ConfigVersioningService } from "../../../../../src/platform/control-plane/config-center/config-versioning-service.js";

class MockEventBus {
  public readonly publishedEvents: Array<{ eventType: string; payload: Record<string, unknown> }> = [];

  public publish(event: { eventType: string; payload: Record<string, unknown> }): void {
    this.publishedEvents.push(event);
  }

  public async subscribe(): Promise<void> {
    // no-op replay hook for unit tests
  }
}

test("createVersion publishes both config.version.created and config.changed", async () => {
  const eventBus = new MockEventBus();
  const service = new ConfigVersioningService({ eventBus: eventBus as never });

  const snapshot = await service.createVersion(
    "runtime.timeout",
    "platform",
    null,
    { value: 30000 },
    "user-1",
    "update timeout",
  );

  assert.ok(eventBus.publishedEvents.some((event) => event.eventType === "config.version.created"));
  const changedEvent = eventBus.publishedEvents.find((event) => event.eventType === "config.changed");
  assert.ok(changedEvent);
  assert.equal(changedEvent?.payload["configPath"], "runtime.timeout");
  assert.equal(changedEvent?.payload["versionId"], snapshot.versionId);
});
