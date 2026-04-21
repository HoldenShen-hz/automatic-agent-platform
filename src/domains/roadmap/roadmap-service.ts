/**
 * Roadmap Service
 * Tracks roadmap items across phases with status management
 * Implements §33 Roadmap for phase delivery items
 */

import { ValidationError } from "../../platform/contracts/errors.js";
import { nowIso } from "../../platform/contracts/types/ids.js";
import {
  type AddRoadmapItemRequest,
  type CompletionRecord,
  type RoadmapItem,
  type RoadmapPhase,
  type RoadmapStatus,
} from "./types.js";

export interface RoadmapServiceOptions {
  readonly eventPublisher?: null;
}

export class RoadmapService {
  private readonly items = new Map<string, RoadmapItem>();

  public constructor(_options: RoadmapServiceOptions = {}) {
    // No external dependencies required for now
  }

  /**
   * Adds a new item to the roadmap
   */
  public addRoadmapItem(request: AddRoadmapItemRequest): RoadmapItem {
    const itemId = `roadmap_${nowIso()}_${this.items.size}`;
    const now = nowIso();
    const item: RoadmapItem = {
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
  public getRoadmap(phase?: RoadmapPhase): RoadmapItem[] {
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
  public updateRoadmapItemStatus(itemId: string, status: RoadmapStatus): RoadmapItem {
    const item = this.getOrThrow(itemId);
    const updated: RoadmapItem = {
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
  public completeRoadmapItem(itemId: string, completionRecord: CompletionRecord): RoadmapItem {
    const item = this.getOrThrow(itemId);
    const updated: RoadmapItem = {
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
  public deferRoadmapItem(itemId: string, reason: string): RoadmapItem {
    const item = this.getOrThrow(itemId);
    const updated: RoadmapItem = {
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
  public listRoadmapItemsByStatus(status: RoadmapStatus): RoadmapItem[] {
    return Array.from(this.items.values())
      .filter((item) => item.status === status)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  private getOrThrow(itemId: string): RoadmapItem {
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
