/**
 * Roadmap and Phase Delivery Type Definitions
 * Implements §33 Roadmap for phase delivery items
 */

export type RoadmapPhase = "phase1" | "phase2" | "phase3" | "phase4";

export type RoadmapStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "deferred";

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
