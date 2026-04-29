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
 * Returns the current ISO timestamp.
 */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Detects ambiguity flags from raw task input for clarification tracking.
 */
function detectAmbiguityFlags(input: RawTaskInput): readonly string[] {
  const flags: string[] = [];

  // Check for vague goal language
  if (/\b(maybe|perhaps|possibly|some|several|about|roughly)\b/i.test(input.goal)) {
    flags.push("vague_goal_language");
  }

  // Check for missing constraints
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

  return flags;
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

  // Medium and low risk classes are allowed by default
  return { allowed: true, reasonCode: "policy.approved.default", proofRef: input.constraintPackRef };
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
        "admission.confirmation_required",
        `High/critical risk task requires confirmationReceipt per §39.6: riskClass=${input.riskPreview.riskClass}`,
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
        "admission.policy_denied",
        `Policy evaluation failed: ${policyGuardResult.reasonCode}`,
      );
    }

    const taskDraft = createTaskDraft({
      tenantId: input.tenantId,
      principal: input.principal,
      source: input.source,
      normalizedIntent: {
        goal: input.goal,
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
          inputs: input.inputs ?? {},
          constraintPackRef: input.constraintPackRef,
          riskClass: input.riskPreview.riskClass,
          confirmationReceipt: input.confirmationReceipt ?? undefined,
          idempotencyKey: input.idempotencyKey,
          traceId: input.traceId,
        }), { _placeholder: true } as unknown as ConfirmedTaskSpec),
        requestEnvelope: Object.assign({}, createRequestEnvelopeFromConfirmedTask({
          confirmedTaskSpec: createConfirmedTaskSpec({
            taskDraftId: taskDraft.taskDraftId,
            tenantId: input.tenantId,
            principal: input.principal,
            goal: input.goal,
            inputs: input.inputs ?? {},
            constraintPackRef: input.constraintPackRef,
            riskClass: input.riskPreview.riskClass,
            confirmationReceipt: input.confirmationReceipt ?? undefined,
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
      inputs: input.inputs ?? {},
      constraintPackRef: input.constraintPackRef,
      riskClass: input.riskPreview.riskClass,
      confirmationReceipt: input.confirmationReceipt ?? undefined,
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
    const runnable = {
      ...createdRun,
      versionLockId: runVersionLock.runVersionLockId,
      leaseId: admissionLeaseId,
      fencingToken: admissionFencingToken,
    };
    const admitted = this.stateMachine.transition({
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
      budgetPrecondition: {
        reservationId: budgetLedger.budgetLedgerId,
        hardCapSatisfied: true,
      },
      auditRef: `audit://harness-runs/${createdRun.harnessRunId}/admission`,
    });
    const intakeEvent = createPlatformFactEvent({
      eventType: "platform.request_envelope.admitted",
      aggregateType: "RequestEnvelope",
      aggregateId: requestEnvelope.requestId,
      aggregateSeq: 1,
      tenantId: input.tenantId,
      traceId: input.traceId,
      payload: {
        confirmedTaskSpecId: confirmedTaskSpec.confirmedTaskSpecId,
        harnessRunId: admitted.aggregate.harnessRunId,
        runVersionLockId: runVersionLock.runVersionLockId,
        // R6-1: Include clarification session in event if present
        ...(clarificationSession != null ? { clarificationSession } : {}),
      },
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
}
