/**
 * Roadmap Service
 * Tracks roadmap items across phases with status management
 * Implements §33 Roadmap for phase delivery items
 */
import { ValidationError } from "../../platform/contracts/errors.js";
import { nowIso } from "../../platform/contracts/types/ids.js";
import { SuccessCriteriaService } from "./success-criteria-service.js";
export const ARCHITECTURE_ROADMAP_TEMPLATE = [
    { phase: "phase8a", title: "Harness core loop", description: "Close VI-1/2/3 and ship the unified Harness protocol." },
    { phase: "phase8b", title: "Harness durable recovery", description: "Close VI-4/5/6 with durability, context assembly, and recovery." },
    { phase: "phase8c", title: "Harness governance and evaluation", description: "Close VI-7~VI-15 with guardrails, HITL, async, eval, and invariants." },
    { phase: "phase9a", title: "Vertical domains 9a", description: "Coding, data-engineering, knowledge-base, and user-operations." },
    { phase: "phase9b", title: "Vertical domains 9b", description: "Quant-trading, financial-services, ecommerce, and advertising." },
    { phase: "phase9c", title: "Vertical domains 9c", description: "Industry-research, academic-research, finance-accounting, and legal." },
    { phase: "phase9d", title: "Vertical domains 9d", description: "Customer-service, IT-operations, content-moderation, and live-streaming." },
    { phase: "phase9e", title: "Vertical domains 9e", description: "Healthcare, human-resources, supply-chain, and education." },
    { phase: "phase9f", title: "Vertical domains 9f", description: "Creative-production, game-dev, game-publishing, and marketing." },
];
export class RoadmapService {
    items = new Map();
    successCriteria = new SuccessCriteriaService();
    constructor(_options = {}) {
        // No external dependencies required for now
    }
    /**
     * Adds a new item to the roadmap
     */
    addRoadmapItem(request) {
        const itemId = `roadmap_${nowIso()}_${this.items.size}`;
        const now = nowIso();
        const item = {
            itemId,
            title: request.title,
            description: request.description,
            phase: request.phase,
            status: "pending",
            createdAt: now,
            updatedAt: now,
        };
        this.items.set(itemId, item);
        return item;
    }
    /**
     * Gets roadmap items, optionally filtered by phase
     */
    getRoadmap(phase) {
        const allItems = Array.from(this.items.values());
        if (phase === undefined) {
            return allItems.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        }
        return allItems
            .filter((item) => item.phase === phase)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    /**
     * Updates the status of a roadmap item
     */
    updateRoadmapItemStatus(itemId, status) {
        const item = this.getOrThrow(itemId);
        const updated = {
            ...item,
            status,
            updatedAt: nowIso(),
        };
        this.items.set(itemId, updated);
        return updated;
    }
    /**
     * Marks a roadmap item as complete with completion record
     */
    completeRoadmapItem(itemId, completionRecord) {
        const item = this.getOrThrow(itemId);
        const updated = {
            ...item,
            status: "completed",
            completedAt: completionRecord.completedAt,
            completionRecord,
            updatedAt: nowIso(),
        };
        this.items.set(itemId, updated);
        return updated;
    }
    /**
     * Defers a roadmap item with a reason
     */
    deferRoadmapItem(itemId, reason) {
        const item = this.getOrThrow(itemId);
        const updated = {
            ...item,
            status: "deferred",
            deferredReason: reason,
            updatedAt: nowIso(),
        };
        this.items.set(itemId, updated);
        return updated;
    }
    /**
     * Lists roadmap items filtered by status
     */
    listRoadmapItemsByStatus(status) {
        return Array.from(this.items.values())
            .filter((item) => item.status === status)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    registerSuccessCriterion(definition) {
        return this.successCriteria.registerCriterion(definition);
    }
    registerPhaseGate(gate) {
        return this.successCriteria.registerPhaseGate(gate);
    }
    recordSuccessMeasurement(measurement) {
        return this.successCriteria.recordMeasurement(measurement);
    }
    evaluatePhaseAdvance(phase) {
        const items = this.getRoadmap(phase);
        return this.successCriteria.evaluatePhaseAdvance(phase, items.filter((item) => item.status === "completed").map((item) => item.itemId), items.filter((item) => item.status === "deferred").map((item) => item.itemId));
    }
    seedArchitectureRoadmap() {
        const seeded = [];
        for (const template of ARCHITECTURE_ROADMAP_TEMPLATE) {
            const exists = this.getRoadmap(template.phase).some((item) => item.title === template.title);
            if (exists) {
                continue;
            }
            seeded.push(this.addRoadmapItem(template));
        }
        return seeded;
    }
    listArchitecturePhases() {
        return [...new Set(ARCHITECTURE_ROADMAP_TEMPLATE.map((item) => item.phase))];
    }
    getOrThrow(itemId) {
        const item = this.items.get(itemId);
        if (!item) {
            throw new ValidationError("roadmap.item_not_found", `Roadmap item ${itemId} not found.`, {
                category: "validation",
                source: "internal",
            });
        }
        return item;
    }
}
//# sourceMappingURL=roadmap-service.js.map