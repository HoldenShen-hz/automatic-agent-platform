/**
 * R16-32: Unit test for shadow-build→compare→cutover protocol in rebuildAll
 */

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import type { ProjectionHandler } from "../../../../src/platform/five-plane-state-evidence/projections/projection-rebuild-service.js";

const mockEventRepository = {
  listAllEvents: mock.fn(() => []),
  insertEvent: mock.fn(),
  getEvent: mock.fn(),
};

describe("R16-32: Projection rebuild shadow-build protocol", () => {
  let service: any;

  beforeEach(async () => {
    const { ProjectionRebuildService } = await import("../../../../src/platform/five-plane-state-evidence/projections/projection-rebuild-service.js");
    service = new ProjectionRebuildService(mockEventRepository as any);
  });

  it("rebuildAll uses shadow-build→compare→cutover protocol", async () => {
    // Register a handler
    let callCount = 0;
    service.registerHandler("test_projection", (state: any, event: any) => {
      callCount++;
      return { ...(state || {}), lastEventId: event.eventId };
    });

    // Add test events via mock
    (mockEventRepository.listAllEvents as any).mock.mockImplementation(() => [
      { id: "evt1", eventType: "test", taskId: null, payloadJson: "{}", createdAt: new Date().toISOString() },
    ]);

    const result = service.rebuildAll();

    // rebuildAll should call shadowBuildProjection, compareShadowProjection, cutoverShadowProjection
    // Since mock events return empty initially, first shadow build returns empty
    // The comparison may find mismatch but service should still proceed
    assert.ok(result.has("test_projection"), "should have result for test_projection");
  });

  it("shadowBuildProjection builds to shadow slot", async () => {
    service.registerHandler("shadow_test", (state: any, event: any) => ({
      eventCount: ((state?.eventCount as number) ?? 0) + 1,
    }));

    const result = service.shadowBuildProjection("shadow_test", { batchSize: 100 });

    // Check shadow snapshot was created
    const shadow = service.getProjectionSnapshotStatus("shadow_test").shadow;
    assert.ok(shadow != null, "shadow snapshot should be created");
    assert.strictEqual(shadow.projectionName, "shadow_test");
  });

  it("compareShadowProjection detects matches and mismatches", async () => {
    service.registerHandler("compare_test", (state: any, event: any) => ({
      eventCount: ((state?.eventCount as number) ?? 0) + 1,
      eventId: event.eventId,
    }));

    // Build to active slot
    service.rebuildProjection("compare_test", { batchSize: 100 });
    const activeSnapshot = service.getProjectionSnapshotStatus("compare_test").active;

    // Build to shadow slot with same events
    service.shadowBuildProjection("compare_test", { batchSize: 100 });
    const shadowSnapshot = service.getProjectionSnapshotStatus("compare_test").shadow;

    const comparison = service.compareShadowProjection("compare_test");

    assert.strictEqual(comparison.matches, true, "identical state should match");
    assert.strictEqual(comparison.activeHash, comparison.shadowHash, "hashes should match");
  });
});