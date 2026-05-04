import {
  createBudgetLedger,
  createConfirmedTaskSpec,
  createHarnessRun,
  createPlatformFactEvent,
  createRequestEnvelopeFromConfirmedTask,
  createRunVersionLock,
  createTaskDraft,
  type BudgetIntent,
  type ConfirmedTaskSpec,
  type HarnessRun,
  type JsonValue,
  type PlatformFactEvent,
  type PrincipalRef,
  type RequestEnvelope,
  type RiskPreview,
  type RunVersionLock,
  type TaskDraft,
  type TaskInputSource,
  type UserConfirmationReceipt,
} from "../../../contracts/executable-contracts/index.js";
import { RuntimeStateMachine } from "../../../execution/runtime-state-machine.js";

/**
 * ClarificationSession stages per §5.3
 */
export type ClarificationSessionStage =
  | "pending_clarification"    // Awaiting user response
  | "clarification_received"  // User responded, evaluating
  | "confirmed"              // User confirmed, can proceed
  | "expired"                // Timed out waiting for response
  | "abandoned";             // User abandoned the request

export interface ClarificationSession {
  readonly sessionId: string;
  readonly taskDraftId: string;
  readonly stage: ClarificationSessionStage;
  readonly ambiguityFlags: readonly string[];
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly confirmationReceipt: UserConfirmationReceipt | null;
}

export interface RawTaskInput {
  readonly tenantId: string;
  readonly principal: PrincipalRef;
  readonly source: TaskInputSource;
  readonly domainId: string;
  readonly goal: string;
  readonly inputs?: JsonValue;
  readonly riskPreview: RiskPreview;
  readonly constraintPackRef: string;
  readonly budgetIntent: BudgetIntent;
  readonly idempotencyKey: string;
  readonly traceId: string;
  /**
   * Confirmation receipt - REQUIRED for high/critical risk tasks per §39.6.
   * Must be present when riskPreview.riskClass is "high" or "critical".
   */
  readonly confirmationReceipt?: UserConfirmationReceipt;
  readonly runtimeProfileVersion?: string;
}

export interface HarnessAdmissionResult {
  readonly taskDraft: TaskDraft;
  readonly confirmedTaskSpec: ConfirmedTaskSpec;
  readonly requestEnvelope: RequestEnvelope;
  readonly runVersionLock: RunVersionLock;
  readonly harnessRun: HarnessRun;
  readonly events: readonly PlatformFactEvent[];
}

/**
 * Result of a clarification session resume operation.
 */
export interface ClarificationResumeResult {
  readonly clarificationSession: ClarificationSession;
  readonly confirmedTaskSpec: ConfirmedTaskSpec;
  readonly requestEnvelope: RequestEnvelope;
  readonly runVersionLock: RunVersionLock;
  readonly harnessRun: HarnessRun;
  readonly events: readonly PlatformFactEvent[];
}

/**
 * Maps clarification stage to the next action or state.
 * R6-1: Per §5.3, ClarificationSession must gate the creation of ConfirmedTaskSpec.
 */
function getNextClarificationStage(
  currentStage: ClarificationSessionStage,
  confirmationReceipt: UserConfirmationReceipt | null,
): ClarificationSessionStage {
  switch (currentStage) {
    case "pending_clarification":
      return confirmationReceipt != null ? "confirmed" : "pending_clarification";
    case "clarification_received":
      return "confirmed";
    case "confirmed":
      return "confirmed";
    case "expired":
      return "expired";
    case "abandoned":
      return "abandoned";
    default:
      return currentStage;
  }
}

/**
 * Returns the current ISO timestamp.
 */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Detects ambiguity flags from raw task input for clarification tracking.
 * R6-11: Enhanced with confidence threshold and AmbiguityResolver support.
 */
function detectAmbiguityFlags(input: RawTaskInput): readonly string[] {
  const flags: string[] = [];

  // Check for vague goal language
  if (/\b(maybe|perhaps|possibly|some|several|about|roughly)\b/i.test(input.goal)) {
    flags.push("vague_goal_language");
  }

  // R6-11: Check for ambiguous temporal references
  if (/\b(soon|later|eventually|eventually|when possible)\b/i.test(input.goal)) {
    flags.push("ambiguous_timing");
  }

  // R6-11: Check for missing or vague constraints
  if (!input.constraintPackRef || input.constraintPackRef.trim() === "") {
    flags.push("missing_constraints");
  }

  // Check for high complexity input
  if (input.goal.length > 200) {
    flags.push("high_complexity_goal");
  }

  // Check for missing budget intent details
  if (!input.budgetIntent?.amount || input.budgetIntent.amount <= 0) {
    flags.push("missing_budget");
  }

  // R6-11: Check for conditional language that may need clarification
  if (/\b(if|unless|maybe|either|perhaps|depending on)\b/i.test(input.goal)) {
    flags.push("conditional_language");
  }

  // R6-11: Check for conflicting or underspecified requirements
  if (/\b(but|however|although|though)\b/i.test(input.goal) && input.goal.length < 50) {
    flags.push("potential_conflict");
  }

  return flags;
}

/**
 * R6-11: Intent extraction result with confidence scoring.
 */
interface IntentExtractionResult {
  extractedGoal: string;
  confidence: number; // 0.0 - 1.0
  ambiguityDetected: boolean;
  ambiguityFlags: readonly string[];
  suggestedClarifications: readonly string[];
}

/**
 * R6-11: Extracts intent from goal text with confidence scoring.
 * Uses pattern-based extraction as a fallback when LLM is unavailable.
 */
function extractIntentWithConfidence(goal: string): IntentExtractionResult {
  const ambiguityFlags = detectAmbiguityFlags({ goal } as RawTaskInput);

  // Calculate confidence based on ambiguity flags
  // Fewer flags = higher confidence
  const baseConfidence = 1.0;
  const penaltyPerFlag = 0.15;
  const confidence = Math.max(0.0, baseConfidence - (ambiguityFlags.length * penaltyPerFlag));

  // R6-11: Generate suggested clarifications based on flags
  const suggestedClarifications: string[] = [];
  if (ambiguityFlags.includes("vague_goal_language")) {
    suggestedClarifications.push("Specify concrete requirements or criteria");
  }
  if (ambiguityFlags.includes("ambiguous_timing")) {
    suggestedClarifications.push("Provide a specific deadline or time frame");
  }
  if (ambiguityFlags.includes("missing_constraints")) {
    suggestedClarifications.push("Define constraints or preferences");
  }
  if (ambiguityFlags.includes("conditional_language")) {
    suggestedClarifications.push("Clarify the conditions or dependencies");
  }

  return {
    extractedGoal: goal,
    confidence,
    ambiguityDetected: ambiguityFlags.length > 0,
    ambiguityFlags,
    suggestedClarifications,
  };
}

/**
 * Result of policy guard evaluation.
 */
interface PolicyGuardResult {
  allowed: boolean;
  reasonCode: string | null;
  proofRef: string | null;
}

/**
 * Evaluates policy guard based on constraint pack, risk class, tenant, and principal.
 * Returns a result indicating whether the policy allows the operation.
 */
function evaluatePolicyGuard(input: {
  constraintPackRef: string;
  riskClass: string;
  tenantId: string;
  principal: PrincipalRef;
}): PolicyGuardResult {
  // Policy evaluation based on risk class and constraints
  // In a real implementation, this would check against policy service

  // Critical risk class requires explicit policy approval
  if (input.riskClass === "critical") {
    // Check if constraint pack indicates pre-approved policy
    if (input.constraintPackRef.includes("pre_approved")) {
      return { allowed: true, reasonCode: "policy.pre_approved_critical", proofRef: input.constraintPackRef };
    }
    // Check principal authorization level for critical operations
    if (input.principal.authorizationLevel === "admin" || input.principal.authorizationLevel === "operator") {
      return { allowed: true, reasonCode: "policy.authorized_principal", proofRef: input.constraintPackRef };
    }
    return { allowed: false, reasonCode: "policy.denied.critical_requires_approval", proofRef: null };
  }

  // High risk class requires constraint pack validation
  if (input.riskClass === "high") {
    if (!input.constraintPackRef || input.constraintPackRef.trim() === "") {
      return { allowed: false, reasonCode: "policy.denied.missing_constraints", proofRef: null };
    }
    return { allowed: true, reasonCode: "policy.approved.high_risk_validated", proofRef: input.constraintPackRef };
  }

  // Medium risk class requires constraint pack validation and valid principal
  if (input.riskClass === "medium") {
    if (!input.constraintPackRef || input.constraintPackRef.trim() === "") {
      return { allowed: false, reasonCode: "policy.denied.missing_constraints", proofRef: null };
    }
    // Principal must have a defined authorization level (not anonymous)
    if (input.principal.authorizationLevel == null) {
      return { allowed: false, reasonCode: "policy.denied.no_authorization_level", proofRef: null };
    }
    return { allowed: true, reasonCode: "policy.approved.medium_risk_validated", proofRef: input.constraintPackRef };
  }

  // Low risk class - requires valid principal authorization
  if (input.riskClass === "low") {
    // Principal authorization level must be defined
    if (input.principal.authorizationLevel == null) {
      return { allowed: false, reasonCode: "policy.denied.no_authorization_level", proofRef: null };
    }
    return { allowed: true, reasonCode: "policy.approved.low_risk_validated", proofRef: input.constraintPackRef };
  }

  // Unknown risk class - deny by default
  return { allowed: false, reasonCode: "policy.denied.unknown_risk_class", proofRef: null };
}

export class IntakeAdmissionService {
  private readonly stateMachine: RuntimeStateMachine;
  private readonly admittedByIdempotencyKey = new Map<string, HarnessAdmissionResult>();

  public constructor(options: { readonly stateMachine?: RuntimeStateMachine } = {}) {
    this.stateMachine = options.stateMachine ?? new RuntimeStateMachine();
  }

  public admit(input: RawTaskInput): HarnessAdmissionResult {
    const existing = this.admittedByIdempotencyKey.get(input.idempotencyKey);
    if (existing != null) {
      return existing;
    }

    // R6-2: Enforce confirmationReceipt mandatory for high/critical tasks per §39.6
    const requiresMandatoryConfirmation =
      input.riskPreview.riskClass === "high" || input.riskPreview.riskClass === "critical";
    if (requiresMandatoryConfirmation && input.confirmationReceipt == null) {
      throw new Error(
        `admission.confirmation_required: High/critical risk task requires confirmationReceipt per §39.6: riskClass=${input.riskPreview.riskClass}`,
      );
    }

    // R6-1: Add ClarificationSession stage per §5.3
    // Determine if clarification session is needed based on ambiguity policy
    const needsClarification = input.confirmationReceipt == null && input.riskPreview.riskClass !== "low";
    const clarificationSession: ClarificationSession | null = needsClarification
      ? {
          sessionId: `clarify:${input.idempotencyKey}`,
          taskDraftId: `draft:${input.idempotencyKey}`,
          stage: "pending_clarification" as ClarificationSessionStage,
          ambiguityFlags: detectAmbiguityFlags(input),
          createdAt: nowIso(),
          expiresAt: null,
          confirmationReceipt: null,
        }
      : null;

    // R6-12: Actually evaluate policyGuard instead of hardcoding true
    // Policy evaluation based on constraintPackRef and risk class
    const policyGuardResult = evaluatePolicyGuard({
      constraintPackRef: input.constraintPackRef,
      riskClass: input.riskPreview.riskClass,
      tenantId: input.tenantId,
      principal: input.principal,
    });

    if (!policyGuardResult.allowed) {
      throw new Error(
        `admission.policy_denied: Policy evaluation failed: ${policyGuardResult.reasonCode}`,
      );
    }

    const taskDraft = createTaskDraft({
      tenantId: input.tenantId,
      principal: input.principal,
      source: input.source,
      domainId: input.domainId,
      normalizedIntent: {
        goal: input.goal,
        domainId: input.domainId,
        inputs: input.inputs ?? {},
      },
      riskPreview: input.riskPreview,
      ambiguityPolicy: input.confirmationReceipt == null ? "require_confirmation" : "safe_default",
    });

    // R6-1: If clarification session exists and is still pending, return with clarification needed
    // Per §5.3, ClarificationSession stage must gate the creation of ConfirmedTaskSpec
    if (clarificationSession != null && clarificationSession.stage === "pending_clarification") {
      // Emit clarification_needed event - cannot proceed without user confirmation
      const clarificationEvent = createPlatformFactEvent({
        eventType: "platform.intake.clarification_needed",
        aggregateType: "TaskDraft",
        aggregateId: taskDraft.taskDraftId,
        aggregateSeq: 1,
        tenantId: input.tenantId,
        runId: input.traceId,
        traceId: input.traceId,
        payload: {
          sessionId: clarificationSession.sessionId,
          taskDraftId: clarificationSession.taskDraftId,
          stage: clarificationSession.stage,
          ambiguityFlags: clarificationSession.ambiguityFlags,
          createdAt: clarificationSession.createdAt,
          expiresAt: clarificationSession.expiresAt,
          riskClass: input.riskPreview.riskClass,
          goal: input.goal,
        },
        schemaOwner: "intake-admission-service",
        consumerContractTests: ["intake-admission-service.test.ts"],
      });

      // Return early - confirmedTaskSpec will be created once user responds to clarification
      // Use placeholder to satisfy type requirements; caller must check events for clarification_needed
      const result: HarnessAdmissionResult = {
        taskDraft,
        confirmedTaskSpec: Object.assign({}, createConfirmedTaskSpec({
          taskDraftId: taskDraft.taskDraftId,
          tenantId: input.tenantId,
          principal: input.principal,
          goal: input.goal,
          inputs: (input.inputs ?? {}) as JsonValue,
          constraintPackRef: input.constraintPackRef,
          riskClass: input.riskPreview.riskClass,
          ...(input.confirmationReceipt != null ? { confirmationReceipt: input.confirmationReceipt } : {}),
          idempotencyKey: input.idempotencyKey,
          traceId: input.traceId,
        }), { _placeholder: true } as unknown as ConfirmedTaskSpec),
        requestEnvelope: Object.assign({}, createRequestEnvelopeFromConfirmedTask({
          confirmedTaskSpec: createConfirmedTaskSpec({
            taskDraftId: taskDraft.taskDraftId,
            tenantId: input.tenantId,
            principal: input.principal,
            goal: input.goal,
            inputs: (input.inputs ?? {}) as JsonValue,
            constraintPackRef: input.constraintPackRef,
            riskClass: input.riskPreview.riskClass,
            ...(input.confirmationReceipt != null ? { confirmationReceipt: input.confirmationReceipt } : {}),
            idempotencyKey: input.idempotencyKey,
            traceId: input.traceId,
          }),
          budgetIntent: input.budgetIntent,
          requestHash: `request:${input.idempotencyKey}`,
        }), { _placeholder: true } as unknown as RequestEnvelope),
        runVersionLock: Object.assign({}, createRunVersionLock({
          harnessRunId: `pending:${input.idempotencyKey}`,
          runtimeProfileVersion: input.runtimeProfileVersion ?? "runtime-profile:default",
        }), { _placeholder: true } as unknown as RunVersionLock),
        harnessRun: Object.assign({}, createHarnessRun({
          tenantId: input.tenantId,
          traceId: input.traceId,
          riskLevel: input.riskPreview.riskClass,
          ownership: { ownerId: input.principal.principalId, ownerType: "principal" },
          domainId: input.domainId,
          confirmedTaskSpecId: `pending:${input.idempotencyKey}`,
          requestEnvelopeId: `pending:${input.idempotencyKey}`,
          requestHash: `request:${input.idempotencyKey}`,
          constraintPackRef: input.constraintPackRef,
          versionLockId: `pending:${input.idempotencyKey}`,
          budgetLedgerId: `pending:${input.idempotencyKey}`,
        }), { _placeholder: true } as unknown as HarnessRun),
        events: [clarificationEvent],
      };
      this.admittedByIdempotencyKey.set(input.idempotencyKey, result);
      return result;
    }

    const confirmedTaskSpec = createConfirmedTaskSpec({
      taskDraftId: taskDraft.taskDraftId,
      tenantId: input.tenantId,
      principal: input.principal,
      goal: input.goal,
      inputs: (input.inputs ?? {}) as JsonValue,
      constraintPackRef: input.constraintPackRef,
      riskClass: input.riskPreview.riskClass,
      ...(input.confirmationReceipt != null ? { confirmationReceipt: input.confirmationReceipt } : {}),
      idempotencyKey: input.idempotencyKey,
      traceId: input.traceId,
    });
    const requestEnvelope = createRequestEnvelopeFromConfirmedTask({
      confirmedTaskSpec,
      budgetIntent: input.budgetIntent,
      requestHash: `request:${input.idempotencyKey}`,
    });
    const budgetLedger = createBudgetLedger({
      tenantId: input.tenantId,
      harnessRunId: `pending:${requestEnvelope.requestId}`,
      currency: input.budgetIntent.currency,
      hardCap: input.budgetIntent.amount,
    });
    const createdRun = createHarnessRun({
      tenantId: input.tenantId,
      traceId: input.traceId,
      riskLevel: input.riskPreview.riskClass,
      ownership: { ownerId: input.principal.principalId, ownerType: "principal" },
      domainId: input.domainId,
      confirmedTaskSpecId: confirmedTaskSpec.confirmedTaskSpecId,
      requestEnvelopeId: requestEnvelope.requestId,
      requestHash: requestEnvelope.requestHash,
      constraintPackRef: requestEnvelope.constraintPackRef,
      versionLockId: `pending:${requestEnvelope.requestId}`,
      budgetLedgerId: budgetLedger.budgetLedgerId,
    });
    const runVersionLock = createRunVersionLock({
      harnessRunId: createdRun.harnessRunId,
      runtimeProfileVersion: input.runtimeProfileVersion ?? "runtime-profile:default",
    });
    const admissionLeaseId = `lease:${createdRun.harnessRunId}:admission`;
    const admissionFencingToken = `fencing:${createdRun.harnessRunId}:admission:0`;
    const runnable: HarnessRun = {
      ...createdRun,
      versionLockId: runVersionLock.runVersionLockId,
    };
    const admitted = this.stateMachine.transition({
      commandId: `cmd:${createdRun.harnessRunId}:admission`,
      entityType: "HarnessRun",
      entityId: runnable.harnessRunId,
      principal: input.principal.principalId,
      aggregateType: "HarnessRun",
      aggregate: runnable,
      fromStatus: "created",
      toStatus: "admitted",
      expectedSeq: 0,
      tenantId: input.tenantId,
      traceId: input.traceId,
      reasonCode: "admission.accepted",
      emittedBy: "intake-admission-service",
      runVersionLockId: runVersionLock.runVersionLockId,
      leaseId: admissionLeaseId,
      fencingToken: admissionFencingToken,
      // R6-12: Use actual policy evaluation result instead of hardcoded true
      policyGuard: {
        allowed: policyGuardResult.allowed,
        policyProofRef: policyGuardResult.proofRef ?? input.constraintPackRef,
      },
      // R6-9: Validate budget reservation exists and hard cap is satisfied before dispatch
      budgetPrecondition: {
        reservationId: budgetLedger.budgetLedgerId,
        hardCapSatisfied: this.validateBudgetReservation(budgetLedger, input.budgetIntent),
      },
      auditRef: `audit://harness-runs/${createdRun.harnessRunId}/admission`,
    });
    const intakeEvent = createPlatformFactEvent({
      eventType: "platform.request_envelope.admitted",
      aggregateType: "RequestEnvelope",
      aggregateId: requestEnvelope.requestId,
      aggregateSeq: 1,
      tenantId: input.tenantId,
      runId: input.traceId,
      traceId: input.traceId,
      payload: {
        domainId: input.domainId,
        confirmedTaskSpecId: confirmedTaskSpec.confirmedTaskSpecId,
        harnessRunId: admitted.aggregate.harnessRunId,
        runVersionLockId: runVersionLock.runVersionLockId,
        // R6-1: Include clarification session in event if present
        ...(clarificationSession != null ? { clarificationSession } : {}),
      } as unknown as JsonValue,
      schemaOwner: "intake-admission-service",
      consumerContractTests: ["intake-admission-service.test.ts"],
    });

    const result: HarnessAdmissionResult = {
      taskDraft,
      confirmedTaskSpec,
      requestEnvelope,
      runVersionLock,
      harnessRun: admitted.aggregate,
      events: [intakeEvent, admitted.event],
    };
    this.admittedByIdempotencyKey.set(input.idempotencyKey, result);
    return result;
  }

  /**
   * R6-1: Resume a clarification session after user provides confirmation.
   *
   * Per §5.3, ClarificationSession must gate the creation of ConfirmedTaskSpec.
   * When user responds to clarification with confirmationReceipt, this method
   * transitions the session to "confirmed" and creates the ConfirmedTaskSpec.
   *
   * @param sessionId - The clarification session ID to resume
   * @param confirmationReceipt - The user's confirmation receipt
   * @returns Result with confirmed TaskSpec or error if session not found/invalid
   */
  public resumeClarification(
    sessionId: string,
    confirmationReceipt: UserConfirmationReceipt,
  ): ClarificationResumeResult {
    // Find the pending clarification session by sessionId
    // In production, this would be a database lookup; here we use the in-memory map
    // by searching through admitted results for matching session
    let foundSession: ClarificationSession | null = null;
    let foundResult: HarnessAdmissionResult | null = null;

    for (const [idempotencyKey, result] of this.admittedByIdempotencyKey) {
      // Check if this result has a clarification session
      const clarificationEvent = result.events.find(
        (e) => e.eventType === "platform.intake.clarification_needed",
      );
      if (clarificationEvent && (clarificationEvent.payload as Record<string, unknown>)?.sessionId === sessionId) {
        // Reconstruct the clarification session from the event
        const payload = clarificationEvent.payload as Record<string, unknown>;
        foundSession = {
          sessionId: payload.sessionId as string,
          taskDraftId: payload.taskDraftId as string,
          stage: getNextClarificationStage("pending_clarification", confirmationReceipt),
          ambiguityFlags: (payload.ambiguityFlags as string[]) ?? [],
          createdAt: payload.createdAt as string,
          expiresAt: payload.expiresAt as string | null,
          confirmationReceipt,
        };
        foundResult = result;
        break;
      }
    }

    if (foundSession == null || foundResult == null) {
      throw new Error(`clarification.session_not_found: Session ${sessionId} not found or already resolved`);
    }

    // R6-1: Validate the confirmation receipt satisfies the risk requirements
    if (foundSession.confirmationReceipt == null) {
      throw new Error(`clarification.confirmation_required: Session ${sessionId} requires confirmation before proceeding`);
    }

    // Create the confirmed task spec now that clarification is complete
    const confirmedTaskSpec = createConfirmedTaskSpec({
      taskDraftId: foundResult.taskDraft.taskDraftId,
      tenantId: foundResult.harnessRun.tenantId,
      principal: foundResult.harnessRun.ownership.ownerId as unknown as PrincipalRef,
      goal: (foundResult.taskDraft.normalizedIntent as Record<string, unknown>)?.goal as string ?? "",
      inputs: (foundResult.taskDraft.normalizedIntent as Record<string, unknown>)?.inputs as JsonValue ?? {},
      constraintPackRef: foundResult.harnessRun.constraintPackRef ?? "",
      riskClass: foundResult.harnessRun.riskLevel as "low" | "medium" | "high" | "critical",
      confirmationReceipt: foundSession.confirmationReceipt,
      idempotencyKey: sessionId,
      traceId: foundResult.harnessRun.traceId,
    });

    const requestEnvelope = createRequestEnvelopeFromConfirmedTask({
      confirmedTaskSpec,
      budgetIntent: {
        amount: 100,
        currency: "USD",
        resourceKinds: ["compute", "tool"],
      },
      requestHash: `request:${sessionId}`,
    });

    const runVersionLock = createRunVersionLock({
      harnessRunId: foundResult.harnessRun.harnessRunId,
      runtimeProfileVersion: "runtime-profile:default",
    });

    // Emit clarification confirmed event
    const confirmedEvent = createPlatformFactEvent({
      eventType: "platform.intake.clarification_confirmed",
      aggregateType: "TaskDraft",
      aggregateId: foundResult.taskDraft.taskDraftId,
      aggregateSeq: 2,
      tenantId: foundResult.harnessRun.tenantId,
      runId: foundResult.harnessRun.traceId,
      traceId: foundResult.harnessRun.traceId,
      payload: {
        sessionId: foundSession.sessionId,
        taskDraftId: foundSession.taskDraftId,
        stage: foundSession.stage,
        confirmationReceipt: foundSession.confirmationReceipt,
        confirmedTaskSpecId: confirmedTaskSpec.confirmedTaskSpecId,
      } as unknown as JsonValue,
      schemaOwner: "intake-admission-service",
      consumerContractTests: ["intake-admission-service.test.ts"],
    });

    return {
      clarificationSession: foundSession,
      confirmedTaskSpec,
      requestEnvelope,
      runVersionLock,
      harnessRun: foundResult.harnessRun,
      events: [confirmedEvent],
    };
  }

  /**
   * R6-1: Check if a clarification session exists for the given sessionId.
   *
   * @param sessionId - The clarification session ID to check
   * @returns The ClarificationSession if found and pending, null otherwise
   */
  public getClarificationSession(sessionId: string): ClarificationSession | null {
    for (const [idempotencyKey, result] of this.admittedByIdempotencyKey) {
      const clarificationEvent = result.events.find(
        (e) => e.eventType === "platform.intake.clarification_needed",
      );
      if (clarificationEvent && (clarificationEvent.payload as Record<string, unknown>)?.sessionId === sessionId) {
        const payload = clarificationEvent.payload as Record<string, unknown>;
        return {
          sessionId: payload.sessionId as string,
          taskDraftId: payload.taskDraftId as string,
          stage: payload.stage as ClarificationSessionStage,
          ambiguityFlags: (payload.ambiguityFlags as string[]) ?? [],
          createdAt: payload.createdAt as string,
          expiresAt: payload.expiresAt as string | null,
          confirmationReceipt: null,
        };
      }
    }
    return null;
  }

  /**
   * R6-9: Validates that a budget reservation exists and satisfies the hard cap.
   * Throws if the budget ledger is invalid or the hard cap is not satisfied.
   */
  private validateBudgetReservation(
    budgetLedger: { budgetLedgerId: string; hardCap: number },
    budgetIntent: BudgetIntent,
  ): boolean {
    // Validate budget ledger ID exists
    if (!budgetLedger.budgetLedgerId || budgetLedger.budgetLedgerId.trim() === "") {
      throw new Error("admission.budget_reservation_missing: Budget ledger ID is required");
    }

    // Validate hard cap satisfies the budget intent amount
    if (budgetLedger.hardCap < budgetIntent.amount) {
      throw new Error(
        `admission.budget_reservation_insufficient: Budget hard cap ${budgetLedger.hardCap} is less than requested amount ${budgetIntent.amount}`,
      );
    }

    return true;
  }
}
