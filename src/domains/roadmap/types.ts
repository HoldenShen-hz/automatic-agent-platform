/**
 * Roadmap and Phase Delivery Type Definitions
 * Implements §33 Roadmap for phase delivery items
 */

export type RoadmapPhase =
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
  | "phase9f";

export type RoadmapStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "deferred";

export type SuccessCriterionMeasurementType = "boolean" | "percentage" | "count" | "duration_ms" | "custom";

export interface SuccessCriterionDefinition {
  readonly criterionId: string;
  readonly phase: RoadmapPhase;
  readonly metricKey: string;
  readonly title: string;
  readonly measurementType: SuccessCriterionMeasurementType;
  readonly threshold: number | boolean | string;
  readonly operator?: "gte" | "lte" | "eq" | "neq";
  readonly required: boolean;
}

export interface SuccessCriterionMeasurement {
  readonly criterionId: string;
  readonly metricKey: string;
  readonly measuredValue: number | boolean | string;
  readonly measuredAt: string;
  readonly source: string;
}

export interface SuccessCriterionEvaluation {
  readonly criterionId: string;
  readonly passed: boolean;
  readonly required: boolean;
  readonly metricKey: string;
  readonly threshold: number | boolean | string;
  readonly measuredValue: number | boolean | string | null;
  readonly operator: "gte" | "lte" | "eq" | "neq";
}

export interface PhaseGateDefinition {
  readonly phase: RoadmapPhase;
  readonly requiredItemIds: readonly string[];
  readonly requiredCriteriaIds: readonly string[];
  readonly blockOnDeferredItems: boolean;
}

export interface PhaseAdvanceDecision {
  readonly phase: RoadmapPhase;
  readonly nextPhase: RoadmapPhase | null;
  readonly allowed: boolean;
  readonly reasonCodes: readonly string[];
  readonly pendingItemIds: readonly string[];
  readonly failedCriteriaIds: readonly string[];
}

export interface RoadmapItem {
  readonly itemId: string;
  readonly title: string;
  readonly description: string;
  readonly phase: RoadmapPhase;
  readonly status: RoadmapStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
  readonly deferredReason?: string;
  readonly completionRecord?: CompletionRecord;
}

export interface CompletionRecord {
  readonly completedAt: string;
  readonly notes?: string;
  readonly artifacts?: readonly string[];
}

export interface Phase {
  readonly phaseId: string;
  readonly phase: RoadmapPhase;
  readonly name: string;
  readonly description: string;
  readonly status: RoadmapStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Deliverable {
  readonly deliverableId: string;
  readonly phaseId: string;
  readonly title: string;
  readonly description: string;
  readonly completedAt?: string;
}

export interface PhaseProgress {
  readonly phaseId: string;
  readonly totalDeliverables: number;
  readonly completedDeliverables: number;
  readonly completionPercentage: number;
}

export interface AddRoadmapItemRequest {
  readonly title: string;
  readonly description: string;
  readonly phase: RoadmapPhase;
}

export interface AddDeliverableRequest {
  readonly title: string;
  readonly description: string;
}
