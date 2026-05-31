/**
 * Evolution MVP Service
 */
import { createHash } from "node:crypto";

export {
  assertEvolutionScope,
  buildRecommendedBudgetPolicy,
  clamp,
  parsePolicyValue,
  parseProposalPayload,
  roundCurrency,
  roundRatio,
  summarizeBudgetProposal,
} from "./evolution-mvp-support.js";
export type {
  ApplyEvolutionProposalInput,
  BudgetAdjustmentEvidence,
  BudgetAdjustmentProposalPayload,
  EvolutionProposalPayload,
  EvolutionProposalView,
  ExperiencePromotionEvidence,
  ExperiencePromotionProposalPayload,
  ProposeBudgetAdjustmentInput,
  ProposeExperiencePromotionInput,
  RollbackEvolutionProposalInput,
} from "./evolution-mvp-support.js";
import { z } from "zod";

import type {
  EvolutionPolicyRecord,
  EvolutionProposalRecord,
  EvolutionProposalStatus,
  EvolutionScopeType,
} from "../../platform/contracts/types/domain.js";
import { PolicyDeniedError, StorageError, WorkflowStateError } from "../../platform/contracts/errors.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import type { BudgetPolicy } from "../../platform/model-gateway/cost-tracker/budget-guard.js";
import type { ApprovalRequest, ApprovalService } from "../../platform/five-plane-control-plane/approval-center/approval-service.js";
import type { AuthoritativeSqlDatabase } from "../../platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { ExperienceCacheService, type MemoryService } from "../../platform/five-plane-state-evidence/memory-gateway/index.js";
import {
  assertEvolutionScope,
  buildRecommendedBudgetPolicy,
  parsePolicyValue,
  parseProposalPayload,
  roundCurrency,
  roundRatio,
  summarizeBudgetProposal,
  type ApplyEvolutionProposalInput,
  type BudgetAdjustmentEvidence,
  type BudgetAdjustmentProposalPayload,
  type EvolutionProposalView,
  type ExperiencePromotionEvidence,
  type ExperiencePromotionProposalPayload,
  type ProposeBudgetAdjustmentInput,
  type ProposeExperiencePromotionInput,
  type RollbackEvolutionProposalInput,
} from "./evolution-mvp-support.js";

type EvolutionApprovalService = Pick<ApprovalService, "createRequest">;
type EvolutionMemoryService = Pick<MemoryService, "remember" | "revoke">;

export class EvolutionMvpService {
  private readonly experienceCacheService: ExperienceCacheService;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    private readonly approvalService: EvolutionApprovalService,
    private readonly memoryService: EvolutionMemoryService,
  ) {
    this.experienceCacheService = new ExperienceCacheService(store);
  }

  /**
   * Creates a budget adjustment proposal based on observed spending patterns.
   *
   * The proposal is created in pending_approval status and requires approval
   * before it can be applied to modify the budget policy.
   */
  public proposeBudgetAdjustment(input: ProposeBudgetAdjustmentInput): EvolutionProposalView {
    assertEvolutionScope(input.scopeType, input.scopeRef);
    const createdAt = nowIso();
    const recommendedPolicy = buildRecommendedBudgetPolicy(input);
    const payload: BudgetAdjustmentProposalPayload = {
      kind: "budget_adjustment",
      recommendedPolicy,
      baselinePolicy: input.currentPolicy,
      observedAverageCostUsd: roundCurrency(input.observedAverageCostUsd),
      sampleSize: input.sampleSize,
      successRate: roundRatio(input.successRate),
      proposalReason: input.proposalReason.trim(),
    };
    const evidence: BudgetAdjustmentEvidence = {
      currentPolicy: input.currentPolicy,
      recommendedPolicy,
      observedAverageCostUsd: roundCurrency(input.observedAverageCostUsd),
      sampleSize: input.sampleSize,
      successRate: roundRatio(input.successRate),
      proposalReason: input.proposalReason.trim(),
    };
    const summary = summarizeBudgetProposal(input.scopeType, input.scopeRef, evidence);
    const proposalIdempotencyKey = buildProposalIdempotencyKey(
      input.idempotencyKey,
      "budget_adjustment",
      {
        taskId: input.taskId,
        executionId: input.executionId ?? null,
        sourceAgentId: input.sourceAgentId,
        scopeType: input.scopeType,
        scopeRef: input.scopeRef,
        payload,
      },
    );
    const existingPendingProposal = this.findReusableProposal(proposalIdempotencyKey);
    if (existingPendingProposal != null) {
      return this.toProposalView(existingPendingProposal);
    }

    const approval = this.approvalService.createRequest({
      taskId: input.taskId,
      executionId: input.executionId ?? null,
      sourceAgentId: input.sourceAgentId,
      reason: `evolution.budget_adjustment:${input.scopeType}:${input.scopeRef}`,
      riskLevel: "medium",
      options: ["approve", "reject"],
      context: {
        evolutionProposalKind: "budget_adjustment",
        evolutionScopeType: input.scopeType,
        evolutionScopeRef: input.scopeRef,
        proposalSummary: summary,
        evolutionProposalIdempotencyKey: proposalIdempotencyKey,
      },
      timeoutPolicy: "reject",
    });

    const proposal: EvolutionProposalRecord = {
      id: newId("evo"),
      taskId: input.taskId,
      executionId: input.executionId ?? null,
      sourceAgentId: input.sourceAgentId,
      kind: "budget_adjustment",
      scopeType: input.scopeType,
      scopeRef: input.scopeRef,
      status: "pending_approval",
      approvalId: approval.approvalId,
      summary,
      proposalJson: JSON.stringify(payload),
      evidenceJson: JSON.stringify(evidence),
      createdAt,
      updatedAt: createdAt,
      approvedAt: null,
      appliedAt: null,
      rolledBackAt: null,
    };

    this.db.transaction(() => {
      this.store.evolution.insertEvolutionProposal(proposal);
      this.store.evolution.insertEvolutionLog({
        id: newId("evo_log"),
        proposalId: proposal.id,
        taskId: proposal.taskId,
        executionId: proposal.executionId,
        eventType: "proposal_created",
        reasonCode: "evolution.proposal_created",
        beforeStateJson: null,
        afterStateJson: proposal.proposalJson,
        metadataJson: JSON.stringify({ approvalId: approval.approvalId }),
        createdAt,
      });
      this.insertEvolutionEvent(proposal, "evolution:proposal_created", {
        approvalId: approval.approvalId,
        idempotencyKey: proposalIdempotencyKey,
      }, createdAt);
    });

    return {
      proposal,
      approval,
      activePolicy: null,
      logs: this.store.evolution.listEvolutionLogsByProposal(proposal.id),
    };
  }

  /**
   * Creates an experience promotion proposal based on a successful task outcome.
   *
   * Finds similar past experiences and proposes promoting the best match
   * into structured memory for reuse in future tasks.
   */
  public proposeExperiencePromotion(input: ProposeExperiencePromotionInput): EvolutionProposalView {
    assertEvolutionScope(input.scopeType, input.scopeRef);
    const createdAt = nowIso();
    const similar = this.experienceCacheService.findSimilarExperiences({
      taskContext: input.taskContext,
      taskIntent: input.taskIntent,
      ...(input.queryTools != null ? { toolNames: input.queryTools } : {}),
      outcome: "succeeded",
      minQualityScore: input.minQualityScore ?? DEFAULT_EXPERIENCE_PROMOTION_MIN_QUALITY_SCORE,
      limit: 1,
    });

    const candidate = similar[0];
    if (candidate == null) {
      throw new StorageError("evolution.experience_candidate_not_found", "evolution.experience_candidate_not_found", {
        statusCode: 404,
        retryable: false,
      });
    }

    const promotedSummary = [
      `Reuse successful experience from task intent "${candidate.experience.taskIntent}".`,
      `Matched keywords: ${candidate.matchedKeywords.join(", ") || "none"}.`,
      `Tools: ${candidate.experience.toolsUsed.map((tool) => tool.toolName).join(", ") || "none"}.`,
    ].join(" ");

    const payload: ExperiencePromotionProposalPayload = {
      kind: "experience_promotion",
      sourceExperienceId: candidate.experience.id,
      sourceTaskContext: candidate.experience.taskContext,
      sourceTaskIntent: candidate.experience.taskIntent,
      targetScope: input.targetScope,
      promotedSummary,
      qualityScore: candidate.experience.qualityScore,
      matchedKeywords: candidate.matchedKeywords,
    };
    const evidence: ExperiencePromotionEvidence = {
      taskContext: input.taskContext,
      taskIntent: input.taskIntent,
      queryTools: input.queryTools ?? [],
      matchedExperienceId: candidate.experience.id,
      similarityScore: candidate.similarityScore,
      matchedKeywords: candidate.matchedKeywords,
      proposedSummary: promotedSummary,
    };
    const summary = `Promote experience ${candidate.experience.id} into structured memory scope ${input.targetScope}.`;
    const proposalIdempotencyKey = buildProposalIdempotencyKey(
      input.idempotencyKey,
      "experience_promotion",
      {
        taskId: input.taskId,
        executionId: input.executionId ?? null,
        sourceAgentId: input.sourceAgentId,
        scopeType: input.scopeType,
        scopeRef: input.scopeRef,
        payload,
      },
    );
    const existingPendingProposal = this.findReusableProposal(proposalIdempotencyKey);
    if (existingPendingProposal != null) {
      return this.toProposalView(existingPendingProposal);
    }

    const approval = this.approvalService.createRequest({
      taskId: input.taskId,
      executionId: input.executionId ?? null,
      sourceAgentId: input.sourceAgentId,
      reason: `evolution.experience_promotion:${input.scopeType}:${input.scopeRef}`,
      riskLevel: "low",
      options: ["approve", "reject"],
      context: {
        evolutionProposalKind: "experience_promotion",
        evolutionScopeType: input.scopeType,
        evolutionScopeRef: input.scopeRef,
        matchedExperienceId: candidate.experience.id,
        targetScope: input.targetScope,
        evolutionProposalIdempotencyKey: proposalIdempotencyKey,
      },
      timeoutPolicy: "reject",
    });

    const proposal: EvolutionProposalRecord = {
      id: newId("evo"),
      taskId: input.taskId,
      executionId: input.executionId ?? null,
      sourceAgentId: input.sourceAgentId,
      kind: "experience_promotion",
      scopeType: input.scopeType,
      scopeRef: input.scopeRef,
      status: "pending_approval",
      approvalId: approval.approvalId,
      summary,
      proposalJson: JSON.stringify(payload),
      evidenceJson: JSON.stringify(evidence),
      createdAt,
      updatedAt: createdAt,
      approvedAt: null,
      appliedAt: null,
      rolledBackAt: null,
    };

    this.db.transaction(() => {
      this.store.evolution.insertEvolutionProposal(proposal);
      this.store.evolution.insertEvolutionLog({
        id: newId("evo_log"),
        proposalId: proposal.id,
        taskId: proposal.taskId,
        executionId: proposal.executionId,
        eventType: "proposal_created",
        reasonCode: "evolution.proposal_created",
        beforeStateJson: null,
        afterStateJson: proposal.proposalJson,
        metadataJson: JSON.stringify({ approvalId: approval.approvalId }),
        createdAt,
      });
      this.insertEvolutionEvent(proposal, "evolution:proposal_created", {
        approvalId: approval.approvalId,
        matchedExperienceId: candidate.experience.id,
        idempotencyKey: proposalIdempotencyKey,
      }, createdAt);
    });

    return {
      proposal,
      approval,
      activePolicy: null,
      logs: this.store.evolution.listEvolutionLogsByProposal(proposal.id),
    };
  }

  /**
   * Synchronizes the proposal status with its associated approval record.
   * Updates proposal status based on whether approval was granted, rejected, or expired.
   */
  public syncProposalApprovalStatus(proposalId: string, syncedAt: string = nowIso()): EvolutionProposalRecord {
    const proposal = this.requireProposal(proposalId);
    if (proposal.approvalId == null) {
      return proposal;
    }

    const approval = this.store.approval.getApproval(proposal.approvalId);
    if (approval == null) {
      throw new StorageError("evolution.approval_missing", "evolution.approval_missing", {
        statusCode: 404,
        retryable: false,
        details: { proposalId, approvalId: proposal.approvalId },
      });
    }

    let nextStatus = proposal.status;
    let approvedAt = proposal.approvedAt;
    if (approval.status === "approved") {
      nextStatus = proposal.appliedAt == null ? "approved" : proposal.status;
      approvedAt = approval.respondedAt ?? syncedAt;
    } else if (approval.status === "rejected" || approval.status === "expired") {
      nextStatus = proposal.appliedAt == null ? "rejected" : proposal.status;
    }

    if (nextStatus === proposal.status && approvedAt === proposal.approvedAt) {
      return proposal;
    }

    const updated: EvolutionProposalRecord = {
      ...proposal,
      status: nextStatus,
      approvedAt,
      updatedAt: syncedAt,
    };

    this.db.transaction(() => {
      this.store.evolution.updateEvolutionProposal(updated);
      this.store.evolution.insertEvolutionLog({
        id: newId("evo_log"),
        proposalId: proposal.id,
        taskId: proposal.taskId,
        executionId: proposal.executionId,
        eventType: "approval_synced",
        reasonCode: `evolution.approval_${approval.status}`,
        beforeStateJson: JSON.stringify({ status: proposal.status, approvedAt: proposal.approvedAt }),
        afterStateJson: JSON.stringify({ status: updated.status, approvedAt: updated.approvedAt }),
        metadataJson: JSON.stringify({ approvalId: proposal.approvalId, approvalStatus: approval.status }),
        createdAt: syncedAt,
      });
    });

    return updated;
  }

  /**
   * Applies an approved evolution proposal, activating its policy.
   * For budget adjustments, activates the new policy.
   * For experience promotions, promotes the experience into structured memory.
   */
  public applyProposal(input: ApplyEvolutionProposalInput): EvolutionProposalView {
    const appliedAt = input.appliedAt ?? nowIso();
    const syncedProposal = this.syncProposalApprovalStatus(input.proposalId, appliedAt);
    if (syncedProposal.status !== "approved") {
      throw new PolicyDeniedError("evolution.approval_required", "evolution.approval_required", {
        retryable: false,
        details: {
          proposalId: input.proposalId,
          proposalStatus: syncedProposal.status,
        },
      });
    }

    const payload = parseProposalPayload(syncedProposal);
    const previousPolicy =
      this.store.evolution.listEvolutionPolicies({
        kind: syncedProposal.kind,
        scopeType: syncedProposal.scopeType,
        scopeRef: syncedProposal.scopeRef,
        status: "active",
      })[0] ?? null;

    let nextPolicy: EvolutionPolicyRecord;
    if (payload.kind === "budget_adjustment") {
      nextPolicy = {
        id: newId("evo_policy"),
        proposalId: syncedProposal.id,
        kind: syncedProposal.kind,
        scopeType: syncedProposal.scopeType,
        scopeRef: syncedProposal.scopeRef,
        status: "active",
        valueJson: JSON.stringify({
          recommendedPolicy: payload.recommendedPolicy,
          baselinePolicy: payload.baselinePolicy,
          appliedBy: input.appliedBy,
        }),
        createdAt: appliedAt,
        updatedAt: appliedAt,
        rolledBackAt: null,
      };
    } else {
      const promotedMemory = this.memoryService.remember({
        taskId: syncedProposal.taskId,
        executionId: syncedProposal.executionId,
        agentId: syncedProposal.sourceAgentId,
        scope: payload.targetScope,
        classification: "experience",
        memoryLayer: "layer_5",
        sourceTrustLevel: "trusted",
        qualityScore: payload.qualityScore,
        content: {
          workContext: payload.sourceTaskContext,
          topOfMind: [payload.promotedSummary],
          longTermBackground: [payload.sourceTaskIntent],
          facts: payload.matchedKeywords.map((keyword) => ({
            content: keyword,
            category: "matched_keyword",
            confidence: PROMOTED_MEMORY_FACT_CONFIDENCE,
            provenanceSource: `experience:${payload.sourceExperienceId}`,
          })),
        },
        createdAt: appliedAt,
      });

      nextPolicy = {
        id: newId("evo_policy"),
        proposalId: syncedProposal.id,
        kind: syncedProposal.kind,
        scopeType: syncedProposal.scopeType,
        scopeRef: syncedProposal.scopeRef,
        status: "active",
        valueJson: JSON.stringify({
          memoryId: promotedMemory.id,
          sourceExperienceId: payload.sourceExperienceId,
          targetScope: payload.targetScope,
          appliedBy: input.appliedBy,
        }),
        createdAt: appliedAt,
        updatedAt: appliedAt,
        rolledBackAt: null,
      };
    }

    const appliedProposal: EvolutionProposalRecord = {
      ...syncedProposal,
      status: "applied",
      appliedAt,
      updatedAt: appliedAt,
    };
    this.assertProposalApplicationTimestamp(syncedProposal, appliedAt);

    this.db.transaction(() => {
      if (previousPolicy != null) {
        this.store.evolution.updateEvolutionPolicy({
          ...previousPolicy,
          status: "rolled_back",
          updatedAt: appliedAt,
          rolledBackAt: appliedAt,
        });
      }

      this.store.evolution.insertEvolutionPolicy(nextPolicy);
      this.store.evolution.updateEvolutionProposal(appliedProposal);
      this.store.evolution.insertEvolutionLog({
        id: newId("evo_log"),
        proposalId: appliedProposal.id,
        taskId: appliedProposal.taskId,
        executionId: appliedProposal.executionId,
        eventType: "proposal_applied",
        reasonCode: "evolution.proposal_applied",
        beforeStateJson: previousPolicy?.valueJson ?? null,
        afterStateJson: nextPolicy.valueJson,
        metadataJson: JSON.stringify({ appliedBy: input.appliedBy }),
        createdAt: appliedAt,
      });
      this.insertEvolutionEvent(appliedProposal, "evolution:applied", {
        appliedBy: input.appliedBy,
      }, appliedAt);
    });

    return this.getProposalView(appliedProposal.id);
  }

  /**
   * Rolls back an applied evolution proposal, deactivating its associated policy.
   * For experience promotions, also revokes the promoted memory entry.
   */
  public rollbackProposal(input: RollbackEvolutionProposalInput): EvolutionProposalView {
    const rolledBackAt = input.rolledBackAt ?? nowIso();
    const proposal = this.requireProposal(input.proposalId);
    if (proposal.status !== "applied") {
      throw new WorkflowStateError("evolution.rollback_requires_applied_proposal", "evolution.rollback_requires_applied_proposal", {
        retryable: false,
        details: { proposalId: input.proposalId, status: proposal.status },
      });
    }

    const activePolicy = this.store.evolution.getEvolutionPolicyByProposal(proposal.id);
    if (activePolicy == null || activePolicy.status !== "active") {
      throw new StorageError("evolution.active_policy_missing", "evolution.active_policy_missing", {
        statusCode: 404,
        retryable: false,
        details: { proposalId: proposal.id },
      });
    }

    const payload = parseProposalPayload(proposal);
    if (payload.kind === "experience_promotion") {
      const policyValue = parsePolicyValue<{ memoryId?: string }>(activePolicy);
      if (policyValue.memoryId) {
        this.memoryService.revoke(policyValue.memoryId, `evolution_rollback:${input.reasonCode}`, rolledBackAt);
      }
    }

    const rolledBackPolicy: EvolutionPolicyRecord = {
      ...activePolicy,
      status: "rolled_back",
      updatedAt: rolledBackAt,
      rolledBackAt,
    };
    const rolledBackProposal: EvolutionProposalRecord = {
      ...proposal,
      status: "rolled_back",
      rolledBackAt,
      updatedAt: rolledBackAt,
    };

    this.db.transaction(() => {
      this.store.evolution.updateEvolutionPolicy(rolledBackPolicy);
      this.store.evolution.updateEvolutionProposal(rolledBackProposal);
      this.store.evolution.insertEvolutionLog({
        id: newId("evo_log"),
        proposalId: proposal.id,
        taskId: proposal.taskId,
        executionId: proposal.executionId,
        eventType: "proposal_rolled_back",
        reasonCode: input.reasonCode,
        beforeStateJson: activePolicy.valueJson,
        afterStateJson: null,
        metadataJson: JSON.stringify({ rolledBackBy: input.rolledBackBy }),
        createdAt: rolledBackAt,
      });
      this.insertEvolutionEvent(proposal, "evolution:rolled_back", {
        rolledBackBy: input.rolledBackBy,
        reasonCode: input.reasonCode,
      }, rolledBackAt);
    });

    return this.getProposalView(proposal.id);
  }

  /**
   * Resolves the effective budget policy for a given scope.
   * Returns the active policy if one exists, otherwise returns the base policy.
   */
  public resolveBudgetPolicy(
    basePolicy: BudgetPolicy,
    scopeType: EvolutionScopeType,
    scopeRef: string,
  ): { policy: BudgetPolicy; sourceProposalId: string | null } {
    assertEvolutionScope(scopeType, scopeRef);
    const activePolicy = this.store.evolution.listEvolutionPolicies({
      kind: "budget_adjustment",
      scopeType,
      scopeRef,
      status: "active",
    })[0];
    if (activePolicy == null) {
      return {
        policy: basePolicy,
        sourceProposalId: null,
      };
    }

    const value = parsePolicyValue<{ recommendedPolicy?: BudgetPolicy }>(activePolicy);
    return {
      policy: value.recommendedPolicy ?? basePolicy,
      sourceProposalId: activePolicy.proposalId,
    };
  }

  /**
   * Lists all proposal views matching the optional status filter.
   */
  public listProposalViews(status?: EvolutionProposalStatus): EvolutionProposalView[] {
    return this.store.evolution.listEvolutionProposals(status).map((proposal) => this.toProposalView(proposal));
  }

  /**
   * Retrieves a single proposal view by proposal ID.
   */
  public getProposalView(proposalId: string): EvolutionProposalView {
    return this.toProposalView(this.requireProposal(proposalId));
  }

  /**
   * Converts a proposal record to a full proposal view with approval, policy, and logs.
   */
  private toProposalView(proposal: EvolutionProposalRecord): EvolutionProposalView {
    const approvalRecord = proposal.approvalId == null ? null : this.store.approval.getApproval(proposal.approvalId);
    const approval = approvalRecord?.requestJson
      ? parseApprovalRequestJson(approvalRecord.requestJson)
      : null;
    return {
      proposal,
      approval,
      activePolicy: this.store.evolution.getEvolutionPolicyByProposal(proposal.id),
      logs: this.store.evolution.listEvolutionLogsByProposal(proposal.id),
    };
  }

  private assertProposalApplicationTimestamp(proposal: EvolutionProposalRecord, appliedAt: string): void {
    const appliedAtMs = Date.parse(appliedAt);
    const approvedAtMs = proposal.approvedAt == null ? null : Date.parse(proposal.approvedAt);
    const createdAtMs = Date.parse(proposal.createdAt);
    if (
      Number.isNaN(appliedAtMs)
      || Number.isNaN(createdAtMs)
      || (approvedAtMs != null && Number.isNaN(approvedAtMs))
    ) {
      throw new WorkflowStateError("evolution.invalid_application_timestamp", "evolution.invalid_application_timestamp", {
        retryable: false,
        details: { proposalId: proposal.id, appliedAt, approvedAt: proposal.approvedAt, createdAt: proposal.createdAt },
      });
    }
    if (appliedAtMs < createdAtMs || (approvedAtMs != null && appliedAtMs < approvedAtMs)) {
      throw new WorkflowStateError("evolution.non_monotonic_applied_at", "evolution.non_monotonic_applied_at", {
        retryable: false,
        details: { proposalId: proposal.id, appliedAt, approvedAt: proposal.approvedAt, createdAt: proposal.createdAt },
      });
    }
  }

  private insertEvolutionEvent(
    proposal: Pick<EvolutionProposalRecord, "id" | "taskId" | "executionId" | "kind" | "scopeType" | "scopeRef">,
    eventType: "evolution:proposal_created" | "evolution:applied" | "evolution:rolled_back",
    metadata: Record<string, unknown>,
    createdAt: string,
  ): void {
    this.store.event.insertEvent({
      id: newId("evt"),
      taskId: proposal.taskId,
      executionId: proposal.executionId,
      sessionId: null,
      eventType,
      eventTier: "tier_2",
      payloadJson: JSON.stringify({
        proposalId: proposal.id,
        kind: proposal.kind,
        scopeType: proposal.scopeType,
        scopeRef: proposal.scopeRef,
        ...metadata,
      }),
      traceId: null,
      createdAt,
      schemaVersion: "1.0",
      aggregateId: null,
      runId: null,
      sequence: null,
      causationId: null,
      correlationId: null,
      payloadHash: null,
      idempotencyKey: `evolution:${proposal.id}:${eventType}`,
      replayBehavior: "replay_as_fact",
      principal: "system",
      evidenceRefs: [] as readonly string[],
    });
  }

  private findReusableProposal(idempotencyKey: string): EvolutionProposalRecord | null {
    return this.store.evolution
      .listEvolutionProposals()
      .find((proposal) => {
        if (proposal.status !== "pending_approval" && proposal.status !== "approved") {
          return false;
        }
        const approvalRecord = proposal.approvalId == null ? null : this.store.approval.getApproval(proposal.approvalId);
        if (approvalRecord?.requestJson == null) {
          return false;
        }
        try {
          const approval = parseApprovalRequestJson(approvalRecord.requestJson);
          return approval.context.evolutionProposalIdempotencyKey === idempotencyKey;
        } catch {
          return false;
        }
      }) ?? null;
  }

  /**
   * Retrieves a proposal by ID, throwing if not found.
   */
  private requireProposal(proposalId: string): EvolutionProposalRecord {
    const proposal = this.store.evolution.getEvolutionProposal(proposalId);
    if (proposal == null) {
      throw new StorageError("evolution.proposal_not_found", "evolution.proposal_not_found", {
        statusCode: 404,
        retryable: false,
        details: { proposalId },
      });
    }
    return proposal;
  }
}

const DEFAULT_EXPERIENCE_PROMOTION_MIN_QUALITY_SCORE = 0.65;
const PROMOTED_MEMORY_FACT_CONFIDENCE = 0.8;

const ApprovalRequestSchema = z.object({
  approvalId: z.string(),
  taskId: z.string(),
  sourceAgentId: z.string(),
  reason: z.string(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  options: z.array(z.string()),
  context: z.record(z.unknown()),
  timeoutPolicy: z.enum(["reject", "approve", "remain_pending"]),
  createdAt: z.string(),
}).passthrough();

function parseApprovalRequestJson(requestJson: string): ApprovalRequest {
  return ApprovalRequestSchema.parse(JSON.parse(requestJson));
}

function buildProposalIdempotencyKey(
  callerProvidedKey: string | undefined,
  kind: "budget_adjustment" | "experience_promotion",
  fingerprint: Record<string, unknown>,
): string {
  if (typeof callerProvidedKey === "string" && callerProvidedKey.trim().length > 0) {
    return callerProvidedKey.trim();
  }
  const digest = createHash("sha256")
    .update(JSON.stringify({ kind, fingerprint }))
    .digest("hex")
    .slice(0, 24);
  return `evolution:${kind}:${digest}`;
}
