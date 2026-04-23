/**
 * Phase Delivery Service
 * Tracks phase deliverables and progress
 * Implements §33 Roadmap for phase delivery items
 */
import type { AddDeliverableRequest, Deliverable, Phase, PhaseProgress, RoadmapPhase } from "./types.js";
export interface PhaseDeliveryServiceOptions {
    readonly eventPublisher?: null;
}
export declare class PhaseDeliveryService {
    private readonly phases;
    private readonly deliverables;
    constructor(_options?: PhaseDeliveryServiceOptions);
    /**
     * Creates a new phase
     */
    createPhase(phase: RoadmapPhase): Phase;
    /**
     * Adds a deliverable to a phase
     */
    addDeliverableToPhase(phaseId: string, request: AddDeliverableRequest): Deliverable;
    /**
     * Marks a deliverable as complete
     */
    markDeliverableComplete(phaseId: string, deliverableId: string): Deliverable;
    /**
     * Gets completion progress for a phase
     */
    getPhaseProgress(phaseId: string): PhaseProgress;
    /**
     * Lists all phases
     */
    listPhases(): Phase[];
    private listDeliverablesForPhase;
    private getPhaseOrThrow;
    private getDeliverableOrThrow;
    private findByPhaseValue;
}
