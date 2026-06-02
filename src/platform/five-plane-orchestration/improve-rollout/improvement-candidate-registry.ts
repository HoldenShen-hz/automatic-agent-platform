import { newId, nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type { LearningObject } from "../learn/learning-object-model.js";
import { parseImprovementCandidate, type ImprovementCandidate, type ImprovementChangeScope } from "../oapeflir/types/improvement-candidate.js";
import type { AutonomyTarget } from "./autonomy-boundary-policy.js";

export type { ImprovementCandidate };

export interface RegisterImprovementCandidateInput {
  taskId: string;
  target: AutonomyTarget;
  learningObjects: readonly LearningObject[];
  description: string;
  expectedBenefit?: string;
}

/**
 * R23-45 fix: Persistence store interface for improvement candidates.
 * Allows registry to persist candidates to durable storage.
 */
export interface CandidatePersistenceStore {
  saveCandidate(candidate: ImprovementCandidate): void;
  loadCandidates(): ImprovementCandidate[];
  deleteCandidate(candidateId: string): void;
}

/**
 * R23-45 fix: TTL configuration for in-memory entries.
 * Entries expire after ttlMs milliseconds from creation.
 */
export interface CandidateTtlConfig {
  ttlMs: number;
  maxSize: number;
}

export interface ImprovementCandidateRegistryOptions extends Partial<CandidateTtlConfig> {
  store?: CandidatePersistenceStore;
  now?: () => number;
}

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days default TTL
const DEFAULT_MAX_SIZE = 100;
const improvementCandidateRegistryLogger = new StructuredLogger({ retentionLimit: 100 });

function toEpochMs(value: string | number): number {
  return typeof value === "number" ? value : Date.parse(value);
}

export class ImprovementCandidateRegistry {
  private readonly candidates = new Map<string, ImprovementCandidate>();
  private readonly accessOrder = new Set<string>();
  private readonly createdAt = new Map<string, number>();
  /** R23-45 fix: Optional persistence store for durable storage */
  private readonly persistenceStore: CandidatePersistenceStore | undefined;
  /** R23-45 fix: TTL in milliseconds */
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private readonly now: () => number;

  public constructor(options?: number | ImprovementCandidateRegistryOptions) {
    const normalizedOptions = typeof options === "number" ? { maxSize: options } : options;
    this.ttlMs = normalizedOptions?.ttlMs ?? DEFAULT_TTL_MS;
    this.maxSize = normalizedOptions?.maxSize ?? DEFAULT_MAX_SIZE;
    this.persistenceStore = normalizedOptions?.store;
    this.now = normalizedOptions?.now ?? Date.now;
    // R23-45 fix: Load persisted candidates on startup
    if (this.persistenceStore) {
      try {
        for (const candidate of this.persistenceStore.loadCandidates()) {
          this.candidates.set(candidate.candidateId, candidate);
          this.accessOrder.add(candidate.candidateId);
          this.createdAt.set(candidate.candidateId, toEpochMs(candidate.createdAt));
        }
      } catch (error) {
        improvementCandidateRegistryLogger.error("improvement_candidate.load_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  public register(input: RegisterImprovementCandidateInput): ImprovementCandidate {
    const learningObject = input.learningObjects[0];
    const timestamp = nowIso();
    const candidate = parseImprovementCandidate({
      candidateId: newId("improvement_candidate"),
      taskId: input.taskId,
      learningObjectId: learningObject?.learningObjectId ?? "missing_learning_object",
      source: learningObject?.learningType ?? "failure_pattern",
      targetScope: this.mapTargetToTargetScope(input.target),
      priority: this.inferPriority(input.target),
      rolloutLevel: "L0_off", // R23-43 fix: Use L0_off instead of "off"
      metrics: {
        errorRate: 0,
        latencyP99: 0,
        successRate: 1,
        sampleCount: 0,
      },
      guardrails: this.buildGuardrails(input.target),
      sourceSignalRefs: Array.from(new Set(input.learningObjects.flatMap((item) => item.evidenceRefs))),
      sourceLearningObjectIds: input.learningObjects.map((item) => item.learningObjectId),
      changeScope: this.mapTargetToChangeScope(input.target),
      description: input.description,
      expectedBenefit: input.expectedBenefit ?? "Reduce repeated failure modes and improve plan stability.",
      status: "candidate_created",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    this.candidates.set(candidate.candidateId, candidate);
    this.createdAt.set(candidate.candidateId, toEpochMs(candidate.createdAt));
    this.touch(candidate.candidateId);
    this.evictIfNeeded();
    // R23-45 fix: Persist to durable store after registration
    this.persistCandidate(candidate);
    return candidate;
  }

  public list(): ImprovementCandidate[] {
    // R23-45 fix: Evict expired entries before listing
    this.evictExpired();
    return [...this.accessOrder]
      .map((candidateId) => this.candidates.get(candidateId))
      .filter((candidate): candidate is ImprovementCandidate => candidate != null);
  }

  public updateStatus(candidateId: string, status: ImprovementCandidate["status"]): ImprovementCandidate | null {
    // R23-45 fix: Check TTL on access
    if (!this.isValid(candidateId)) {
      this.removeCandidate(candidateId);
      return null;
    }
    const current = this.candidates.get(candidateId);
    if (!current) {
      return null;
    }
    const updated = {
      ...current,
      status,
      rolloutLevel: inferRolloutLevelFromStatus(status),
      updatedAt: nowIso(),
    };
    this.candidates.set(candidateId, updated);
    this.touch(candidateId);
    // R23-45 fix: Persist after update
    this.persistCandidate(updated);
    return updated;
  }

  /**
   * R23-45 fix: Check if a candidate exists and is not expired.
   */
  public isValid(candidateId: string): boolean {
    const created = this.createdAt.get(candidateId);
    if (created == null) {
      return false;
    }
    return this.now() - created < this.ttlMs;
  }

  /**
   * R23-45 fix: Evict all expired entries.
   */
  private evictExpired(): void {
    const now = this.now();
    const expiredIds: string[] = [];
    for (const [candidateId, created] of this.createdAt.entries()) {
      if (now - created >= this.ttlMs) {
        expiredIds.push(candidateId);
      }
    }
    for (const id of expiredIds) {
      this.removeCandidate(id);
    }
  }

  /**
   * R23-45 fix: Remove a candidate and clean up metadata.
   */
  private removeCandidate(candidateId: string): void {
    const removedCandidate = this.candidates.get(candidateId) ?? null;
    this.candidates.delete(candidateId);
    this.createdAt.delete(candidateId);
    this.accessOrder.delete(candidateId);
    // R23-45 fix: Also remove from persistence store
    try {
      this.persistenceStore?.deleteCandidate(candidateId);
    } catch (error) {
      if (removedCandidate) {
        this.persistExpiredTombstone(removedCandidate);
      }
      improvementCandidateRegistryLogger.error("improvement_candidate.delete_failed", {
        candidateId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * R23-45 fix: Persist a candidate to durable storage.
   */
  private persistCandidate(candidate: ImprovementCandidate): void {
    try {
      this.persistenceStore?.saveCandidate(candidate);
    } catch (error) {
      improvementCandidateRegistryLogger.error("improvement_candidate.persist_failed", {
        candidateId: candidate.candidateId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private persistExpiredTombstone(candidate: ImprovementCandidate): void {
    if (!this.persistenceStore) {
      return;
    }
    try {
      this.persistenceStore.saveCandidate({
        ...candidate,
        status: "rejected",
        rolloutLevel: "L0_off",
        updatedAt: nowIso(),
        createdAt: new Date(0).toISOString(),
      });
    } catch (error) {
      improvementCandidateRegistryLogger.error("improvement_candidate.tombstone_persist_failed", {
        candidateId: candidate.candidateId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private mapTargetToChangeScope(target: AutonomyTarget): ImprovementChangeScope {
    switch (target) {
      case "routing_policy":
      case "planning_policy":
      case "execution_policy":
        return "policy";
      case "memory_policy":
        return "workflow";
      case "sandbox_policy":
        return "tool_config";
      case "provider_registry":
        return "model";
    }
  }

  private mapTargetToTargetScope(target: AutonomyTarget): "task" | "workflow" | "domain" | "platform" {
    switch (target) {
      case "memory_policy":
        return "workflow";
      case "sandbox_policy":
      case "provider_registry":
        return "platform";
      case "routing_policy":
      case "planning_policy":
      case "execution_policy":
        return "domain";
    }
  }

  private inferPriority(target: AutonomyTarget): "critical" | "high" | "medium" | "low" {
    switch (target) {
      case "sandbox_policy":
      case "provider_registry":
        return "critical";
      case "planning_policy":
      case "execution_policy":
        return "high";
      case "memory_policy":
        return "medium";
      case "routing_policy":
        return "low";
    }
  }

  private buildGuardrails(target: AutonomyTarget): ImprovementCandidate["guardrails"] {
    if (target === "sandbox_policy" || target === "provider_registry") {
      return [{
        guardrailId: "guardrail.platform.human_approval",
        description: "Platform-scoped improvements require human approval before rollout.",
        requiredLevel: "L1_evaluate",
      }];
    }
    return [];
  }

  private touch(candidateId: string): void {
    this.accessOrder.delete(candidateId);
    this.accessOrder.add(candidateId);
  }

  private evictIfNeeded(): void {
    while (this.accessOrder.size > this.maxSize) {
      const oldest = this.accessOrder.keys().next().value as string | undefined;
      if (oldest != null) {
        this.removeCandidate(oldest);
      }
    }
  }
}

function inferRolloutLevelFromStatus(status: ImprovementCandidate["status"]): ImprovementCandidate["rolloutLevel"] {
  // R23-43 fix: Use L0-L5 level naming for standardized rollout progression
  switch (status) {
    case "evaluation_enabled":
      return "L1_evaluate";
    case "canary_5":
      return "L2_canary";
    case "partial_25":
      return "L3_partial";
    case "stable_75":
      return "L4_stable";
    case "stable_100":
    case "released":
      return "L5_full";
    default:
      return "L0_off";
  }
}
