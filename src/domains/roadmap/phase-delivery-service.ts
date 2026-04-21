/**
 * Phase Delivery Service
 * Tracks phase deliverables and progress
 * Implements §33 Roadmap for phase delivery items
 */

import { ValidationError } from "../../platform/contracts/errors.js";
import { nowIso } from "../../platform/contracts/types/ids.js";
import type { AddDeliverableRequest, Deliverable, Phase, PhaseProgress, RoadmapPhase } from "./types.js";

export interface PhaseDeliveryServiceOptions {
  readonly eventPublisher?: null;
}

export class PhaseDeliveryService {
  private readonly phases = new Map<string, Phase>();
  private readonly deliverables = new Map<string, Deliverable>();

  public constructor(_options: PhaseDeliveryServiceOptions = {}) {
    // No external dependencies required for now
  }

  /**
   * Creates a new phase
   */
  public createPhase(phase: RoadmapPhase): Phase {
    const existingPhase = this.findByPhaseValue(phase);
    if (existingPhase) {
      throw new ValidationError("phase_delivery.phase_exists", `Phase ${phase} already exists.`, {
        category: "validation",
        source: "internal",
      });
    }

    const phaseNames: Record<RoadmapPhase, string> = {
      phase1: "Foundation",
      phase2: "Growth",
      phase3: "Maturity",
      phase4: "Enterprise",
    };

    const phaseDescriptions: Record<RoadmapPhase, string> = {
      phase1: "Core execution, state management",
      phase2: "Multi-region, scaling",
      phase3: "Full features, HA/DR",
      phase4: "Advanced governance, compliance",
    };

    const phaseId = `phase_${phase}`;
    const now = nowIso();
    const newPhase: Phase = {
      phaseId,
      phase,
      name: phaseNames[phase],
      description: phaseDescriptions[phase],
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    this.phases.set(phaseId, newPhase);
    return newPhase;
  }

  /**
   * Adds a deliverable to a phase
   */
  public addDeliverableToPhase(phaseId: string, request: AddDeliverableRequest): Deliverable {
    const phase = this.getPhaseOrThrow(phaseId);
    const deliverableId = `deliverable_${nowIso()}_${this.deliverables.size}`;
    const deliverable: Deliverable = {
      deliverableId,
      phaseId: phase.phaseId,
      title: request.title,
      description: request.description,
    };
    this.deliverables.set(deliverableId, deliverable);
    return deliverable;
  }

  /**
   * Marks a deliverable as complete
   */
  public markDeliverableComplete(phaseId: string, deliverableId: string): Deliverable {
    const phase = this.getPhaseOrThrow(phaseId);
    const deliverable = this.getDeliverableOrThrow(deliverableId);

    if (deliverable.phaseId !== phase.phaseId) {
      throw new ValidationError(
        "phase_delivery.deliverable_phase_mismatch",
        `Deliverable ${deliverableId} does not belong to phase ${phaseId}.`,
        { category: "validation", source: "internal" },
      );
    }

    const updated: Deliverable = {
      ...deliverable,
      completedAt: nowIso(),
    };
    this.deliverables.set(deliverableId, updated);
    return updated;
  }

  /**
   * Gets completion progress for a phase
   */
  public getPhaseProgress(phaseId: string): PhaseProgress {
    const phase = this.getPhaseOrThrow(phaseId);
    const phaseDeliverables = this.listDeliverablesForPhase(phaseId);
    const completedCount = phaseDeliverables.filter((d) => d.completedAt !== undefined).length;
    const total = phaseDeliverables.length;
    const percentage = total === 0 ? 0 : Math.round((completedCount / total) * 100);

    return {
      phaseId,
      totalDeliverables: total,
      completedDeliverables: completedCount,
      completionPercentage: percentage,
    };
  }

  /**
   * Lists all phases
   */
  public listPhases(): Phase[] {
    return Array.from(this.phases.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  private listDeliverablesForPhase(phaseId: string): Deliverable[] {
    return Array.from(this.deliverables.values()).filter((d) => d.phaseId === phaseId);
  }

  private getPhaseOrThrow(phaseId: string): Phase {
    const phase = this.phases.get(phaseId);
    if (!phase) {
      throw new ValidationError("phase_delivery.phase_not_found", `Phase ${phaseId} not found.`, {
        category: "validation",
        source: "internal",
      });
    }
    return phase;
  }

  private getDeliverableOrThrow(deliverableId: string): Deliverable {
    const deliverable = this.deliverables.get(deliverableId);
    if (!deliverable) {
      throw new ValidationError(
        "phase_delivery.deliverable_not_found",
        `Deliverable ${deliverableId} not found.`,
        { category: "validation", source: "internal" },
      );
    }
    return deliverable;
  }

  private findByPhaseValue(phase: RoadmapPhase): Phase | undefined {
    return Array.from(this.phases.values()).find((p) => p.phase === phase);
  }
}
