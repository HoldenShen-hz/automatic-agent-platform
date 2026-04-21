/**
 * Roadmap Service
 * Tracks roadmap items across phases with status management
 * Implements §33 Roadmap for phase delivery items
 */
import { ValidationError } from "../../platform/contracts/errors.js";
import { nowIso } from "../../platform/contracts/types/ids.js";
export class RoadmapService {
    items = new Map();
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