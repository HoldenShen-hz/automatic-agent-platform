import { beforeEach, describe, it } from "node:test";
import { expect } from "../../../helpers/node-expect.js";
import { PhaseDeliveryService } from "../../../../src/domains/roadmap/phase-delivery-service.js";

describe("PhaseDeliveryService", () => {
  let service: PhaseDeliveryService;

  beforeEach(() => {
    service = new PhaseDeliveryService();
  });

  describe("createPhase", () => {
    it("should create a new phase", () => {
      const phase = service.createPhase("phase1");
      expect(phase).toHaveProperty("phaseId");
      expect(phase.phase).toBe("phase1");
      expect(phase.name).toBe("Foundation");
      expect(phase.status).toBe("pending");
    });

    it("should throw when phase already exists", () => {
      service.createPhase("phase1");
      expect(() => service.createPhase("phase1")).toThrow();
    });

    it("should create all roadmap phases", () => {
      const phases: Array<
        | "phase1"
        | "phase2"
        | "phase3"
        | "phase4"
        | "phase5"
        | "phase6"
        | "phase7"
        | "phase8a"
        | "phase8b"
        | "phase8c"
        | "phase9a"
        | "phase9b"
        | "phase9c"
        | "phase9d"
        | "phase9e"
        | "phase9f"
      > = [
        "phase1",
        "phase2",
        "phase3",
        "phase4",
        "phase5",
        "phase6",
        "phase7",
        "phase8a",
        "phase8b",
        "phase8c",
        "phase9a",
        "phase9b",
        "phase9c",
        "phase9d",
        "phase9e",
        "phase9f",
      ];

      for (const phase of phases) {
        const created = service.createPhase(phase);
        expect(created.phase).toBe(phase);
      }
      expect(service.listPhases()).toHaveLength(16);
    });

    it("should set correct phase name for each phase", () => {
      const phase1 = service.createPhase("phase1");
      expect(phase1.name).toBe("Foundation");

      service = new PhaseDeliveryService();
      const phase9a = service.createPhase("phase9a");
      expect(phase9a.name).toBe("Vertical Domains Batch 9a");
    });
  });

  describe("addDeliverableToPhase", () => {
    it("should add deliverable to existing phase", () => {
      const phase = service.createPhase("phase1");
      const deliverable = service.addDeliverableToPhase(phase.phaseId, {
        title: "Deliverable 1",
        description: "Test deliverable",
      });
      expect(deliverable).toHaveProperty("deliverableId");
      expect(deliverable.title).toBe("Deliverable 1");
      expect(deliverable.phaseId).toBe(phase.phaseId);
    });

    it("should throw for non-existent phase", () => {
      expect(() =>
        service.addDeliverableToPhase("non_existent", {
          title: "Test",
          description: "Test",
        }),
      ).toThrow();
    });
  });

  describe("markDeliverableComplete", () => {
    it("should mark deliverable as complete", () => {
      const phase = service.createPhase("phase1");
      const deliverable = service.addDeliverableToPhase(phase.phaseId, {
        title: "Deliverable 1",
        description: "Test deliverable",
      });

      const updated = service.markDeliverableComplete(
        phase.phaseId,
        deliverable.deliverableId,
      );
      expect(updated.completedAt).toBeDefined();
    });

    it("should throw when deliverable not found", () => {
      const phase = service.createPhase("phase1");
      expect(() =>
        service.markDeliverableComplete(phase.phaseId, "non_existent"),
      ).toThrow();
    });

    it("should throw when deliverable belongs to different phase", () => {
      const phase1 = service.createPhase("phase1");
      const phase2 = service.createPhase("phase2");
      const deliverable = service.addDeliverableToPhase(phase1.phaseId, {
        title: "Deliverable 1",
        description: "Test",
      });

      expect(() =>
        service.markDeliverableComplete(
          phase2.phaseId,
          deliverable.deliverableId,
        ),
      ).toThrow();
    });
  });

  describe("getPhaseProgress", () => {
    it("should return zero progress for phase with no deliverables", () => {
      const phase = service.createPhase("phase1");
      const progress = service.getPhaseProgress(phase.phaseId);
      expect(progress.totalDeliverables).toBe(0);
      expect(progress.completedDeliverables).toBe(0);
      expect(progress.completionPercentage).toBe(0);
    });

    it("should calculate correct progress percentage", () => {
      const phase = service.createPhase("phase1");
      service.addDeliverableToPhase(phase.phaseId, {
        title: "D1",
        description: "D1",
      });
      service.addDeliverableToPhase(phase.phaseId, {
        title: "D2",
        description: "D2",
      });

      const d1 = service.addDeliverableToPhase(phase.phaseId, {
        title: "D3",
        description: "D3",
      });
      service.addDeliverableToPhase(phase.phaseId, {
        title: "D4",
        description: "D4",
      });

      service.markDeliverableComplete(phase.phaseId, d1.deliverableId);

      const progress = service.getPhaseProgress(phase.phaseId);
      expect(progress.totalDeliverables).toBe(4);
      expect(progress.completedDeliverables).toBe(1);
      expect(progress.completionPercentage).toBe(25);
    });

    it("should throw for non-existent phase", () => {
      expect(() => service.getPhaseProgress("non_existent")).toThrow();
    });
  });

  describe("listPhases", () => {
    it("should return empty array when no phases created", () => {
      expect(service.listPhases()).toEqual([]);
    });

    it("should return sorted phases by creation time", () => {
      service.createPhase("phase1");
      service.createPhase("phase2");
      service.createPhase("phase3");

      const phases = service.listPhases();
      expect(phases).toHaveLength(3);
      expect(phases[0]!.phase).toBe("phase1");
      expect(phases[1]!.phase).toBe("phase2");
      expect(phases[2]!.phase).toBe("phase3");
    });
  });
});
