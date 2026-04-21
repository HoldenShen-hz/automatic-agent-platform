/**
 * Phase Delivery Service
 * Tracks phase deliverables and progress
 * Implements §33 Roadmap for phase delivery items
 */
import { ValidationError } from "../../platform/contracts/errors.js";
import { nowIso } from "../../platform/contracts/types/ids.js";
export class PhaseDeliveryService {
    phases = new Map();
    deliverables = new Map();
    constructor(_options = {}) {
        // No external dependencies required for now
    }
    /**
     * Creates a new phase
     */
    createPhase(phase) {
        const existingPhase = this.findByPhaseValue(phase);
        if (existingPhase) {
            throw new ValidationError("phase_delivery.phase_exists", `Phase ${phase} already exists.`, {
                category: "validation",
                source: "internal",
            });
        }
        const phaseNames = {
            phase1: "Foundation",
            phase2: "Growth",
            phase3: "Maturity",
            phase4: "Enterprise",
        };
        const phaseDescriptions = {
            phase1: "Core execution, state management",
            phase2: "Multi-region, scaling",
            phase3: "Full features, HA/DR",
            phase4: "Advanced governance, compliance",
        };
        const phaseId = `phase_${phase}`;
        const now = nowIso();
        const newPhase = {
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
    addDeliverableToPhase(phaseId, request) {
        const phase = this.getPhaseOrThrow(phaseId);
        const deliverableId = `deliverable_${nowIso()}_${this.deliverables.size}`;
        const deliverable = {
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
    markDeliverableComplete(phaseId, deliverableId) {
        const phase = this.getPhaseOrThrow(phaseId);
        const deliverable = this.getDeliverableOrThrow(deliverableId);
        if (deliverable.phaseId !== phase.phaseId) {
            throw new ValidationError("phase_delivery.deliverable_phase_mismatch", `Deliverable ${deliverableId} does not belong to phase ${phaseId}.`, { category: "validation", source: "internal" });
        }
        const updated = {
            ...deliverable,
            completedAt: nowIso(),
        };
        this.deliverables.set(deliverableId, updated);
        return updated;
    }
    /**
     * Gets completion progress for a phase
     */
    getPhaseProgress(phaseId) {
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
    listPhases() {
        return Array.from(this.phases.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    listDeliverablesForPhase(phaseId) {
        return Array.from(this.deliverables.values()).filter((d) => d.phaseId === phaseId);
    }
    getPhaseOrThrow(phaseId) {
        const phase = this.phases.get(phaseId);
        if (!phase) {
            throw new ValidationError("phase_delivery.phase_not_found", `Phase ${phaseId} not found.`, {
                category: "validation",
                source: "internal",
            });
        }
        return phase;
    }
    getDeliverableOrThrow(deliverableId) {
        const deliverable = this.deliverables.get(deliverableId);
        if (!deliverable) {
            throw new ValidationError("phase_delivery.deliverable_not_found", `Deliverable ${deliverableId} not found.`, { category: "validation", source: "internal" });
        }
        return deliverable;
    }
    findByPhaseValue(phase) {
        return Array.from(this.phases.values()).find((p) => p.phase === phase);
    }
}
//# sourceMappingURL=phase-delivery-service.js.map