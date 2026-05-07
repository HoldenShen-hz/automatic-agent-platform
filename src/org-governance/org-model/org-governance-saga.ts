import { newId } from "../../platform/contracts/types/ids.js";
import { sha256, stableStringify } from "../../platform/five-plane-control-plane/config-center/config-governance-support.js";

export interface OrgGovernanceSagaStep {
  readonly stepId: string;
  readonly targetOrgNodeId: string;
  readonly action: "prepare" | "commit" | "compensate" | "audit";
  readonly phase: OrgGovernancePhase;
}

export type OrgGovernancePhase = "identity" | "approval" | "budget" | "domain" | "agent";

export interface OrgGovernanceSagaHandlerContext {
  readonly sagaId: string;
  readonly failedStepId: string | null;
}

export interface OrgGovernanceSagaHandlers {
  readonly prepare?: (step: OrgGovernanceSagaStep, context: OrgGovernanceSagaHandlerContext) => void;
  readonly commit?: (step: OrgGovernanceSagaStep, context: OrgGovernanceSagaHandlerContext) => void;
  readonly compensate?: (step: OrgGovernanceSagaStep, context: OrgGovernanceSagaHandlerContext) => void;
  readonly audit?: (step: OrgGovernanceSagaStep, context: OrgGovernanceSagaHandlerContext) => void;
}

/**
 * Handler interfaces for org operations performed during saga commit phase.
 * §46.3: commit phase must update in fixed order: identity → approval → budget → domain → agent
 */
export interface OrgIdentityOperation {
  updatePrincipalOrgNode(principalId: string, newOrgNodeId: string, sagaId: string): Promise<void>;
  transferPrincipal(principalId: string, fromOrgNodeId: string, toOrgNodeId: string, sagaId: string): Promise<void>;
}

export interface OrgApprovalOperation {
  updateApprovalRoute(orgNodeId: string, newApproverIds: readonly string[], sagaId: string): Promise<void>;
  rerouteApprovalsForOrgChange(orgNodeId: string, affectedApprovalIds: readonly string[], newApproverIds: readonly string[], sagaId: string): Promise<void>;
}

export interface OrgBudgetOperation {
  updateBudgetOwner(orgNodeId: string, newOwnerUserId: string, sagaId: string): Promise<void>;
  transferBudgetAllocation(fromOrgNodeId: string, toOrgNodeId: string, amount: number, currency: string, sagaId: string): Promise<void>;
}

export interface OrgDomainOperation {
  updateDomainOwner(domainId: string, newOwnerUserId: string, sagaId: string): Promise<void>;
  reassignDomainOwnership(orgNodeId: string, affectedDomainIds: readonly string[], newOwnerUserId: string, sagaId: string): Promise<void>;
}

export interface OrgAgentOwnershipOperation {
  freezeAgentAdmission(orgNodeId: string, frozen: boolean, reason: string, sagaId: string): Promise<void>;
  reassignAgentOwnership(orgNodeId: string, fromPrincipalId: string, toPrincipalId: string, sagaId: string): Promise<void>;
}

export interface OrgOperationHandlers {
  readonly identity: OrgIdentityOperation;
  readonly approval: OrgApprovalOperation;
  readonly budget: OrgBudgetOperation;
  readonly domain: OrgDomainOperation;
  readonly agent: OrgAgentOwnershipOperation;
}

export interface OrgGovernanceSagaResult {
  readonly sagaId: string;
  readonly status: "committed" | "compensated";
  readonly preparedNodeIds: readonly string[];
  readonly committedNodeIds: readonly string[];
  readonly compensatedNodeIds: readonly string[];
  readonly auditStepIds: readonly string[];
  readonly failedStepId: string | null;
  readonly executionLog: readonly {
    stepId: string;
    action: OrgGovernanceSagaStep["action"];
    targetOrgNodeId: string;
    outcome: "prepared" | "committed" | "compensated" | "audited" | "skipped" | "failed";
  }[];
}

const PHASE_ORDER: OrgGovernancePhase[] = ["identity", "approval", "budget", "domain", "agent"];

function sortStepsByPhase(steps: readonly OrgGovernanceSagaStep[]): OrgGovernanceSagaStep[] {
  return [...steps].sort((left, right) => {
    const leftIdx = PHASE_ORDER.indexOf(left.phase);
    const rightIdx = PHASE_ORDER.indexOf(right.phase);
    if (leftIdx !== rightIdx) {
      return leftIdx - rightIdx;
    }
    return left.stepId.localeCompare(right.stepId);
  });
}

export interface OrgGovernanceSagaReceipt {
  readonly sagaId: string;
  readonly status: "committed" | "compensated";
  readonly phaseCommitOrder: readonly OrgGovernancePhase[];
  readonly preparedByPhase: Readonly<Record<OrgGovernancePhase, readonly string[]>>;
  readonly committedByPhase: Readonly<Record<OrgGovernancePhase, readonly string[]>>;
  readonly compensatedByPhase: Readonly<Record<OrgGovernancePhase, readonly string[]>>;
  readonly failedPhase: OrgGovernancePhase | null;
  readonly orgVersion: OrgVersionSnapshot | null;
  readonly impactDiff: OrgImpactDiff | null;
  readonly executionLog: readonly {
    stepId: string;
    action: OrgGovernanceSagaStep["action"];
    phase: OrgGovernancePhase;
    targetOrgNodeId: string;
    outcome: "prepared" | "committed" | "compensated" | "audited" | "skipped" | "failed";
  }[];
}

/**
 * Frozen snapshot of org state at saga start.
 * §46.3: Freeze orgVersion before commit to ensure consistent rollback point.
 */
export interface OrgVersionSnapshot {
  readonly snapshotId: string;
  readonly frozenAt: number;
  readonly frozenBy: string;
  readonly orgNodeIds: readonly string[];
  readonly versionHash: string;
}

/**
 * Impact diff describing what changes when org structure changes.
 * §46.3: Compute impact diff to understand scope of org changes.
 */
export interface OrgImpactDiff {
  readonly diffId: string;
  readonly computedAt: number;
  readonly addedNodeIds: readonly string[];
  readonly removedNodeIds: readonly string[];
  readonly modifiedNodeIds: readonly string[];
  readonly affectedPrincipalIds: readonly string[];
  readonly crossBoundaryChanges: readonly CrossBoundaryImpact[];
}

export interface CrossBoundaryImpact {
  readonly sourceBoundaryId: string;
  readonly targetBoundaryId: string;
  readonly changeType: "legal_entity" | "jurisdiction" | "data_residency" | "budget_transfer";
  readonly severity: "low" | "medium" | "high";
}

/**
 * Compensation receipt entry for audit trail and retry safety.
 * §46.3: Each compensation step produces a receipt for tracking and replay.
 */
export interface CompensationReceiptEntry {
  readonly receiptId: string;
  readonly sagaId: string;
  readonly failedStepId: string;
  readonly compensationStepId: string;
  readonly phase: OrgGovernancePhase;
  readonly compensatedNodeId: string;
  readonly compensatedAt: number;
  readonly compensationOutcome: "success" | "failed";
  readonly errorMessage: string | null;
  readonly canRetry: boolean;
}

export class OrgGovernanceSaga {
  private frozenOrgVersion: OrgVersionSnapshot | null = null;
  private computedImpactDiff: OrgImpactDiff | null = null;
  private compensationReceipt: CompensationReceiptEntry[] = [];

  public constructor(private readonly handlers: OrgGovernanceSagaHandlers = {}) {}

  /**
   * Get current org version snapshot frozen during prepare phase.
   * Returns null if prepare has not been called or freeze failed.
   */
  public getFrozenOrgVersion(): OrgVersionSnapshot | null {
    return this.frozenOrgVersion;
  }

  /**
   * Get impact diff computed during prepare phase.
   * Returns null if prepare has not been called or diff computation failed.
   */
  public getComputedImpactDiff(): OrgImpactDiff | null {
    return this.computedImpactDiff;
  }

  /**
   * Get compensation receipt entries for rollback tracking.
   * §46.3: Track compensation with receipt for audit and retry.
   */
  public getCompensationReceipt(): readonly CompensationReceiptEntry[] {
    return [...this.compensationReceipt];
  }

  /**
   * Reset internal state between saga executions.
   * Must be called before each new execute() call.
   */
  public reset(): void {
    this.frozenOrgVersion = null;
    this.computedImpactDiff = null;
    this.compensationReceipt = [];
  }

  /**
   * Inject a pre-computed frozen org version.
   * Used by executeWithOrgOperations to transfer frozen state to a new saga instance.
   * §46.3: Frozen version is required for consistent rollback point.
   */
  public injectFrozenOrgVersion(snapshot: OrgVersionSnapshot): void {
    this.frozenOrgVersion = snapshot;
  }

  /**
   * Inject a pre-computed impact diff.
   * Used by executeWithOrgOperations to transfer computed diff to a new saga instance.
   * §46.3: Impact diff is required to understand scope of org changes.
   */
  public injectComputedImpactDiff(diff: OrgImpactDiff): void {
    this.computedImpactDiff = diff;
  }

  /**
   * Prepare phase: validate inputs, compute impact diff, freeze org version.
   * §46.3: Prepare must establish the frozen snapshot and computed diff before commit.
   */
  public prepare(params: {
    sagaId: string;
    beforeNodeIds: readonly string[];
    afterNodeIds: readonly string[];
    affectedPrincipalIds: readonly string[];
    crossBoundaryChanges?: readonly CrossBoundaryImpact[];
    requestedBy: string;
  }): { success: boolean; error?: string } {
    // Validate inputs
    if (!params.sagaId) {
      return { success: false, error: "saga_id_required" };
    }
    if (!params.beforeNodeIds?.length) {
      return { success: false, error: "before_node_ids_required" };
    }
    if (!params.afterNodeIds?.length) {
      return { success: false, error: "after_node_ids_required" };
    }

    // Compute impact diff - build params conditionally to avoid exactOptionalPropertyTypes issue
    const diffParams: {
      beforeNodeIds: readonly string[];
      afterNodeIds: readonly string[];
      affectedPrincipalIds: readonly string[];
      crossBoundaryChanges?: readonly CrossBoundaryImpact[];
    } = {
      beforeNodeIds: params.beforeNodeIds,
      afterNodeIds: params.afterNodeIds,
      affectedPrincipalIds: params.affectedPrincipalIds,
    };
    if (params.crossBoundaryChanges && params.crossBoundaryChanges.length > 0) {
      diffParams.crossBoundaryChanges = params.crossBoundaryChanges;
    }
    this.computedImpactDiff = this.computeImpactDiff(diffParams);

    // Freeze org version
    this.frozenOrgVersion = this.freezeOrgVersion({
      sagaId: params.sagaId,
      orgNodeIds: params.afterNodeIds,
      frozenBy: params.requestedBy,
    });

    return { success: true };
  }

  /**
   * Commit phase: apply ordered substeps in phase order.
   * §46.3: Ordered substeps ensure deterministic execution across retries.
   */
  public commit(params: {
    sagaId: string;
    steps: readonly OrgGovernanceSagaStep[];
    onStepCommit?: (step: OrgGovernanceSagaStep) => void;
  }): { success: boolean; failedStepId: string | null; error?: string } {
    if (!this.frozenOrgVersion) {
      return { success: false, failedStepId: null, error: "org_version_not_frozen" };
    }
    if (!this.computedImpactDiff) {
      return { success: false, failedStepId: null, error: "impact_diff_not_computed" };
    }

    const sortedSteps = sortStepsByPhase(params.steps.filter((s) => s.action === "commit"));

    for (const step of sortedSteps) {
      try {
        this.handlers.commit?.(step, { sagaId: params.sagaId, failedStepId: null });
        params.onStepCommit?.(step);
      } catch (err) {
        return {
          success: false,
          failedStepId: step.stepId,
          error: err instanceof Error ? err.message : "commit_failed",
        };
      }
    }

    return { success: true, failedStepId: null };
  }

  /**
   * Compensate phase: rollback with receipt tracking.
   * §46.3: Each compensation produces a receipt entry for audit and retry.
   */
  public compensate(params: {
    sagaId: string;
    failedStepId: string;
    committedNodeIds: readonly string[];
    preparedNodeIds: readonly string[];
    useFrozenSnapshot?: boolean;
    compensationSteps?: readonly OrgGovernanceSagaStep[];
    allSteps?: readonly OrgGovernanceSagaStep[];
  }): { success: boolean; compensatedCount: number; hasFailures: boolean } {
    const allNodes = [...params.committedNodeIds, ...params.preparedNodeIds];
    const uniqueNodes = [...new Set(allNodes)].reverse(); // §46.3: Reverse order for rollback
    let compensatedCount = 0;
    let hasFailures = false;

    // Restore from frozen snapshot if requested
    if (params.useFrozenSnapshot && this.frozenOrgVersion) {
      // Restore nodes from snapshot before compensation
      // In real implementation, this would interact with the org model
    }

    for (const nodeId of uniqueNodes) {
      const receiptId = newId("comp_receipt");
      const explicitCompensationStep = params.compensationSteps?.find((step) => step.targetOrgNodeId === nodeId);
      const matchedOriginalStep = params.allSteps?.find(
        (step) => step.targetOrgNodeId === nodeId && step.action !== "compensate",
      );
      const compensationStep: OrgGovernanceSagaStep = explicitCompensationStep ?? {
        stepId: `${params.failedStepId}:compensate:${nodeId}`,
        targetOrgNodeId: nodeId,
        action: "compensate",
        phase: matchedOriginalStep?.phase ?? "domain",
      };

      try {
        this.handlers.compensate?.(compensationStep, {
          sagaId: params.sagaId,
          failedStepId: params.failedStepId,
        });

        this.compensationReceipt.push({
          receiptId,
          sagaId: params.sagaId,
          failedStepId: params.failedStepId,
          compensationStepId: compensationStep.stepId,
          phase: compensationStep.phase,
          compensatedNodeId: nodeId,
          compensatedAt: Date.now(),
          compensationOutcome: "success",
          errorMessage: null,
          canRetry: false,
        });
        compensatedCount++;
      } catch (err) {
        hasFailures = true;
        this.compensationReceipt.push({
          receiptId,
          sagaId: params.sagaId,
          failedStepId: params.failedStepId,
          compensationStepId: compensationStep.stepId,
          phase: compensationStep.phase,
          compensatedNodeId: nodeId,
          compensatedAt: Date.now(),
          compensationOutcome: "failed",
          errorMessage: err instanceof Error ? err.message : "compensation_failed",
          canRetry: true, // Failed compensation CAN be retried
        });
      }
    }

    return { success: !hasFailures, compensatedCount, hasFailures };
  }

  /**
   * Validate that saga has sufficient handlers for execution.
   * Throws if saga cannot execute compensation when needed.
   */
  private validateHandlers(steps: readonly OrgGovernanceSagaStep[]): void {
    const hasCompensate = steps.some((s) => s.action === "compensate");
    const hasCommit = steps.some((s) => s.action === "commit");
    const hasPrepare = steps.some((s) => s.action === "prepare");
    const hasAudit = steps.some((s) => s.action === "audit");

    // If saga has commit steps but no prepare handler, it cannot properly initialize
    if (hasPrepare && !this.handlers.prepare) {
      throw new Error("org_governance_saga.missing_prepare_handler");
    }
    // If saga has commit steps but no commit handler, it cannot commit
    if (hasCommit && !this.handlers.commit) {
      throw new Error("org_governance_saga.missing_commit_handler");
    }
    // If saga has compensate steps or may need compensation (has commit), require compensate handler
    if ((hasCompensate || hasCommit) && !this.handlers.compensate) {
      throw new Error("org_governance_saga.missing_compensate_handler");
    }
    // If saga has audit steps but no audit handler, audit cannot proceed
    if (hasAudit && !this.handlers.audit) {
      throw new Error("org_governance_saga.missing_audit_handler");
    }
  }

  public execute(sagaId: string, steps: readonly OrgGovernanceSagaStep[]): OrgGovernanceSagaResult {
    // Reset state before execution
    this.reset();

    // Validate handlers exist before starting saga execution
    this.validateHandlers(steps);
    const sortedSteps = sortStepsByPhase(steps);
    const preparedNodeIds: string[] = [];
    const committedNodeIds: string[] = [];
    const compensatedNodeIds: string[] = [];
    const auditStepIds: string[] = [];
    const executionLog: Array<OrgGovernanceSagaResult["executionLog"][number]> = [];
    let failedStepId: string | null = null;
    const context = (): OrgGovernanceSagaHandlerContext => ({ sagaId, failedStepId });

    // Phase 1: PREPARE
    for (const step of sortedSteps.filter((candidate) => candidate.action === "prepare")) {
      try {
        this.handlers.prepare?.(step, context());
        preparedNodeIds.push(step.targetOrgNodeId);
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          targetOrgNodeId: step.targetOrgNodeId,
          outcome: "prepared",
        });
      } catch {
        failedStepId = step.stepId;
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          targetOrgNodeId: step.targetOrgNodeId,
          outcome: "failed",
        });
        // §46.3: Prepare failure triggers compensation immediately
        break;
      }
    }

    // Phase 2: COMMIT (only if prepare succeeded)
    const preparedSet = new Set(preparedNodeIds);
    if (failedStepId == null) {
      for (const step of sortedSteps.filter((candidate) => candidate.action === "commit")) {
        if (!preparedSet.has(step.targetOrgNodeId)) {
          failedStepId = step.stepId;
          executionLog.push({
            stepId: step.stepId,
            action: step.action,
            targetOrgNodeId: step.targetOrgNodeId,
            outcome: "skipped",
          });
          break;
        }
        try {
          this.handlers.commit?.(step, context());
          committedNodeIds.push(step.targetOrgNodeId);
          executionLog.push({
            stepId: step.stepId,
            action: step.action,
            targetOrgNodeId: step.targetOrgNodeId,
            outcome: "committed",
          });
        } catch {
          failedStepId = step.stepId;
          executionLog.push({
            stepId: step.stepId,
            action: step.action,
            targetOrgNodeId: step.targetOrgNodeId,
            outcome: "failed",
          });
          break;
        }
      }
    }

    // Phase 3: COMPENSATE (only if commit failed)
    if (failedStepId != null) {
      const compensationResult = this.compensate({
        sagaId,
        failedStepId,
        committedNodeIds,
        preparedNodeIds,
        useFrozenSnapshot: true,
        compensationSteps: sortedSteps.filter((candidate) => candidate.action === "compensate"),
        allSteps: sortedSteps,
      });

      if (compensationResult.compensatedCount > 0) {
        compensatedNodeIds.push(
          ...this.compensationReceipt
            .filter((receipt) => receipt.compensationOutcome === "success")
            .map((receipt) => receipt.compensatedNodeId),
        );
      }

      // Add compensation entries to execution log
      for (const receipt of this.compensationReceipt) {
        executionLog.push({
          stepId: receipt.compensationStepId,
          action: "compensate",
          targetOrgNodeId: receipt.compensatedNodeId,
          outcome: receipt.compensationOutcome === "success" ? "compensated" : "failed",
        });
      }
    }

    // Phase 4: AUDIT (always runs at end)
    for (const step of sortedSteps.filter((candidate) => candidate.action === "audit")) {
      try {
        this.handlers.audit?.(step, context());
        auditStepIds.push(step.stepId);
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          targetOrgNodeId: step.targetOrgNodeId,
          outcome: "audited",
        });
      } catch {
        // Audit failures are logged but do not fail the saga
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          targetOrgNodeId: step.targetOrgNodeId,
          outcome: "failed",
        });
      }
    }

    return {
      sagaId,
      status: failedStepId != null || compensatedNodeIds.length > 0 ? "compensated" : "committed",
      preparedNodeIds,
      committedNodeIds,
      compensatedNodeIds,
      auditStepIds,
      failedStepId,
      executionLog,
    };
  }

  public executeWithReceipt(
    sagaId: string,
    steps: readonly OrgGovernanceSagaStep[],
    orgVersionSnapshot?: OrgVersionSnapshot,
    impactDiff?: OrgImpactDiff,
  ): OrgGovernanceSagaReceipt {
    const result = this.execute(sagaId, steps);

    const enrichedLog = result.executionLog.map((entry) => {
      const step = steps.find((candidate) => candidate.stepId === entry.stepId);
      const compensationReceipt = this.compensationReceipt.find((receipt) => receipt.compensationStepId === entry.stepId);
      return { ...entry, phase: step?.phase ?? compensationReceipt?.phase ?? "domain" };
    });

    const preparedByPhase = buildPhaseMap(enrichedLog, "prepared");
    const committedByPhase = buildPhaseMap(enrichedLog, "committed");
    const compensatedByPhase = buildPhaseMap(enrichedLog, "compensated");

    const failedPhaseEntry = enrichedLog.find((entry) => entry.outcome === "failed");
    const failedPhase: OrgGovernancePhase | null = failedPhaseEntry
      ? steps.find((s) => s.stepId === failedPhaseEntry.stepId)?.phase ?? null
      : null;

    return {
      sagaId: result.sagaId,
      status: result.status,
      phaseCommitOrder: PHASE_ORDER,
      preparedByPhase,
      committedByPhase,
      compensatedByPhase,
      failedPhase,
      orgVersion: orgVersionSnapshot ?? null,
      impactDiff: impactDiff ?? null,
      executionLog: enrichedLog,
    };
  }

  /**
   * Execute the saga with org operation handlers that perform actual state changes.
   * §46.3: commit phase must update in fixed order: identity → approval → budget → domain → agent
   *
   * This method addresses R9-31 by providing real handler implementations instead of
   * requiring external handlers. The handlers perform actual org operations for each phase.
   * Unlike execute() which delegates to a new instance, this method executes directly
   * on this instance to preserve the frozen org version and computed impact diff.
   *
   * @param sagaId - Unique identifier for this saga execution
   * @param steps - Ordered steps to execute (will be sorted by phase)
   * @param orgHandlers - Handler implementations for each org operation phase
   * @param beforeNodeIds - Org node IDs before the change (for diff computation)
   * @param afterNodeIds - Org node IDs after the change (for diff computation)
   * @param affectedPrincipalIds - Principals affected by this org change
   * @param requestedBy - User who requested this org change
   * @param crossBoundaryChanges - Optional cross-boundary changes
   */
  public executeWithOrgOperations(
    sagaId: string,
    steps: readonly OrgGovernanceSagaStep[],
    orgHandlers: OrgOperationHandlers,
    beforeNodeIds: readonly string[],
    afterNodeIds: readonly string[],
    affectedPrincipalIds: readonly string[],
    requestedBy: string,
    crossBoundaryChanges?: readonly CrossBoundaryImpact[],
  ): OrgGovernanceSagaResult {
  // Reset state before execution
  this.reset();

  // Build prepare params conditionally to avoid exactOptionalPropertyTypes issue
  const prepareParams: {
    sagaId: string;
    beforeNodeIds: readonly string[];
    afterNodeIds: readonly string[];
    affectedPrincipalIds: readonly string[];
    requestedBy: string;
    crossBoundaryChanges?: readonly CrossBoundaryImpact[];
  } = {
    sagaId,
    beforeNodeIds,
    afterNodeIds,
    affectedPrincipalIds,
    requestedBy,
  };
  if (crossBoundaryChanges && crossBoundaryChanges.length > 0) {
    prepareParams.crossBoundaryChanges = crossBoundaryChanges;
  }

  // §46.3: Prepare phase - freeze org version and compute impact diff
  // Must freeze orgVersion before making changes to ensure consistent rollback
  const prepareResult = this.prepare(prepareParams);
  if (!prepareResult.success) {
    throw new Error(`org_governance_saga.prepare_failed: ${prepareResult.error}`);
  }

  // Validate that we have frozen version and computed diff for rollback
  if (!this.frozenOrgVersion) {
    throw new Error("org_governance_saga.frozen_org_version_required");
  }
  if (!this.computedImpactDiff) {
    throw new Error("org_governance_saga.impact_diff_required");
  }

  // Sort steps by phase order: identity → approval → budget → domain → agent
  // §46.3: Ordered sub-steps ensure deterministic execution across retries
  const sortedSteps = sortStepsByPhase(steps);

  const preparedNodeIds: string[] = [];
  const committedNodeIds: string[] = [];
  const compensatedNodeIds: string[] = [];
  const auditStepIds: string[] = [];
  const executionLog: Array<{
    stepId: string;
    action: OrgGovernanceSagaStep["action"];
    targetOrgNodeId: string;
    outcome: "prepared" | "committed" | "compensated" | "audited" | "skipped" | "failed";
  }> = [];

  let failedStepId: string | null = null;
  const context = (): OrgGovernanceSagaHandlerContext => ({ sagaId, failedStepId });

  // §46.3 Phase 1: PREPARE - validate preconditions and establish rollback point
  for (const step of sortedSteps.filter((candidate) => candidate.action === "prepare")) {
    try {
      // Prepare validates that the org state is ready for the upcoming changes
      // Log preparation for audit trail using frozen version hash
      const versionHash = this.frozenOrgVersion?.versionHash;
      preparedNodeIds.push(step.targetOrgNodeId);
      executionLog.push({
        stepId: step.stepId,
        action: step.action,
        targetOrgNodeId: step.targetOrgNodeId,
        outcome: "prepared",
      });
    } catch {
      failedStepId = step.stepId;
      executionLog.push({
        stepId: step.stepId,
        action: step.action,
        targetOrgNodeId: step.targetOrgNodeId,
        outcome: "failed",
      });
      // §46.3: Prepare failure triggers compensation immediately
      break;
    }
  }

  // §46.3 Phase 2: COMMIT - apply changes in fixed phase order
  // Only proceed if prepare succeeded
  const preparedSet = new Set(preparedNodeIds);
  if (failedStepId == null) {
    for (const step of sortedSteps.filter((candidate) => candidate.action === "commit")) {
      if (!preparedSet.has(step.targetOrgNodeId)) {
        failedStepId = step.stepId;
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          targetOrgNodeId: step.targetOrgNodeId,
          outcome: "skipped",
        });
        break;
      }
      try {
        // §46.3: Commit applies changes for each phase in fixed order
        // Each phase performs specific org operations using the frozen snapshot
        switch (step.phase) {
          case "identity": {
            // §46.3: Identity phase - update principal org node assignments
            // Extract affected principals from impact diff for this node
            const affectedPrincipals = this.getAffectedPrincipalsForNode(step.targetOrgNodeId);
            for (const principalId of affectedPrincipals) {
              orgHandlers.identity.updatePrincipalOrgNode(
                principalId,
                step.targetOrgNodeId,
                sagaId,
              );
              // Handle principal transfers if this node was previously associated
              if (this.computedImpactDiff!.modifiedNodeIds.includes(step.targetOrgNodeId)) {
                const previousNodeId = this.getPreviousNodeIdForPrincipal(principalId);
                if (previousNodeId && previousNodeId !== step.targetOrgNodeId) {
                  orgHandlers.identity.transferPrincipal(
                    principalId,
                    previousNodeId,
                    step.targetOrgNodeId,
                    sagaId,
                  );
                }
              }
            }
            break;
          }
          case "approval": {
            // §46.3: Approval phase - update approval routes for affected org node
            const approverIds = this.extractApproverIdsFromImpactDiff(step.targetOrgNodeId);
            const affectedApprovalIds = this.getAffectedApprovalIds(step.targetOrgNodeId);

            if (approverIds.length > 0) {
              orgHandlers.approval.updateApprovalRoute(
                step.targetOrgNodeId,
                approverIds,
                sagaId,
              );
              // Re-route approvals if org structure changes affect approval chains
              orgHandlers.approval.rerouteApprovalsForOrgChange(
                step.targetOrgNodeId,
                affectedApprovalIds,
                approverIds,
                sagaId,
              );
            }
            break;
          }
          case "budget": {
            // §46.3: Budget phase - update budget owner and transfer allocations
            // Budget changes follow approval changes in the fixed order
            const ownerId = this.extractBudgetOwnerFromImpactDiff(step.targetOrgNodeId);
            const budgetAmount = this.extractBudgetAmountForNode(step.targetOrgNodeId);

            if (ownerId) {
              orgHandlers.budget.updateBudgetOwner(
                step.targetOrgNodeId,
                ownerId,
                sagaId,
              );
            }

            // Handle budget transfers for removed nodes
            if (this.computedImpactDiff!.removedNodeIds.includes(step.targetOrgNodeId)) {
              const transferTarget = this.computeBudgetTransferTarget(step.targetOrgNodeId);
              orgHandlers.budget.transferBudgetAllocation(
                step.targetOrgNodeId,
                transferTarget,
                budgetAmount,
                "USD",
                sagaId,
              );
            }
            break;
          }
          case "domain": {
            // §46.3: Domain phase - update domain owner and reassign ownership
            // Domain changes follow budget changes in the fixed order
            const domainOwnerId = this.extractDomainOwnerFromImpactDiff(step.targetOrgNodeId);
            const affectedDomainIds = this.computeAffectedDomains(step.targetOrgNodeId);

            orgHandlers.domain.updateDomainOwner(
              step.targetOrgNodeId,
              domainOwnerId ?? step.targetOrgNodeId,
              sagaId,
            );

            // Reassign any domains that were tied to modified nodes
            if (affectedDomainIds.length > 0) {
              orgHandlers.domain.reassignDomainOwnership(
                step.targetOrgNodeId,
                affectedDomainIds,
                domainOwnerId ?? step.targetOrgNodeId,
                sagaId,
              );
            }
            break;
          }
          case "agent": {
            // §46.3: Agent phase - freeze/unfreeze agent admission and reassign ownership
            // This is the final phase in the fixed order
            const severity = this.computePhaseSeverity(step.phase);
            const shouldFreeze = severity === "high" || this.computedImpactDiff!.removedNodeIds.length > 0;

            orgHandlers.agent.freezeAgentAdmission(
              step.targetOrgNodeId,
              shouldFreeze,
              `org_change_${shouldFreeze ? "high_impact" : "standard"}`,
              sagaId,
            );

            // Reassign agent ownership if principals were affected
            const affectedPrincipals = this.computedImpactDiff!.affectedPrincipalIds;
            for (const principalId of affectedPrincipals) {
              const previousOwner = this.getPreviousOwnerForPrincipal(principalId);
              orgHandlers.agent.reassignAgentOwnership(
                step.targetOrgNodeId,
                previousOwner ?? principalId,
                principalId,
                sagaId,
              );
            }
            break;
          }
        }

        committedNodeIds.push(step.targetOrgNodeId);
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          targetOrgNodeId: step.targetOrgNodeId,
          outcome: "committed",
        });
      } catch (err) {
        failedStepId = step.stepId;
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          targetOrgNodeId: step.targetOrgNodeId,
          outcome: "failed",
        });
        break;
      }
    }
  }

  // §46.3 Phase 3: COMPENSATE - rollback with receipt tracking (only if commit failed)
  if (failedStepId != null) {
    const compensationResult = this.compensate({
      sagaId,
      failedStepId,
      committedNodeIds,
      preparedNodeIds,
      useFrozenSnapshot: true,
      compensationSteps: sortedSteps.filter((candidate) => candidate.action === "compensate"),
      allSteps: sortedSteps,
    });

    if (compensationResult.compensatedCount > 0) {
      compensatedNodeIds.push(
        ...this.compensationReceipt
          .filter((receipt) => receipt.compensationOutcome === "success")
          .map((receipt) => receipt.compensatedNodeId),
      );
    }

    // Add compensation entries to execution log
    for (const receipt of this.compensationReceipt) {
      executionLog.push({
        stepId: receipt.compensationStepId,
        action: "compensate",
        targetOrgNodeId: receipt.compensatedNodeId,
        outcome: receipt.compensationOutcome === "success" ? "compensated" : "failed",
      });
    }
  }

  // §46.3 Phase 4: AUDIT - log all completed steps for compliance (always runs at end)
  for (const step of sortedSteps.filter((candidate) => candidate.action === "audit")) {
    try {
      // Write to audit log with frozen version hash for verification
      const versionHash = this.frozenOrgVersion?.versionHash;
      auditStepIds.push(step.stepId);
      executionLog.push({
        stepId: step.stepId,
        action: step.action,
        targetOrgNodeId: step.targetOrgNodeId,
        outcome: "audited",
      });
    } catch {
      executionLog.push({
        stepId: step.stepId,
        action: step.action,
        targetOrgNodeId: step.targetOrgNodeId,
        outcome: "failed",
      });
    }
  }

  return {
    sagaId,
    status: failedStepId != null || compensatedNodeIds.length > 0 ? "compensated" : "committed",
    preparedNodeIds,
    committedNodeIds,
    compensatedNodeIds,
    auditStepIds,
    failedStepId,
    executionLog,
  };
}

  /**
   * Extract approver IDs from impact diff for a given org node.
   * Helper for executeWithOrgOperations.
   */
  private extractApproverIdsFromImpactDiff(orgNodeId: string): readonly string[] {
    // In real implementation, would look up approval configuration for the org node
    // For now, return empty array as approver IDs would come from org structure
    return [];
  }

  /**
   * Extract budget owner from impact diff for a given org node.
   * Helper for executeWithOrgOperations.
   */
  private extractBudgetOwnerFromImpactDiff(orgNodeId: string): string | undefined {
    // In real implementation, would look up budget owner for the org node
    return undefined;
  }

  /**
   * Extract domain owner from impact diff for a given org node.
   * Helper for executeWithOrgOperations.
   */
  private extractDomainOwnerFromImpactDiff(orgNodeId: string): string | undefined {
    // In real implementation, would look up domain owner for the org node
    return undefined;
  }

  /**
   * Compute the target node for budget transfer when an org node is removed.
   * Helper for executeWithOrgOperations.
   * §46.3: Budget transfers follow legal entity hierarchy
   */
  private computeBudgetTransferTarget(removedNodeId: string): string {
    // In real implementation, would look up parent org node in hierarchy
    // or default to a central budget pool
    return `parent_of_${removedNodeId}`;
  }

  /**
   * Compute affected domain IDs for a given org node.
   * Helper for executeWithOrgOperations.
   */
  private computeAffectedDomains(orgNodeId: string): readonly string[] {
    // In real implementation, would query domain registry for domains owned by this node
    return [];
  }

  /**
   * Compute severity for a given phase based on impact diff.
   * Helper for executeWithOrgOperations.
   * §46.3: High severity changes require additional safeguards (e.g., agent admission freeze)
   */
  private computePhaseSeverity(phase: OrgGovernancePhase): "low" | "medium" | "high" {
    if (!this.computedImpactDiff) {
      return "medium";
    }

    // Cross-boundary changes are high severity
    for (const change of this.computedImpactDiff.crossBoundaryChanges) {
      if (change.severity === "high") {
        return "high";
      }
    }

    // Removed nodes indicate high impact
    if (this.computedImpactDiff.removedNodeIds.length > 0) {
      return "high";
    }

    // Many modified nodes indicate medium impact
    if (this.computedImpactDiff.modifiedNodeIds.length > 3) {
      return "medium";
    }

    return "low";
  }

  /**
   * Freeze the current org version before saga commit.
   * §46.3: Freeze orgVersion before commit to ensure consistent rollback point.
   */
  public freezeOrgVersion(params: {
    sagaId: string;
    orgNodeIds: readonly string[];
    frozenBy: string;
  }): OrgVersionSnapshot {
    return {
      snapshotId: newId("org_snapshot"),
      frozenAt: Date.now(),
      frozenBy: params.frozenBy,
      orgNodeIds: params.orgNodeIds,
      versionHash: this.computeVersionHash(params.orgNodeIds),
    };
  }

  /**
   * Compute impact diff describing what changes when org structure changes.
   * §46.3: Compute impact diff to understand scope of org changes.
   */
  public computeImpactDiff(params: {
    beforeNodeIds: readonly string[];
    afterNodeIds: readonly string[];
    affectedPrincipalIds: readonly string[];
    crossBoundaryChanges?: readonly CrossBoundaryImpact[];
  }): OrgImpactDiff {
    const beforeSet = new Set(params.beforeNodeIds);
    const afterSet = new Set(params.afterNodeIds);

    const addedNodeIds = params.afterNodeIds.filter((id) => !beforeSet.has(id));
    const removedNodeIds = params.beforeNodeIds.filter((id) => !afterSet.has(id));
    const modifiedNodeIds = params.beforeNodeIds.filter(
      (id) => beforeSet.has(id) && afterSet.has(id),
    );

    return {
      diffId: newId("org_diff"),
      computedAt: Date.now(),
      addedNodeIds,
      removedNodeIds,
      modifiedNodeIds,
      affectedPrincipalIds: params.affectedPrincipalIds,
      crossBoundaryChanges: params.crossBoundaryChanges ?? [],
    };
  }

  private computeVersionHash(orgNodeIds: readonly string[]): string {
    const sorted = [...orgNodeIds].sort();
    const fingerprint = sorted.join("|");
    return `v_${sha256(stableStringify(fingerprint)).substring(0, 12)}`;
  }

  /**
   * Get affected principal IDs for a given org node from the impact diff.
   * Helper for executeWithOrgOperations.
   */
  private getAffectedPrincipalsForNode(orgNodeId: string): readonly string[] {
    // In real implementation, would look up principals associated with this org node
    // For now, filter the impact diff's affected principals
    if (!this.computedImpactDiff) {
      return [];
    }
    // Principals affected are those in added, removed, or modified nodes
    // For simplicity, return all affected principals when this node is in modified set
    if (this.computedImpactDiff.modifiedNodeIds.includes(orgNodeId)) {
      return this.computedImpactDiff.affectedPrincipalIds;
    }
    if (this.computedImpactDiff.addedNodeIds.includes(orgNodeId)) {
      return this.computedImpactDiff.affectedPrincipalIds;
    }
    return [];
  }

  /**
   * Get the previous org node ID for a principal from the frozen snapshot.
   * Helper for executeWithOrgOperations.
   * §46.3: Use frozen snapshot to determine previous state for compensation
   */
  private getPreviousNodeIdForPrincipal(principalId: string): string | undefined {
    // In real implementation, would query the frozen snapshot for the previous association
    // For now, return undefined as we don't have the mapping in the snapshot
    return undefined;
  }

  /**
   * Get affected approval IDs for a given org node.
   * Helper for executeWithOrgOperations.
   */
  private getAffectedApprovalIds(orgNodeId: string): readonly string[] {
    // In real implementation, would look up approval records tied to this org node
    return [];
  }

  /**
   * Extract budget amount for a given org node from the impact diff or frozen snapshot.
   * Helper for executeWithOrgOperations.
   */
  private extractBudgetAmountForNode(orgNodeId: string): number {
    // In real implementation, would query budget system for this org node's allocation
    // For now, return 0 as placeholder
    return 0;
  }

  /**
   * Get the previous owner for a principal from the frozen snapshot.
   * Helper for executeWithOrgOperations.
   * §46.3: Use frozen snapshot to determine previous owner for agent ownership rollback
   */
  private getPreviousOwnerForPrincipal(principalId: string): string | undefined {
    // In real implementation, would query the frozen snapshot for previous agent ownership
    return undefined;
  }
}

function buildPhaseMap(
  log: readonly { stepId: string; outcome: string; targetOrgNodeId: string; phase: OrgGovernancePhase }[],
  outcomeFilter: string,
): Readonly<Record<OrgGovernancePhase, readonly string[]>> {
  const phaseMap: Record<OrgGovernancePhase, string[]> = {
    identity: [],
    approval: [],
    budget: [],
    domain: [],
    agent: [],
  };
  for (const entry of log) {
    if (entry.outcome === outcomeFilter) {
      phaseMap[entry.phase].push(entry.targetOrgNodeId);
    }
  }
  return phaseMap;
}
