/**
 * Roadmap Service
 * Tracks roadmap items across phases with status management
 * Implements §33 Roadmap for phase delivery items
 */
import { type AddRoadmapItemRequest, type CompletionRecord, type RoadmapItem, type RoadmapPhase, type RoadmapStatus } from "./types.js";
export interface RoadmapServiceOptions {
    readonly eventPublisher?: null;
}
export declare class RoadmapService {
    private readonly items;
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
    private getOrThrow;
}
