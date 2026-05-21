import { describe, it, expect, beforeEach } from "node:test";
import { RoadmapService } from "../../../../../src/domains/roadmap/roadmap-service.js";
import type { AddRoadmapItemRequest } from "../../../../../src/domains/roadmap/types.js";

describe("RoadmapService", () => {
  let service: RoadmapService;

  beforeEach(() => {
    service = new RoadmapService();
  });

  describe("addRoadmapItem", () => {
    it("should add a new roadmap item", () => {
      const request: AddRoadmapItemRequest = {
        title: "Test Item",
        description: "Test description",
        phase: "phase1",
      };
      const item = service.addRoadmapItem(request);
      expect(item.itemId).toBeDefined();
      expect(item.title).toBe("Test Item");
      expect(item.phase).toBe("phase1");
      expect(item.status).toBe("pending");
    });

    it("should set createdAt and updatedAt timestamps", () => {
      const request: AddRoadmapItemRequest = {
        title: "Test",
        description: "Test",
        phase: "phase1",
      };
      const item = service.addRoadmapItem(request);
      expect(item.createdAt).toBeDefined();
      expect(item.updatedAt).toBeDefined();
    });
  });

  describe("getRoadmap", () => {
    it("should return all items when no phase filter", () => {
      service.addRoadmapItem({ title: "Item 1", description: "D1", phase: "phase1" });
      service.addRoadmapItem({ title: "Item 2", description: "D2", phase: "phase2" });

      const roadmap = service.getRoadmap();
      expect(roadmap).toHaveLength(2);
    });

    it("should filter by phase", () => {
      service.addRoadmapItem({ title: "Item 1", description: "D1", phase: "phase1" });
      service.addRoadmapItem({ title: "Item 2", description: "D2", phase: "phase2" });
      service.addRoadmapItem({ title: "Item 3", description: "D3", phase: "phase1" });

      const phase1Items = service.getRoadmap("phase1");
      expect(phase1Items).toHaveLength(2);
      expect(phase1Items.every((item) => item.phase === "phase1")).toBe(true);
    });

    it("should return sorted items by createdAt", () => {
      service.addRoadmapItem({ title: "First", description: "D", phase: "phase1" });
      service.addRoadmapItem({ title: "Second", description: "D", phase: "phase1" });

      const roadmap = service.getRoadmap();
      expect(roadmap[0]!.title).toBe("First");
      expect(roadmap[1]!.title).toBe("Second");
    });
  });

  describe("updateRoadmapItemStatus", () => {
    it("should update item status", () => {
      const item = service.addRoadmapItem({
        title: "Test",
        description: "Test",
        phase: "phase1",
      });

      const updated = service.updateRoadmapItemStatus(item.itemId, "in_progress");
      expect(updated.status).toBe("in_progress");
      expect(updated.updatedAt).not.toBe(item.updatedAt);
    });

    it("should throw for non-existent item", () => {
      expect(() => service.updateRoadmapItemStatus("non_existent", "completed")).toThrow();
    });
  });

  describe("completeRoadmapItem", () => {
    it("should mark item as completed with record", () => {
      const item = service.addRoadmapItem({
        title: "Test",
        description: "Test",
        phase: "phase1",
      });

      const completed = service.completeRoadmapItem(item.itemId, {
        completedAt: "2024-01-01T00:00:00.000Z",
        notes: "Completed successfully",
      });

      expect(completed.status).toBe("completed");
      expect(completed.completedAt).toBe("2024-01-01T00:00:00.000Z");
      expect(completed.completionRecord?.notes).toBe("Completed successfully");
    });

    it("should throw for non-existent item", () => {
      expect(() => service.completeRoadmapItem("non_existent", {
        completedAt: "2024-01-01T00:00:00.000Z",
      })).toThrow();
    });
  });

  describe("deferRoadmapItem", () => {
    it("should defer item with reason", () => {
      const item = service.addRoadmapItem({
        title: "Test",
        description: "Test",
        phase: "phase1",
      });

      const deferred = service.deferRoadmapItem(item.itemId, "Resource constraints");
      expect(deferred.status).toBe("deferred");
      expect(deferred.deferredReason).toBe("Resource constraints");
    });

    it("should throw for non-existent item", () => {
      expect(() => service.deferRoadmapItem("non_existent", "Reason")).toThrow();
    });
  });

  describe("listRoadmapItemsByStatus", () => {
    it("should filter items by status", () => {
      const item1 = service.addRoadmapItem({ title: "1", description: "D", phase: "phase1" });
      const item2 = service.addRoadmapItem({ title: "2", description: "D", phase: "phase1" });

      service.updateRoadmapItemStatus(item1.itemId, "completed");

      const pending = service.listRoadmapItemsByStatus("pending");
      const completed = service.listRoadmapItemsByStatus("completed");

      expect(pending).toHaveLength(1);
      expect(completed).toHaveLength(1);
    });
  });

  describe("seedArchitectureRoadmap", () => {
    it("should seed all phases from architecture template", () => {
      const seeded = service.seedArchitectureRoadmap();
      expect(seeded.length).toBeGreaterThan(0);
    });

    it("should mark completed phases as completed", () => {
      const seeded = service.seedArchitectureRoadmap();
      const phase1Items = seeded.filter((item) => item.phase === "phase1");
      // Phase 1-7 are marked as completed in template
      expect(phase1Items.every((item) => item.status === "completed")).toBe(true);
    });

    it("should not duplicate items on multiple seeds", () => {
      service.seedArchitectureRoadmap();
      const firstCount = service.getRoadmap().length;

      service.seedArchitectureRoadmap();
      const secondCount = service.getRoadmap().length;

      expect(firstCount).toBe(secondCount);
    });
  });

  describe("listArchitecturePhases", () => {
    it("should return unique phases from template", () => {
      service.seedArchitectureRoadmap();
      const phases = service.listArchitecturePhases();
      expect(phases).toContain("phase1");
      expect(phases).toContain("phase8a");
      expect(phases).toContain("phase9f");
    });
  });

  describe("evaluatePhaseAdvance", () => {
    it("should evaluate phase advance decision", () => {
      service.seedArchitectureRoadmap();
      const decision = service.evaluatePhaseAdvance("phase1");
      expect(decision).toHaveProperty("phase");
      expect(decision).toHaveProperty("allowed");
      expect(decision).toHaveProperty("reasonCodes");
    });
  });

  describe("success criteria integration", () => {
    it("should register success criterion", () => {
      const criterion = service.registerSuccessCriterion({
        criterionId: "crit_1",
        phase: "phase1",
        metricKey: "test_metric",
        title: "Test Criterion",
        measurementType: "percentage",
        threshold: 90,
        operator: "gte",
        required: true,
      });
      expect(criterion.criterionId).toBe("crit_1");
    });

    it("should register phase gate", () => {
      const gate = service.registerPhaseGate({
        phase: "phase1",
        requiredItemIds: ["item_1"],
        requiredCriteriaIds: ["crit_1"],
        blockOnDeferredItems: false,
      });
      expect(gate.phase).toBe("phase1");
    });

    it("should record success measurement", () => {
      const measurement = service.recordSuccessMeasurement({
        criterionId: "crit_1",
        metricKey: "test_metric",
        measuredValue: 95,
        source: "test",
      });
      expect(measurement.criterionId).toBe("crit_1");
      expect(measurement.measuredValue).toBe(95);
    });
  });
});