import { nowIso } from "../../platform/contracts/types/ids.js";
import type {
  PhaseAdvanceDecision,
  PhaseGateDefinition,
  RoadmapPhase,
  SuccessCriterionDefinition,
  SuccessCriterionEvaluation,
  SuccessCriterionMeasurement,
} from "./types.js";

const PHASE_ORDER: readonly RoadmapPhase[] = ["phase1", "phase2", "phase3", "phase4"];

export class SuccessCriteriaService {
  private readonly definitions = new Map<string, SuccessCriterionDefinition>();
  private readonly measurements = new Map<string, SuccessCriterionMeasurement[]>();
  private readonly phaseGates = new Map<RoadmapPhase, PhaseGateDefinition>();

  public registerCriterion(definition: SuccessCriterionDefinition): SuccessCriterionDefinition {
    this.definitions.set(definition.criterionId, definition);
    return definition;
  }

  public registerPhaseGate(gate: PhaseGateDefinition): PhaseGateDefinition {
    this.phaseGates.set(gate.phase, gate);
    return gate;
  }

  public recordMeasurement(measurement: Omit<SuccessCriterionMeasurement, "measuredAt"> & { measuredAt?: string }): SuccessCriterionMeasurement {
    const record: SuccessCriterionMeasurement = {
      ...measurement,
      measuredAt: measurement.measuredAt ?? nowIso(),
    };
    this.measurements.set(record.criterionId, [...(this.measurements.get(record.criterionId) ?? []), record]);
    return record;
  }

  public evaluateCriterion(criterionId: string): SuccessCriterionEvaluation {
    const definition = this.requireDefinition(criterionId);
    const latest = this.getLatestMeasurement(criterionId);
    const operator = definition.operator ?? "gte";
    const measuredValue = latest?.measuredValue ?? null;
    return {
      criterionId: definition.criterionId,
      passed: latest != null && compareValues(measuredValue, definition.threshold, operator),
      required: definition.required,
      metricKey: definition.metricKey,
      threshold: definition.threshold,
      measuredValue,
      operator,
    };
  }

  public evaluatePhaseCriteria(phase: RoadmapPhase): SuccessCriterionEvaluation[] {
    return [...this.definitions.values()]
      .filter((item) => item.phase === phase)
      .map((item) => this.evaluateCriterion(item.criterionId));
  }

  public evaluatePhaseAdvance(
    phase: RoadmapPhase,
    completedItemIds: readonly string[],
    deferredItemIds: readonly string[] = [],
  ): PhaseAdvanceDecision {
    const gate = this.phaseGates.get(phase);
    const evaluations = this.evaluatePhaseCriteria(phase);
    const failedCriteriaIds = evaluations
      .filter((item) => item.required && !item.passed)
      .map((item) => item.criterionId);
    const pendingItemIds = (gate?.requiredItemIds ?? []).filter((itemId) => !completedItemIds.includes(itemId));
    const reasonCodes = [
      ...pendingItemIds.map((itemId) => `roadmap.pending_item:${itemId}`),
      ...failedCriteriaIds.map((criterionId) => `roadmap.failed_criterion:${criterionId}`),
    ];
    if (gate?.blockOnDeferredItems === true) {
      reasonCodes.push(...deferredItemIds.map((itemId) => `roadmap.deferred_item:${itemId}`));
    }
    const allowed = pendingItemIds.length === 0
      && failedCriteriaIds.length === 0
      && !(gate?.blockOnDeferredItems === true && deferredItemIds.length > 0);
    return {
      phase,
      nextPhase: allowed ? PHASE_ORDER[PHASE_ORDER.indexOf(phase) + 1] ?? null : null,
      allowed,
      reasonCodes,
      pendingItemIds,
      failedCriteriaIds,
    };
  }

  public listDefinitions(phase?: RoadmapPhase): SuccessCriterionDefinition[] {
    return [...this.definitions.values()].filter((item) => phase == null || item.phase === phase);
  }

  private requireDefinition(criterionId: string): SuccessCriterionDefinition {
    const definition = this.definitions.get(criterionId);
    if (definition == null) {
      throw new Error(`success_criteria.definition_not_found:${criterionId}`);
    }
    return definition;
  }

  private getLatestMeasurement(criterionId: string): SuccessCriterionMeasurement | null {
    const measurements = this.measurements.get(criterionId) ?? [];
    return [...measurements].sort((left, right) => right.measuredAt.localeCompare(left.measuredAt))[0] ?? null;
  }
}

function compareValues(
  measuredValue: number | boolean | string | null,
  threshold: number | boolean | string,
  operator: "gte" | "lte" | "eq" | "neq",
): boolean {
  if (measuredValue == null) {
    return false;
  }
  switch (operator) {
    case "eq":
      return measuredValue === threshold;
    case "neq":
      return measuredValue !== threshold;
    case "lte":
      return typeof measuredValue === "number" && typeof threshold === "number" && measuredValue <= threshold;
    case "gte":
    default:
      return typeof measuredValue === "number" && typeof threshold === "number" && measuredValue >= threshold;
  }
}
