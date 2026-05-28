import {
  createDecisionInputBundle as createCanonicalDecisionInputBundle,
  createHarnessDecision as createCanonicalHarnessDecision,
  type ArtifactRef,
  type DecisionInputBundle as CanonicalDecisionInputBundle,
  type HarnessDecision as CanonicalHarnessDecision,
  type RiskClass,
} from "../../../platform/contracts/executable-contracts/index.js";
import { createEvidenceRecord, createPlatformPrincipal } from "../../../platform/contracts/types/platform-contracts.js";
import { newId } from "../../../platform/contracts/types/ids.js";
import type { RuntimeRepository } from "../../../platform/five-plane-state-evidence/truth/runtime-truth-repository.js";
import type { HarnessDecision, HarnessDecisionAction } from "./runtime-types.js";

export interface HarnessDecisionEvaluationInput {
  evaluatorScore?: number;
  requiresHuman?: boolean;
  maxIterationsReached?: boolean;
  riskScore?: number;
  guardrailSuggestedAction?: string;
  sideEffectMayCommit?: boolean;
  hitlPending?: boolean;
  budgetExhausted?: boolean;
  guardrailAbort?: boolean;
  harnessRunId?: string;
  nodeRunId?: string;
  evidenceRefs?: readonly string[];
  sideEffectRefs?: readonly string[];
  deciderRef?: string;
  frozenEvaluator?: Readonly<{ score: number; reasoning: string }>;
  frozenRisk?: Readonly<{ currentScore: number; maxScore: number; escalationThreshold: number }>;
  frozenHitl?: Readonly<{ pending: boolean; requestId: string | null }>;
  frozenNode?: Readonly<{ nodeId: string; nodeType: string; status: string }>;
  frozenSideEffect?: Readonly<{ mayCommit: boolean; reversible: boolean }>;
  frozenBudget?: Readonly<{ remainingSteps: number; remainingCost: number; remainingDurationMs: number }>;
  frozenPolicy?: Readonly<{ policyIds: readonly string[]; constraintPackRef: string }>;
  frozenGuardrail?: Readonly<{
    passed: boolean;
    requiresHuman: boolean;
    suggestedAction: string;
    findings: readonly { code: string; message: string }[];
  }> | null;
}

export class HarnessDecisionManager {
  public constructor(private readonly runtimeTruthRepository?: RuntimeRepository) {}

  public decide(input: HarnessDecisionEvaluationInput): HarnessDecision {
    const evaluatorScore = input.evaluatorScore ?? 0.5;
    let action: HarnessDecisionAction = "accept";
    const reasonCodes: string[] = [];

    if (input.maxIterationsReached) {
      action = "abort";
      reasonCodes.push("harness.max_iterations_reached");
    } else if (input.guardrailAbort) {
      action = "abort";
      reasonCodes.push("harness.guardrail_deterministic_abort");
    } else if (input.sideEffectMayCommit === false) {
      action = "abort";
      reasonCodes.push("harness.side_effect_cannot_commit");
    } else if (input.budgetExhausted) {
      action = "abort";
      reasonCodes.push("harness.budget_exhausted");
    } else if (input.hitlPending) {
      action = "escalate_to_human";
      reasonCodes.push("harness.hitl_pending");
    } else if (input.requiresHuman) {
      action = "escalate_to_human";
      reasonCodes.push("harness.human_required");
    } else if (input.riskScore !== undefined && input.riskScore > 0.8) {
      action = "downgrade_mode";
      reasonCodes.push("harness.risk_high_downgrade");
    } else if (input.guardrailSuggestedAction === "retry_same_plan") {
      action = "retry_same_plan";
      reasonCodes.push("harness.guardrail_retry_same_plan");
    } else if ((input.evaluatorScore ?? 0.5) < 0.5) {
      action = "replan";
      reasonCodes.push("harness.eval_below_replan_threshold");
    } else if ((input.evaluatorScore ?? 0.5) < 0.75) {
      action = "retry_same_plan";
      reasonCodes.push("harness.eval_below_accept_threshold");
    } else {
      reasonCodes.push("harness.accepted");
    }

    const decisionKind = this.mapDecisionKind(action);
    const decisionInputBundle = createCanonicalDecisionInputBundle({
      harnessRunId: input.harnessRunId ?? "harness_run:compat",
      ...(input.nodeRunId != null ? { nodeRunId: input.nodeRunId } : {}),
      decisionKind,
      riskClass: this.resolveRiskClass(input.riskScore),
      evidenceRefs: this.asArtifactRefs(input.evidenceRefs ?? []),
      sideEffectRefs: input.sideEffectRefs ?? [],
      ...(input.frozenEvaluator != null ? { evaluator: input.frozenEvaluator } : {}),
      ...(input.frozenRisk != null ? { risk: input.frozenRisk } : {}),
      ...(input.frozenHitl != null ? { hitl: input.frozenHitl } : {}),
      ...(input.frozenNode != null ? { node: input.frozenNode } : {}),
      ...(input.frozenSideEffect != null ? { sideEffect: input.frozenSideEffect } : {}),
      ...(input.frozenBudget != null ? { budget: input.frozenBudget } : {}),
      ...(input.frozenPolicy != null ? { policy: input.frozenPolicy } : {}),
      ...(input.frozenGuardrail != null ? { guardrail: input.frozenGuardrail } : {}),
    });
    const harnessDecisionId = newId("harness_decision");
    const canonicalDecision = createCanonicalHarnessDecision({
      decisionInputBundleId: decisionInputBundle.decisionInputBundleId,
      decisionKind,
      decision: this.mapDecisionOutcome(action),
      deciderType: this.resolveDeciderType(action, input.requiresHuman === true, input.maxIterationsReached === true),
      deciderRef: input.deciderRef ?? "harness.runtime_service",
      reasonCode: reasonCodes[0] ?? "harness.accepted",
      harnessDecisionId,
    });

    this.persistDecisionEvidence(canonicalDecision, decisionInputBundle, input);

    return {
      decisionId: canonicalDecision.harnessDecisionId,
      harnessDecisionId: canonicalDecision.harnessDecisionId,
      decisionInputBundleId: canonicalDecision.decisionInputBundleId,
      decisionKind: canonicalDecision.decisionKind,
      decision: canonicalDecision.decision,
      deciderType: canonicalDecision.deciderType,
      deciderRef: canonicalDecision.deciderRef,
      reasonCode: canonicalDecision.reasonCode,
      action,
      reasonCodes,
      confidence: Number(evaluatorScore.toFixed(4)),
      createdAt: canonicalDecision.createdAt,
    };
  }

  private persistDecisionEvidence(
    decision: ReturnType<typeof createCanonicalHarnessDecision>,
    inputBundle: ReturnType<typeof createCanonicalDecisionInputBundle>,
    input: HarnessDecisionEvaluationInput,
  ): void {
    if (this.runtimeTruthRepository == null) {
      return;
    }

    const principal = createPlatformPrincipal({
      actorId: decision.deciderRef,
      tenantId: input.harnessRunId != null && input.harnessRunId !== "harness_run:compat"
        ? `tenant:${input.harnessRunId.split(":")[0] ?? "local"}`
        : "tenant:local",
      roles: ["harness", "decider"],
    });

    const evidenceRecord = createEvidenceRecord({
      traceId: `trace:${input.harnessRunId ?? "harness_run:compat"}`,
      principal,
      category: "decision",
      targetRef: `harness_decision:${decision.harnessDecisionId}`,
      content: {
        decisionId: decision.harnessDecisionId,
        decisionInputBundleId: decision.decisionInputBundleId,
        decisionInput: {
          harnessRunId: inputBundle.harnessRunId,
          nodeRunId: inputBundle.nodeRunId ?? null,
          decisionKind: inputBundle.decisionKind,
          constraintPackRef: inputBundle.policy.constraintPackRef,
          policyIds: inputBundle.policy.policyIds,
        },
        decisionKind: decision.decisionKind,
        decision: decision.decision,
        deciderType: decision.deciderType,
        deciderRef: decision.deciderRef,
        reasonCode: decision.reasonCode,
        action: input.riskScore,
        evaluatorScore: input.evaluatorScore,
        riskScore: input.riskScore,
        requiresHuman: input.requiresHuman ?? false,
        maxIterationsReached: input.maxIterationsReached ?? false,
        hitlPending: input.hitlPending ?? false,
        guardrailAbort: input.guardrailAbort ?? false,
        sideEffectMayCommit: input.sideEffectMayCommit,
        budgetExhausted: input.budgetExhausted ?? false,
        guardrailSuggestedAction: input.guardrailSuggestedAction,
        reasonCodes: input.sideEffectRefs,
        evidenceRefs: input.evidenceRefs,
        sideEffectRefs: input.sideEffectRefs,
        nodeRunId: input.nodeRunId,
        createdAt: decision.createdAt,
      },
      metadata: {
        deciderType: decision.deciderType,
        decisionKind: decision.decisionKind,
        action: decision.decision,
        riskClass: inputBundle.riskClass,
      },
    });

    this.runtimeTruthRepository.appendEvidenceRecord(evidenceRecord);
  }

  private mapDecisionKind(action: HarnessDecisionAction): CanonicalDecisionInputBundle["decisionKind"] {
    switch (action) {
      case "accept":
        return "approve";
      case "retry_same_plan":
        return "retry";
      case "replan":
        return "replan";
      case "escalate_to_human":
        return "takeover";
      case "abort":
      case "quarantine":
      case "revoke_approval":
        return "abort";
      case "pause_for_external":
        return "resume";
      case "downgrade_mode":
      case "require_revalidation":
      default:
        return "patch";
    }
  }

  private mapDecisionOutcome(action: HarnessDecisionAction): CanonicalHarnessDecision["decision"] {
    switch (action) {
      case "accept":
        return "accept";
      case "retry_same_plan":
        return "retry";
      case "replan":
        return "replan";
      case "escalate_to_human":
        return "escalate";
      case "abort":
        return "abort";
      case "quarantine":
      case "revoke_approval":
        return "reject";
      case "pause_for_external":
        return "takeover";
      case "downgrade_mode":
      case "require_revalidation":
      default:
        return "patch";
    }
  }

  private resolveDeciderType(
    action: HarnessDecisionAction,
    requiresHuman: boolean,
    maxIterationsReached: boolean,
  ): CanonicalHarnessDecision["deciderType"] {
    if (action === "escalate_to_human") {
      return "policy";
    }
    if (requiresHuman || maxIterationsReached || action === "abort") {
      return "system";
    }
    return "evaluator";
  }

  private resolveRiskClass(riskScore: number | undefined): RiskClass {
    if (riskScore == null) {
      return "medium";
    }
    const normalized = riskScore <= 1 ? riskScore * 100 : riskScore;
    if (normalized >= 85) {
      return "critical";
    }
    if (normalized >= 60) {
      return "high";
    }
    if (normalized >= 30) {
      return "medium";
    }
    return "low";
  }

  private asArtifactRefs(refs: readonly string[]): ArtifactRef[] {
    return refs.map((ref) => ({
      artifactId: ref,
      uri: `memory://${ref}`,
    }));
  }
}
