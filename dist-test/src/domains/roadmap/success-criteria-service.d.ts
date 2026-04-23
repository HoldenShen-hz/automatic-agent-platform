import type { PhaseAdvanceDecision, PhaseGateDefinition, RoadmapPhase, SuccessCriterionDefinition, SuccessCriterionEvaluation, SuccessCriterionMeasurement } from "./types.js";
export declare class SuccessCriteriaService {
    private readonly definitions;
    private readonly measurements;
    private readonly phaseGates;
    registerCriterion(definition: SuccessCriterionDefinition): SuccessCriterionDefinition;
    registerPhaseGate(gate: PhaseGateDefinition): PhaseGateDefinition;
    recordMeasurement(measurement: Omit<SuccessCriterionMeasurement, "measuredAt"> & {
        measuredAt?: string;
    }): SuccessCriterionMeasurement;
    evaluateCriterion(criterionId: string): SuccessCriterionEvaluation;
    evaluatePhaseCriteria(phase: RoadmapPhase): SuccessCriterionEvaluation[];
    evaluatePhaseAdvance(phase: RoadmapPhase, completedItemIds: readonly string[], deferredItemIds?: readonly string[]): PhaseAdvanceDecision;
    listDefinitions(phase?: RoadmapPhase): SuccessCriterionDefinition[];
    private requireDefinition;
    private getLatestMeasurement;
}
