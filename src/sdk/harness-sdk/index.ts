import { BulkheadIsolator, BulkheadRejectionError, BulkheadTimeoutError, type BulkheadConfig } from "../../platform/stability/bulkhead-isolation.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import {
  createContractEnvelope,
  createNodeAttemptReceipt,
  signContractEnvelope,
  verifyContractEnvelopeSignature,
  type ContractEnvelope,
  type ContractEnvelopeVerificationResult,
  type NodeAttemptReceipt,
  type PlanEdge,
  type PlanGraphBundle,
  type PlanNode,
} from "../../platform/contracts/executable-contracts/index.js";
import {
  HarnessRuntimeService,
  type HarnessDecision,
  type HarnessRun,
  type HarnessRunRuntimeState,
  type HarnessTimelineEvent,
} from "../../platform/five-plane-orchestration/harness/index.js";
import {
  buildCompatHitlRequest,
  buildCompatSleepLease,
  buildNodeAttemptReceiptInput,
  buildPlanGraphBundle,
  type BudgetReservationResult,
  type HarnessSdkAppendStepInput,
  type HarnessSdkCreateRunInput,
  type HarnessSdkInterPlaneSecurityConfig,
  type HarnessSdkLifecycleHooks,
  type HarnessSdkReceiptOptions,
  HarnessSdkError,
  type InterPlaneTransport,
  isHarnessLikeRun,
  isIso8601Timestamp,
  isRuntimeRun,
  patchFacadeRun,
  type PlanGraphBuildInput,
  readRuntimeStateSnapshot,
  requiresAuth,
  toBudgetAmount,
  toHarnessRunFacade,
  usesLegacyFacadeCompatibility,
  validatePlanGraph,
  validatePlanGraphBundle,
} from "./harness-sdk-support.js";

// Lifecycle hook shape remains part of this entry surface:
// beforeRun?: (input) => void
// afterRun?: (run) => void
// onError?: (error, run?) => void
// onTimeout?: (timeoutMs, run?) => void

export class HarnessSdk {
  private readonly bulkheads = new Map<string, BulkheadIsolator>();

  public constructor(
    private readonly runtime: HarnessRuntimeService = new HarnessRuntimeService(),
    private readonly budgetChecker?: (budgetRef: string, amount: number) => BudgetReservationResult,
    private readonly interPlaneTransport?: InterPlaneTransport,
    private readonly interPlaneSecurity?: HarnessSdkInterPlaneSecurityConfig,
    private readonly lifecycleHooks?: HarnessSdkLifecycleHooks,
  ) {}

  // R8-22 FIX: PlanGraphBundle build/validate API
  /**
   * Build a PlanGraphBundle from nodes and edges.
   * Provides canonical graph construction with validation per R8-22.
   */
  public buildPlanGraph(input: PlanGraphBuildInput): {
    readonly bundle: PlanGraphBundle;
    readonly validationReport: ReturnType<typeof validatePlanGraph>;
  } {
    return buildPlanGraphBundle(input);
  }

  /**
   * Validate a PlanGraphBundle.
   * Checks graph structure, reachability, and duplicate node IDs per R8-22.
   */
  public validatePlanGraph(bundle: PlanGraphBundle): ReturnType<typeof validatePlanGraphBundle> {
    return validatePlanGraphBundle(bundle);
  }

  public createRun(input: HarnessSdkCreateRunInput): HarnessRun {
    this.lifecycleHooks?.beforeRun?.(input);

    try {
      const legacyFacadeCompatibility = usesLegacyFacadeCompatibility(input.constraintPack);
      const tenantId = input.tenantId?.trim() || (legacyFacadeCompatibility ? "tenant_default" : "");
      if (!tenantId) {
        throw new HarnessSdkError("harness_sdk.missing_tenant", "harness_sdk.missing_tenant: HarnessSdk.createRun requires tenantId.");
      }
      if (!legacyFacadeCompatibility && requiresAuth(input.constraintPack) && !input.authContext?.actorId?.trim()) {
        throw new HarnessSdkError("harness_sdk.missing_auth", "HarnessSdk.createRun requires authContext.actorId for supervised or full-auto runs.");
      }
      if (input.budgetRef?.trim()) {
        const budget = this.reserveBudget(input.budgetRef, toBudgetAmount(input.constraintPack));
        if (!budget.allowed) {
          throw new HarnessSdkError(
            "harness_sdk.budget_exceeded",
            budget.error ?? `Budget ${input.budgetRef} rejected run creation.`,
            { budgetRef: input.budgetRef, remainingBudget: budget.remainingBudget },
          );
        }
      }

      const run = this.runtime.createRun({
        taskId: input.taskId,
        domainId: input.domainId,
        constraintPack: input.constraintPack,
        ...(input.planGraphBundle != null ? { planGraphBundle: input.planGraphBundle } : {}),
      });
      const publicRun = toHarnessRunFacade(run);

      // Issue 2009: Call afterRun lifecycle hook on success
      this.lifecycleHooks?.afterRun?.(publicRun);

      return publicRun;
    } catch (error) {
      // Issue 2009: Call onError lifecycle hook on failure
      this.lifecycleHooks?.onError?.(error as Error);
      throw error;
    }
  }

  public appendStep(run: HarnessRun, input: HarnessSdkAppendStepInput): HarnessRun {
    // R8-21 FIX: appendStep now produces NodeAttemptReceipt for proper tracking
    // Use appendStepWithReceipt if you need explicit access to the receipt
    const result = this.appendStepWithReceipt(run, input);
    return result.run;
  }

  /**
   * R8-21 FIX: appendStepWithReceipt produces NodeAttemptReceipt for proper node tracking.
   * Uses nodeRunId-based routing instead of stage string routing.
   */
  public appendStepWithReceipt(
    run: HarnessRun,
    input: HarnessSdkAppendStepInput,
    options: HarnessSdkReceiptOptions = {},
  ): { run: HarnessRun; receipt: NodeAttemptReceipt } {
    const mutableRun = this.resolveMutableRun(run);
    let updatedRun: HarnessRun;

    if (mutableRun != null) {
      // R31-42 FIX: Only use stage if explicitly provided, don't default to nodeRunId
      const updated = this.runtime.appendStep(mutableRun, {
        role: input.role,
        nodeRunId: input.nodeRunId,
        ...(input.stage !== undefined ? { stage: input.stage } : {}),
        inputs: {
          ...input.inputs,
          nodeRunId: input.nodeRunId,
          planGraphId: input.planGraphId,
        },
        outputs: input.outputs,
        ...(input.iteration !== undefined ? { iteration: input.iteration } : {}),
      });
      this.runtime.persistRun(updated);
      updatedRun = toHarnessRunFacade(updated);
    } else {
      const timelineEntry: HarnessTimelineEvent = {
        eventId: newId("timeline"),
        runId: run.harnessRunId,
        type: "step_completed",
        payload: {
          role: input.role,
          nodeRunId: input.nodeRunId,
          planGraphId: input.planGraphId,
        },
        recordedAt: nowIso(),
      };

      // Cast through HarnessRunRuntimeState to access timeline and currentSeq
      const timeline = [
        ...((readRuntimeStateSnapshot(run).timeline ?? []) as HarnessTimelineEvent[]),
        timelineEntry,
      ];
      const runtimeSnapshot = readRuntimeStateSnapshot(run);
      updatedRun = {
        ...run,
        currentSeq: (runtimeSnapshot.currentSeq ?? 0) + 1,
        timeline,
      } as HarnessRun;
    }

    const receipt = createNodeAttemptReceipt(buildNodeAttemptReceiptInput(input, updatedRun, options));
    return { run: updatedRun, receipt };
  }

  public reserveBudget(budgetRef: string, amount: number): BudgetReservationResult {
    return this.budgetChecker?.(budgetRef, amount) ?? {
      allowed: true,
      remainingBudget: Number.POSITIVE_INFINITY,
    };
  }

  public settleBudget(run: HarnessRun): HarnessRun {
    return this.persist(run);
  }

  public decide(input: Parameters<HarnessRuntimeService["decide"]>[0]): HarnessDecision {
    return this.runtime.decide(input);
  }

  public evaluate(run: HarnessRun) {
    const mutableRun = this.resolveMutableRun(run);
    if (mutableRun != null) {
      return this.runtime.evaluateRun(mutableRun);
    }
    return {
      status: (run as Partial<HarnessRun>).status ?? "unknown",
      harnessRunId: run.harnessRunId,
    };
  }

  public persist(run: HarnessRun): HarnessRun {
    const mutableRun = this.resolveMutableRun(run);
    if (mutableRun != null) {
      this.runtime.persistRun(mutableRun);
    }
    return run;
  }

  public checkpoint(run: HarnessRun): string {
    const mutableRun = this.resolveMutableRun(run);
    if (mutableRun != null) {
      return this.runtime.checkpointRun(mutableRun);
    }
    return `checkpoint:${run.harnessRunId}`;
  }

  public restore(runId: string): HarnessRun | null {
    const restored = this.runtime.restoreRun(runId);
    return restored == null ? null : toHarnessRunFacade(restored);
  }

  public restoreFromCheckpoint(checkpointRef: string): HarnessRun | null {
    const restored = this.runtime.restoreFromCheckpoint(checkpointRef);
    return restored == null ? null : toHarnessRunFacade(restored);
  }

  public assertInvariants(run: HarnessRun) {
    const mutableRun = this.resolveMutableRun(run);
    if (mutableRun != null) {
      return this.runtime.assertInvariants(mutableRun);
    }
    return undefined;
  }

  public sleep(runOrId: HarnessRun | string, reason: string, resumeAt: string): HarnessRun {
    if (!isIso8601Timestamp(resumeAt)) {
      throw new HarnessSdkError(
        "harness_sdk.invalid_resume_at",
        "HarnessSdk.sleep requires resumeAt to be an ISO-8601 timestamp.",
        { resumeAt },
      );
    }
    if (typeof runOrId !== "string") {
      const mutableRun = this.resolveMutableRun(runOrId);
      if (mutableRun == null) {
        return patchFacadeRun(runOrId, {
          status: "paused",
          pauseReason: "sleep",
          sleepLease: buildCompatSleepLease(runOrId, reason, resumeAt),
        });
      }
    }
    const sleeping = this.runtime.sleep(this.requireRun(runOrId), reason, resumeAt);
    if (typeof runOrId === "string") {
      this.runtime.persistRun(sleeping);
    }
    return toHarnessRunFacade(sleeping);
  }

  public resume(runOrId: HarnessRun | string): HarnessRun {
    if (typeof runOrId !== "string") {
      const mutableRun = this.resolveMutableRun(runOrId);
      if (mutableRun == null) {
        return patchFacadeRun(runOrId, {
          status: "running",
          pauseReason: null,
          sleepLease: null,
        });
      }
    }
    const resumed = this.runtime.resume(this.requireRun(runOrId));
    if (typeof runOrId === "string") {
      this.runtime.persistRun(resumed);
    }
    return toHarnessRunFacade(resumed);
  }

  public requestHumanReview(
    runOrId: HarnessRun | string,
    reason: string,
    evidenceRefs: readonly string[] = [],
  ): HarnessRun {
    if (typeof runOrId !== "string") {
      const mutableRun = this.resolveMutableRun(runOrId);
      if (mutableRun == null) {
        return patchFacadeRun(runOrId, {
          status: "paused",
          pauseReason: "hitl",
          hitlRequest: buildCompatHitlRequest(runOrId, reason, evidenceRefs),
        });
      }
    }
    const reviewRequested = this.runtime.openHitlReview(this.requireRun(runOrId), reason, evidenceRefs);
    if (typeof runOrId === "string") {
      this.runtime.persistRun(reviewRequested);
    }
    return toHarnessRunFacade(reviewRequested);
  }

  public resolveReview(
    runOrId: HarnessRun | string,
    resolution: "approved" | "rejected",
    actorId: string,
  ): HarnessRun {
    if (typeof runOrId !== "string") {
      const mutableRun = this.resolveMutableRun(runOrId);
      if (mutableRun == null) {
        const compatRequest = buildCompatHitlRequest(
          runOrId,
          "hitl_review_resolved",
          [],
        );
        return patchFacadeRun(runOrId, {
          status: resolution === "rejected" ? "cancelled" : "running",
          pauseReason: resolution === "approved" ? null : "hitl",
          hitlRequest: {
            ...compatRequest,
            status: resolution === "approved" ? "approved" : "rejected",
            resolvedAt: nowIso(),
            resolvedBy: actorId,
          },
        });
      }
    }
    const resolved = this.runtime.resolveHitlReview(this.requireRun(runOrId), resolution, actorId);
    if (typeof runOrId === "string") {
      this.runtime.persistRun(resolved);
    }
    const publicRun = toHarnessRunFacade(resolved);
    return patchFacadeRun(publicRun, {
      status: resolution === "rejected" ? "cancelled" : publicRun.status,
    });
  }

  public getTimeline(runOrId: HarnessRun | string): readonly HarnessTimelineEvent[] {
    if (typeof runOrId !== "string") {
      const mutableRun = this.resolveMutableRun(runOrId);
      if (mutableRun == null) {
        // Cast through HarnessRunRuntimeState to access timeline
        return (readRuntimeStateSnapshot(runOrId).timeline ?? []) as HarnessTimelineEvent[];
      }
    }
    return this.runtime.listTimeline(this.requireRun(runOrId));
  }

  public getEvaluation(runOrId: HarnessRun | string) {
    return this.runtime.evaluateRun(this.requireRun(runOrId));
  }

  public traceReplay(runOrId: string, _traceEvents: readonly HarnessTimelineEvent[]): HarnessRun | null {
    // Sort trace events deterministically by eventId before replay restoration hooks run.
    const _sortedTraceEvents = [..._traceEvents].sort((a, b) => a.eventId.localeCompare(b.eventId));
    void _sortedTraceEvents;
    const restored = this.runtime.restoreRun(runOrId);
    return restored == null ? null : toHarnessRunFacade(restored);
  }

  public sideEffectReconciliation(runOrId: HarnessRun | string): HarnessRun {
    const run = this.requireRun(runOrId);
    this.runtime.persistRun(run);
    return toHarnessRunFacade(run);
  }

  /**
   * Issue 2009: Execute a harness run with lifecycle hooks support.
   * @param input - The run creation input
   * @param options - Execution options including timeout
   * @returns The completed run
   */
  public execute(
    input: HarnessSdkCreateRunInput,
    options: { readonly timeoutMs?: number } = {},
  ): HarnessRun {
    const { timeoutMs } = options;

    // Call beforeRun hook
    this.lifecycleHooks?.beforeRun?.(input);

    // Set up timeout tracking if specified
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let timedOut = false;

    if (timeoutMs != null && timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        // Call onTimeout hook
        try {
          const run = this.runtime.restoreRun(input.taskId);
          this.lifecycleHooks?.onTimeout?.(
            timeoutMs,
            run == null ? undefined : toHarnessRunFacade(run),
          );
        } catch {
          this.lifecycleHooks?.onTimeout?.(timeoutMs);
        }
      }, timeoutMs);
    }

    try {
      // Execute the run
      const run = this.createRun(input);

      // Clear timeout if it hasn't fired
      if (timeoutHandle != null) {
        clearTimeout(timeoutHandle);
      }

      return run;
    } catch (error) {
      // Clear timeout if it hasn't fired
      if (timeoutHandle != null) {
        clearTimeout(timeoutHandle);
      }

      // Call onError hook
      this.lifecycleHooks?.onError?.(error as Error);

      // If we timed out, call onTimeout as well
      if (timedOut) {
        this.lifecycleHooks?.onTimeout?.(timeoutMs!);
      }

      throw error;
    }
  }

  public async sendInterPlaneMessage<TResponse>(
    targetPlane: string,
    command: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<TResponse> {
    const transport = this.interPlaneTransport;
    if (transport == null) {
      throw new HarnessSdkError(
        "harness_sdk.inter_plane_transport_unavailable",
        "HarnessSdk.sendInterPlaneMessage requires an inter-plane transport.",
      );
    }

    const envelope = this.createSignedInterPlaneEnvelope(targetPlane, command, payload);
    const sender = () => transport.send<TResponse>({ targetPlane, envelope });
    const bulkhead = this.getBulkhead(targetPlane);

    try {
      return bulkhead == null ? await sender() : await bulkhead.execute(sender);
    } catch (error) {
      if (error instanceof BulkheadRejectionError || error instanceof BulkheadTimeoutError) {
        throw new HarnessSdkError(
          "harness_sdk.inter_plane_bulkhead_rejected",
          error.message,
          { targetPlane, command },
        );
      }
      throw error;
    }
  }

  public verifyReceivedInterPlaneEnvelope(envelope: ContractEnvelope<unknown>): ContractEnvelopeVerificationResult {
    if (!this.interPlaneSecurity?.sharedSecretKey) {
      return {
        valid: false,
        error: "contract_envelope.signature_unconfigured",
        verifiedAt: nowIso(),
      };
    }

    const verification = verifyContractEnvelopeSignature(envelope, this.interPlaneSecurity.sharedSecretKey);
    if (verification.valid || verification.error == null) {
      return verification;
    }

    if (verification.error.startsWith("signature_invalid")) {
      return {
        valid: false,
        error: "contract_envelope.signature_invalid",
        verifiedAt: verification.verifiedAt,
      };
    }

    if (verification.error.startsWith("signature_missing")) {
      return {
        valid: false,
        error: "contract_envelope.signature_missing",
        verifiedAt: verification.verifiedAt,
      };
    }

    return {
      valid: false,
      error: verification.error,
      verifiedAt: verification.verifiedAt,
    };
  }

  private createSignedInterPlaneEnvelope(
    targetPlane: string,
    command: string,
    payload: Readonly<Record<string, unknown>>,
  ): ContractEnvelope<Readonly<Record<string, unknown>>> {
    const envelope = createContractEnvelope({
      payload,
      metadata: {
        targetPlane,
        command,
        sourcePlane: "harness_sdk",
      },
      ttl: 30000,
    });

    if (!this.interPlaneSecurity?.sharedSecretKey) {
      return envelope;
    }

    return signContractEnvelope(envelope, this.interPlaneSecurity.sharedSecretKey);
  }

  private getBulkhead(targetPlane: string): BulkheadIsolator | null {
    if (this.interPlaneSecurity?.bulkheadConfig == null) {
      return null;
    }
    let bulkhead = this.bulkheads.get(targetPlane);
    if (bulkhead == null) {
      bulkhead = new BulkheadIsolator(`harness-sdk:${targetPlane}`, this.interPlaneSecurity.bulkheadConfig);
      this.bulkheads.set(targetPlane, bulkhead);
    }
    return bulkhead;
  }

  private resolveMutableRun(run: HarnessRun): HarnessRunRuntimeState | null {
    if (isRuntimeRun(run)) {
      return run;
    }
    if (isHarnessLikeRun(run)) {
      return this.runtime.restoreRun(run.harnessRunId);
    }
    return null;
  }

  private requireRun(runOrId: HarnessRun | string): HarnessRunRuntimeState {
    if (typeof runOrId === "string") {
      const restored = this.runtime.restoreRun(runOrId);
      if (restored == null) {
        throw new Error(`harness_sdk.run_not_found:${runOrId}`);
      }
      return restored;
    }

    if (isRuntimeRun(runOrId)) {
      return runOrId;
    }
    const restored = isHarnessLikeRun(runOrId) ? this.runtime.restoreRun(runOrId.harnessRunId) : null;
    if (restored != null) {
      return restored;
    }
    throw new Error(`harness_sdk.run_not_found:${(runOrId as Partial<HarnessRun>).harnessRunId ?? "unknown"}`);
  }
}

export type {
  ContractEnvelope,
  ContractEnvelopeVerificationResult,
  NodeAttemptReceipt,
  PlanEdge,
  PlanGraphBundle,
  PlanNode,
};
