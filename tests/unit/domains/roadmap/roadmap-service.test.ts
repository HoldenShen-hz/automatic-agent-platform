import assert from "node:assert/strict";
import test from "node:test";

import { RoadmapService } from "../../../../src/domains/roadmap/roadmap-service.js";
import type { RoadmapPhase, RoadmapStatus } from "../../../../src/domains/roadmap/types.js";

test("RoadmapService addRoadmapItem creates item with pending status", () => {
  const service = new RoadmapService();
  const item = service.addRoadmapItem({
    title: "Core execution engine",
    description: "Implement core task execution engine",
    phase: "phase1",
  });

  assert.ok(item.itemId.startsWith("roadmap_"));
  assert.equal(item.title, "Core execution engine");
  assert.equal(item.phase, "phase1");
  assert.equal(item.status, "pending");
  assert.ok(item.createdAt);
  assert.ok(item.updatedAt);
});

test("RoadmapService getRoadmap returns all items when no phase filter", () => {
  const service = new RoadmapService();
  service.addRoadmapItem({ title: "Item 1", description: "Desc 1", phase: "phase1" });
  service.addRoadmapItem({ title: "Item 2", description: "Desc 2", phase: "phase2" });
  service.addRoadmapItem({ title: "Item 3", description: "Desc 3", phase: "phase1" });

  const items = service.getRoadmap();
  assert.equal(items.length, 3);
});

test("RoadmapService getRoadmap filters by phase", () => {
  const service = new RoadmapService();
  service.addRoadmapItem({ title: "Foundation Item", description: "Desc", phase: "phase1" });
  service.addRoadmapItem({ title: "Growth Item", description: "Desc", phase: "phase2" });
  service.addRoadmapItem({ title: "Another Foundation", description: "Desc", phase: "phase1" });

  const phase1Items = service.getRoadmap("phase1");
  assert.equal(phase1Items.length, 2);
  assert.ok(phase1Items.every((item) => item.phase === "phase1"));

  const phase2Items = service.getRoadmap("phase2");
  assert.equal(phase2Items.length, 1);
  assert.equal(phase2Items[0]!.title, "Growth Item");
});

test("RoadmapService updateRoadmapItemStatus updates status", () => {
  const service = new RoadmapService();
  const item = service.addRoadmapItem({ title: "Test", description: "Test", phase: "phase1" });

  const updated = service.updateRoadmapItemStatus(item.itemId, "in_progress");
  assert.equal(updated.status, "in_progress");
  assert.ok(updated.updatedAt >= item.createdAt);

  // Verify persisted
  const retrieved = service.getRoadmap()[0]!;
  assert.equal(retrieved.status, "in_progress");
});

test("RoadmapService completeRoadmapItem marks as completed", () => {
  const service = new RoadmapService();
  const item = service.addRoadmapItem({ title: "Test", description: "Test", phase: "phase1" });

  const completed = service.completeRoadmapItem(item.itemId, {
    completedAt: "2026-04-21T10:00:00Z",
    notes: "Delivered successfully",
    artifacts: ["artifact1", "artifact2"],
  });

  assert.equal(completed.status, "completed");
  assert.equal(completed.completedAt, "2026-04-21T10:00:00Z");
  assert.equal(completed.completionRecord?.notes, "Delivered successfully");
  assert.deepEqual(completed.completionRecord?.artifacts, ["artifact1", "artifact2"]);
});

test("RoadmapService deferRoadmapItem marks as deferred with reason", () => {
  const service = new RoadmapService();
  const item = service.addRoadmapItem({ title: "Test", description: "Test", phase: "phase2" });

  const deferred = service.deferRoadmapItem(item.itemId, "Waiting for dependency");

  assert.equal(deferred.status, "deferred");
  assert.equal(deferred.deferredReason, "Waiting for dependency");
});

test("RoadmapService listRoadmapItemsByStatus filters correctly", () => {
  const service = new RoadmapService();
  const item1 = service.addRoadmapItem({ title: "Pending 1", description: "D", phase: "phase1" });
  const item2 = service.addRoadmapItem({ title: "Pending 2", description: "D", phase: "phase1" });
  const item3 = service.addRoadmapItem({ title: "In Progress", description: "D", phase: "phase2" });

  service.updateRoadmapItemStatus(item3.itemId, "in_progress");

  const pendingItems = service.listRoadmapItemsByStatus("pending");
  assert.equal(pendingItems.length, 2);
  assert.ok(pendingItems.every((item) => item.status === "pending"));

  const inProgressItems = service.listRoadmapItemsByStatus("in_progress");
  assert.equal(inProgressItems.length, 1);
  assert.equal(inProgressItems[0]!.itemId, item3.itemId);

  const completedItems = service.listRoadmapItemsByStatus("completed");
  assert.equal(completedItems.length, 0);
});

test("RoadmapService getRoadmap returns items sorted by createdAt", () => {
  const service = new RoadmapService();
  const item1 = service.addRoadmapItem({ title: "First", description: "D", phase: "phase1" });
  const item2 = service.addRoadmapItem({ title: "Second", description: "D", phase: "phase1" });
  const item3 = service.addRoadmapItem({ title: "Third", description: "D", phase: "phase1" });

  const items = service.getRoadmap();
  assert.equal(items[0]!.itemId, item1.itemId);
  assert.equal(items[1]!.itemId, item2.itemId);
  assert.equal(items[2]!.itemId, item3.itemId);
});

test("RoadmapService throws ValidationError for non-existent item", () => {
  const service = new RoadmapService();

  assert.throws(
    () => service.updateRoadmapItemStatus("non_existent", "in_progress"),
    (err: unknown) => {
      if (err instanceof Error && "code" in err) {
        return (err as { code: string }).code === "roadmap.item_not_found";
      }
      return false;
    },
  );

  assert.throws(
    () => service.completeRoadmapItem("non_existent", { completedAt: nowUtc() }),
    (err: unknown) => {
      if (err instanceof Error && "code" in err) {
        return (err as { code: string }).code === "roadmap.item_not_found";
      }
      return false;
    },
  );

  assert.throws(
    () => service.deferRoadmapItem("non_existent", "reason"),
    (err: unknown) => {
      if (err instanceof Error && "code" in err) {
        return (err as { code: string }).code === "roadmap.item_not_found";
      }
      return false;
    },
  );
});

function nowUtc(): string {
  return new Date().toISOString();
}
