import { newId, nowIso } from "../../contracts/types/ids.js";
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

  public constructor(private readonly maxSize = 100) {}

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
      rolloutLevel: "off",
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
    this.touch(candidate.candidateId);
    this.evictIfNeeded();
    return candidate;
  }

  public list(): ImprovementCandidate[] {
    return this.accessOrder
      .map((candidateId) => this.candidates.get(candidateId))
      .filter((candidate): candidate is ImprovementCandidate => candidate != null);
  }

  public updateStatus(candidateId: string, status: ImprovementCandidate["status"]): ImprovementCandidate | null {
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
    return updated;
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
        requiredLevel: "evaluate_0",
      }];
    }
    return [];
  }

  private touch(candidateId: string): void {
    const existingIndex = this.accessOrder.indexOf(candidateId);
    if (existingIndex >= 0) {
      this.accessOrder.splice(existingIndex, 1);
    }
    this.accessOrder.push(candidateId);
  }

  private evictIfNeeded(): void {
    while (this.accessOrder.length > this.maxSize) {
      const oldest = this.accessOrder.shift();
      if (oldest != null) {
        this.candidates.delete(oldest);
      }
    }
  }
}

function inferRolloutLevelFromStatus(status: ImprovementCandidate["status"]): ImprovementCandidate["rolloutLevel"] {
  switch (status) {
    case "evaluation_enabled":
      return "evaluate_0";
    case "canary_5":
      return "canary_5";
    case "partial_25":
      return "partial_25";
    case "stable_75":
      return "stable_75";
    case "stable_100":
    case "released":
      return "stable_100";
    default:
      return "off";
  }
}
