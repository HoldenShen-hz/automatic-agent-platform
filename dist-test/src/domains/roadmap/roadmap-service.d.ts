/**
 * Roadmap Service
 * Tracks roadmap items across phases with status management
 * Implements §33 Roadmap for phase delivery items
 */
import { type AddRoadmapItemRequest, type CompletionRecord, type PhaseAdvanceDecision, type PhaseGateDefinition, type RoadmapItem, type RoadmapPhase, type RoadmapStatus, type SuccessCriterionDefinition, type SuccessCriterionMeasurement } from "./types.js";
export interface ArchitectureRoadmapTemplateItem {
    readonly phase: RoadmapPhase;
    readonly title: string;
    readonly description: string;
}
export declare const ARCHITECTURE_ROADMAP_TEMPLATE: readonly ArchitectureRoadmapTemplateItem[];
export interface RoadmapServiceOptions {
    readonly eventPublisher?: null;
}
export declare class RoadmapService {
    private readonly items;
    private readonly successCriteria;
    constructor(_options?: RoadmapServiceOptions);
    /**
     * Adds a new item to the roadmap
     */
    addRoadmapItem(request: AddRoadmapItemRequest): RoadmapItem;
    /**
     * Gets roadmap items, optionally filtered by phase
     */
    getRoadmap(phase?: RoadmapPhase): RoadmapItem[];
    /**
     * Updates the status of a roadmap item
     */
    updateRoadmapItemStatus(itemId: string, status: RoadmapStatus): RoadmapItem;
    /**
     * Marks a roadmap item as complete with completion record
     */
    completeRoadmapItem(itemId: string, completionRecord: CompletionRecord): RoadmapItem;
    /**
     * Defers a roadmap item with a reason
     */
    deferRoadmapItem(itemId: string, reason: string): RoadmapItem;
    /**
     * Lists roadmap items filtered by status
     */
    listRoadmapItemsByStatus(status: RoadmapStatus): RoadmapItem[];
    registerSuccessCriterion(definition: SuccessCriterionDefinition): SuccessCriterionDefinition;
    registerPhaseGate(gate: PhaseGateDefinition): PhaseGateDefinition;
    recordSuccessMeasurement(measurement: Omit<SuccessCriterionMeasurement, "measuredAt"> & {
        measuredAt?: string;
    }): SuccessCriterionMeasurement;
    evaluatePhaseAdvance(phase: RoadmapPhase): PhaseAdvanceDecision;
    seedArchitectureRoadmap(): readonly RoadmapItem[];
    listArchitecturePhases(): readonly RoadmapPhase[];
    private getOrThrow;
}
