/**
 * Roadmap Service
 * Tracks roadmap items across phases with status management
 * Implements §33 Roadmap for phase delivery items
 */

import { ValidationError } from "../../platform/contracts/errors.js";
import { nowIso } from "../../platform/contracts/types/ids.js";
import { SuccessCriteriaService } from "./success-criteria-service.js";
import {
  type AddRoadmapItemRequest,
  type CompletionRecord,
  type PhaseAdvanceDecision,
  type PhaseGateDefinition,
  type RoadmapItem,
  type RoadmapPhase,
  type RoadmapStatus,
  type SuccessCriterionDefinition,
  type SuccessCriterionMeasurement,
} from "./types.js";

export interface ArchitectureRoadmapTemplateItem {
  readonly phase: RoadmapPhase;
  readonly title: string;
  readonly description: string;
  readonly status?: RoadmapStatus;
  readonly completionNotes?: string;
}

export const ARCHITECTURE_ROADMAP_TEMPLATE: readonly ArchitectureRoadmapTemplateItem[] = [
  { phase: "phase1", title: "Core execution foundation", description: "Build the control, execution, and state-evidence kernel for the platform.", status: "completed", completionNotes: "Core platform kernel, five-plane bootstrap, and runtime baseline are already present in-repo." },
  { phase: "phase2", title: "AI operations and prompt governance", description: "Introduce model gateway, prompt engine, compliance, and Harness integration.", status: "completed", completionNotes: "Model gateway, prompt engine, compliance baseline, and Harness bootstrap are already wired." },
  { phase: "phase3", title: "Interaction and governance experience", description: "Deliver natural-language entry, dashboard, portal, and delegated governance workflows.", status: "completed", completionNotes: "Interaction layer, user portal baseline, and governance capabilities are already implemented." },
  { phase: "phase4", title: "Scale ecosystem", description: "Enable marketplace, connectors, and multi-tenant ecosystem primitives.", status: "completed", completionNotes: "Marketplace and scale ecosystem baselines are seeded in the current repository." },
  { phase: "phase5", title: "Operations maturity", description: "Ship explainability, forensic controls, observability, and platform self-ops.", status: "completed", completionNotes: "Ops maturity baseline catalog and supporting services are already present." },
  { phase: "phase6", title: "Delivery hardening", description: "Add rollout governance, release readiness, and enterprise safeguards.", status: "completed", completionNotes: "Release, readiness, and governance services are already represented across control-plane and docs." },
  { phase: "phase7", title: "Cross-platform productization", description: "Consolidate platform surfaces into productized app and SDK entrypoints.", status: "completed", completionNotes: "Platform application kernel, SDK surfaces, and UI workspace exist in the repository." },
  { phase: "phase8a", title: "Harness core loop", description: "Close VI-1/2/3 and ship the unified Harness protocol." },
  { phase: "phase8b", title: "Harness durable recovery", description: "Close VI-4/5/6 with durability, context assembly, and recovery." },
  { phase: "phase8c", title: "Harness governance and evaluation", description: "Close VI-7~VI-15 with guardrails, HITL, async, eval, and invariants." },
  { phase: "phase9a", title: "Vertical domains 9a", description: "Coding, data-engineering, knowledge-base, and user-operations." },
  { phase: "phase9b", title: "Vertical domains 9b", description: "Quant-trading, financial-services, ecommerce, and advertising." },
  { phase: "phase9c", title: "Vertical domains 9c", description: "Industry-research, academic-research, finance-accounting, and legal." },
  { phase: "phase9d", title: "Vertical domains 9d", description: "Customer-service, IT-operations, content-moderation, and live-streaming." },
  { phase: "phase9e", title: "Vertical domains 9e", description: "Healthcare, human-resources, supply-chain, and education." },
  { phase: "phase9f", title: "Vertical domains 9f", description: "Creative-production, game-dev, game-publishing, and marketing." },
] as const;

export interface RoadmapServiceOptions {
  readonly eventPublisher?: null;
}

export class RoadmapService {
  private readonly items = new Map<string, RoadmapItem>();
  private readonly successCriteria = new SuccessCriteriaService();

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

  public registerSuccessCriterion(definition: SuccessCriterionDefinition): SuccessCriterionDefinition {
    return this.successCriteria.registerCriterion(definition);
  }

  public registerPhaseGate(gate: PhaseGateDefinition): PhaseGateDefinition {
    return this.successCriteria.registerPhaseGate(gate);
  }

  public recordSuccessMeasurement(
    measurement: Omit<SuccessCriterionMeasurement, "measuredAt"> & { measuredAt?: string },
  ): SuccessCriterionMeasurement {
    return this.successCriteria.recordMeasurement(measurement);
  }

  public evaluatePhaseAdvance(phase: RoadmapPhase): PhaseAdvanceDecision {
    const items = this.getRoadmap(phase);
    return this.successCriteria.evaluatePhaseAdvance(
      phase,
      items.filter((item) => item.status === "completed").map((item) => item.itemId),
      items.filter((item) => item.status === "deferred").map((item) => item.itemId),
    );
  }

  public seedArchitectureRoadmap(): readonly RoadmapItem[] {
    const seeded: RoadmapItem[] = [];
    for (const template of ARCHITECTURE_ROADMAP_TEMPLATE) {
      const exists = this.getRoadmap(template.phase).some((item) => item.title === template.title);
      if (exists) {
        continue;
      }
      const item = this.addRoadmapItem(template);
      if (template.status === "completed") {
        seeded.push(this.completeRoadmapItem(item.itemId, {
          completedAt: nowIso(),
          ...(template.completionNotes ? { notes: template.completionNotes } : {}),
        }));
        continue;
      }
      if (template.status === "in_progress") {
        seeded.push(this.updateRoadmapItemStatus(item.itemId, "in_progress"));
        continue;
      }
      if (template.status === "deferred") {
        seeded.push(this.deferRoadmapItem(item.itemId, template.completionNotes ?? "Deferred in architecture template"));
        continue;
      }
      seeded.push(item);
    }
    return seeded;
  }

  public listArchitecturePhases(): readonly RoadmapPhase[] {
    return [...new Set(ARCHITECTURE_ROADMAP_TEMPLATE.map((item) => item.phase))];
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
