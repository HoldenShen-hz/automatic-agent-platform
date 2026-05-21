import { describe, it, expect, beforeEach } from "node:test";
import { SuccessCriteriaService } from "../../../../../src/domains/roadmap/success-criteria-service.js";
import type {
  SuccessCriterionDefinition,
  PhaseGateDefinition,
  SuccessCriterionMeasurement,
} from "../../../../../src/domains/roadmap/types.js";

describe("SuccessCriteriaService", () => {
  let service: SuccessCriteriaService;

  beforeEach(() => {
    service = new SuccessCriteriaService();
  });

  describe("registerCriterion", () => {
    it("should register a success criterion", () => {
      const criterion: SuccessCriterionDefinition = {
        criterionId: "crit_1",
        phase: "phase1",
        metricKey: "accuracy",
        title: "Accuracy Criterion",
        measurementType: "percentage",
        threshold: 90,
        operator: "gte",
        required: true,
      };
      const registered = service.registerCriterion(criterion);
      expect(registered.criterionId).toBe("crit_1");
    });

    it("should return the registered criterion", () => {
      const criterion: SuccessCriterionDefinition = {
        criterionId: "crit_2",
        phase: "phase1",
        metricKey: "latency",
        title: "Latency Criterion",
        measurementType: "duration_ms",
        threshold: 100,
        required: false,
      };
      const result = service.registerCriterion(criterion);
      expect(result).toEqual(criterion);
    });
  });

  describe("registerPhaseGate", () => {
    it("should register a phase gate", () => {
      const gate: PhaseGateDefinition = {
        phase: "phase1",
        requiredItemIds: ["item_1", "item_2"],
        requiredCriteriaIds: ["crit_1"],
        blockOnDeferredItems: true,
      };
      const registered = service.registerPhaseGate(gate);
      expect(registered.phase).toBe("phase1");
      expect(registered.requiredItemIds).toHaveLength(2);
    });
  });

  describe("recordMeasurement", () => {
    it("should record a measurement with auto timestamp", () => {
      const measurement = service.recordMeasurement({
        criterionId: "crit_1",
        metricKey: "accuracy",
        measuredValue: 95,
        source: "test",
      });
      expect(measurement.measuredAt).toBeDefined();
      expect(measurement.criterionId).toBe("crit_1");
    });

    it("should record a measurement with provided timestamp", () => {
      const measurement = service.recordMeasurement({
        criterionId: "crit_1",
        metricKey: "accuracy",
        measuredValue: 95,
        source: "test",
        measuredAt: "2024-01-01T00:00:00.000Z",
      });
      expect(measurement.measuredAt).toBe("2024-01-01T00:00:00.000Z");
    });

    it("should store multiple measurements for same criterion", () => {
      service.recordMeasurement({
        criterionId: "crit_1",
        metricKey: "accuracy",
        measuredValue: 90,
        source: "test1",
      });
      service.recordMeasurement({
        criterionId: "crit_1",
        metricKey: "accuracy",
        measuredValue: 95,
        source: "test2",
      });
      const evaluations = service.evaluatePhaseCriteria("phase1");
      expect(evaluations).toHaveLength(1);
    });
  });

  describe("evaluateCriterion", () => {
    it("should evaluate criterion with gte operator", () => {
      service.registerCriterion({
        criterionId: "crit_1",
        phase: "phase1",
        metricKey: "accuracy",
        title: "Test",
        measurementType: "percentage",
        threshold: 90,
        operator: "gte",
        required: true,
      });
      service.recordMeasurement({
        criterionId: "crit_1",
        metricKey: "accuracy",
        measuredValue: 95,
        source: "test",
      });

      const evaluation = service.evaluateCriterion("crit_1");
      expect(evaluation.passed).toBe(true);
      expect(evaluation.measuredValue).toBe(95);
    });

    it("should fail criterion when below threshold", () => {
      service.registerCriterion({
        criterionId: "crit_1",
        phase: "phase1",
        metricKey: "accuracy",
        title: "Test",
        measurementType: "percentage",
        threshold: 90,
        operator: "gte",
        required: true,
      });
      service.recordMeasurement({
        criterionId: "crit_1",
        metricKey: "accuracy",
        measuredValue: 80,
        source: "test",
      });

      const evaluation = service.evaluateCriterion("crit_1");
      expect(evaluation.passed).toBe(false);
    });

    it("should evaluate criterion with lte operator", () => {
      service.registerCriterion({
        criterionId: "crit_1",
        phase: "phase1",
        metricKey: "latency",
        title: "Test",
        measurementType: "duration_ms",
        threshold: 100,
        operator: "lte",
        required: true,
      });
      service.recordMeasurement({
        criterionId: "crit_1",
        metricKey: "latency",
        measuredValue: 50,
        source: "test",
      });

      const evaluation = service.evaluateCriterion("crit_1");
      expect(evaluation.passed).toBe(true);
    });

    it("should evaluate criterion with eq operator", () => {
      service.registerCriterion({
        criterionId: "crit_bool",
        phase: "phase1",
        metricKey: "enabled",
        title: "Test",
        measurementType: "boolean",
        threshold: true,
        operator: "eq",
        required: true,
      });
      service.recordMeasurement({
        criterionId: "crit_bool",
        metricKey: "enabled",
        measuredValue: true,
        source: "test",
      });

      const evaluation = service.evaluateCriterion("crit_bool");
      expect(evaluation.passed).toBe(true);
    });

    it("should return false when no measurement recorded", () => {
      service.registerCriterion({
        criterionId: "crit_1",
        phase: "phase1",
        metricKey: "accuracy",
        title: "Test",
        measurementType: "percentage",
        threshold: 90,
        required: true,
      });

      const evaluation = service.evaluateCriterion("crit_1");
      expect(evaluation.passed).toBe(false);
      expect(evaluation.measuredValue).toBeNull();
    });

    it("should throw for unknown criterion", () => {
      expect(() => service.evaluateCriterion("unknown")).toThrow();
    });
  });

  describe("evaluatePhaseCriteria", () => {
    it("should evaluate all criteria for a phase", () => {
      service.registerCriterion({
        criterionId: "crit_1",
        phase: "phase1",
        metricKey: "accuracy",
        title: "Test 1",
        measurementType: "percentage",
        threshold: 90,
        required: true,
      });
      service.registerCriterion({
        criterionId: "crit_2",
        phase: "phase1",
        metricKey: "latency",
        title: "Test 2",
        measurementType: "duration_ms",
        threshold: 100,
        required: false,
      });

      const evaluations = service.evaluatePhaseCriteria("phase1");
      expect(evaluations).toHaveLength(2);
    });

    it("should return empty array for phase with no criteria", () => {
      const evaluations = service.evaluatePhaseCriteria("phase9f");
      expect(evaluations).toHaveLength(0);
    });
  });

  describe("evaluatePhaseAdvance", () => {
    it("should allow advance when all required items completed", () => {
      service.registerPhaseGate({
        phase: "phase1",
        requiredItemIds: ["item_1", "item_2"],
        requiredCriteriaIds: [],
        blockOnDeferredItems: false,
      });

      const decision = service.evaluatePhaseAdvance(
        "phase1",
        ["item_1", "item_2"],
        [],
      );
      expect(decision.allowed).toBe(true);
      expect(decision.nextPhase).toBe("phase2");
    });

    it("should block advance when items are pending", () => {
      service.registerPhaseGate({
        phase: "phase1",
        requiredItemIds: ["item_1", "item_2"],
        requiredCriteriaIds: [],
        blockOnDeferredItems: false,
      });

      const decision = service.evaluatePhaseAdvance(
        "phase1",
        ["item_1"],
        [],
      );
      expect(decision.allowed).toBe(false);
      expect(decision.pendingItemIds).toContain("item_2");
    });

    it("should block advance when deferred items blocked", () => {
      service.registerPhaseGate({
        phase: "phase1",
        requiredItemIds: [],
        requiredCriteriaIds: [],
        blockOnDeferredItems: true,
      });

      const decision = service.evaluatePhaseAdvance("phase1", [], ["deferred_item"]);
      expect(decision.allowed).toBe(false);
      expect(decision.reasonCodes.some((code) => code.includes("deferred"))).toBe(true);
    });

    it("should return null nextPhase when advance not allowed", () => {
      service.registerPhaseGate({
        phase: "phase1",
        requiredItemIds: ["item_1"],
        requiredCriteriaIds: [],
        blockOnDeferredItems: false,
      });

      const decision = service.evaluatePhaseAdvance("phase1", [], []);
      expect(decision.allowed).toBe(false);
      expect(decision.nextPhase).toBeNull();
    });

    it("should return last phase when trying to advance beyond", () => {
      const decision = service.evaluatePhaseAdvance("phase9f", ["item_1"], []);
      expect(decision.nextPhase).toBeNull();
    });

    it("should include reason codes for pending items", () => {
      service.registerPhaseGate({
        phase: "phase1",
        requiredItemIds: ["item_1"],
        requiredCriteriaIds: [],
        blockOnDeferredItems: false,
      });

      const decision = service.evaluatePhaseAdvance("phase1", [], []);
      expect(decision.reasonCodes.some((code) => code.includes("pending_item"))).toBe(true);
    });
  });

  describe("listDefinitions", () => {
    it("should list all definitions when no phase filter", () => {
      service.registerCriterion({
        criterionId: "crit_1",
        phase: "phase1",
        metricKey: "acc",
        title: "Test",
        measurementType: "percentage",
        threshold: 90,
        required: true,
      });
      service.registerCriterion({
        criterionId: "crit_2",
        phase: "phase2",
        metricKey: "lat",
        title: "Test",
        measurementType: "duration_ms",
        threshold: 100,
        required: false,
      });

      const definitions = service.listDefinitions();
      expect(definitions).toHaveLength(2);
    });

    it("should filter definitions by phase", () => {
      service.registerCriterion({
        criterionId: "crit_1",
        phase: "phase1",
        metricKey: "acc",
        title: "Test",
        measurementType: "percentage",
        threshold: 90,
        required: true,
      });
      service.registerCriterion({
        criterionId: "crit_2",
        phase: "phase2",
        metricKey: "lat",
        title: "Test",
        measurementType: "duration_ms",
        threshold: 100,
        required: false,
      });

      const phase1Defs = service.listDefinitions("phase1");
      expect(phase1Defs).toHaveLength(1);
      expect(phase1Defs[0]!.criterionId).toBe("crit_1");
    });
  });

  describe("compareValues function", () => {
    it("should handle gte comparison", () => {
      service.registerCriterion({
        criterionId: "crit_1",
        phase: "phase1",
        metricKey: "test",
        title: "Test",
        measurementType: "percentage",
        threshold: 50,
        operator: "gte",
        required: true,
      });
      service.recordMeasurement({
        criterionId: "crit_1",
        metricKey: "test",
        measuredValue: 75,
        source: "test",
      });
      const eval1 = service.evaluateCriterion("crit_1");
      expect(eval1.passed).toBe(true);
    });

    it("should handle eq comparison for strings", () => {
      service.registerCriterion({
        criterionId: "crit_str",
        phase: "phase1",
        metricKey: "status",
        title: "Test",
        measurementType: "custom",
        threshold: "active",
        operator: "eq",
        required: true,
      });
      service.recordMeasurement({
        criterionId: "crit_str",
        metricKey: "status",
        measuredValue: "active",
        source: "test",
      });
      const evaluation = service.evaluateCriterion("crit_str");
      expect(evaluation.passed).toBe(true);
    });

    it("should handle neq comparison", () => {
      service.registerCriterion({
        criterionId: "crit_neq",
        phase: "phase1",
        metricKey: "status",
        title: "Test",
        measurementType: "custom",
        threshold: "disabled",
        operator: "neq",
        required: true,
      });
      service.recordMeasurement({
        criterionId: "crit_neq",
        metricKey: "status",
        measuredValue: "active",
        source: "test",
      });
      const evaluation = service.evaluateCriterion("crit_neq");
      expect(evaluation.passed).toBe(true);
    });
  });
});