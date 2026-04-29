import { newId } from "../../contracts/types/ids.js";
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

export class ImprovementCandidateRegistry {
  private readonly candidates = new Map<string, ImprovementCandidate>();
  private readonly accessOrder: string[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  private touch(key: string): void {
    const idx = this.accessOrder.indexOf(key);
    if (idx !== -1) {
      this.accessOrder.splice(idx, 1);
    }
    this.accessOrder.push(key);
  }

  private evictIfNeeded(): void {
    while (this.candidates.size >= this.maxSize && this.accessOrder.length > 0) {
      const lru = this.accessOrder.shift()!;
      this.candidates.delete(lru);
    }
  }

  public register(input: RegisterImprovementCandidateInput): ImprovementCandidate {
    const candidate = parseImprovementCandidate({
      candidateId: newId("improvement_candidate"),
      taskId: input.taskId,
      sourceSignalRefs: Array.from(new Set(input.learningObjects.flatMap((item) => item.evidenceRefs))),
      sourceLearningObjectIds: input.learningObjects.map((item) => item.learningObjectId),
      changeScope: this.mapTargetToScope(input.target),
      description: input.description,
      expectedBenefit: input.expectedBenefit ?? "Reduce repeated failure modes and improve plan stability.",
      status: "proposed",
      createdAt: Date.now(),
    });
    this.evictIfNeeded();
    this.candidates.set(candidate.candidateId, candidate);
    this.touch(candidate.candidateId);
    return candidate;
  }

  public list(): ImprovementCandidate[] {
    return [...this.candidates.values()];
  }

  public updateStatus(candidateId: string, status: ImprovementCandidate["status"]): ImprovementCandidate | null {
    const current = this.candidates.get(candidateId);
    if (!current) {
      return null;
    }
    const updated = { ...current, status };
    this.candidates.set(candidateId, updated);
    this.touch(candidateId);
    return updated;
  }

  private mapTargetToScope(target: AutonomyTarget): ImprovementChangeScope {
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
}
