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
    const confirmedTaskSpec = createConfirmedTaskSpec({
      taskDraftId: taskDraft.taskDraftId,
      tenantId: input.tenantId,
      principal: input.principal,
      goal: input.goal,
      inputs: input.inputs ?? {},
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
    const runnable = {
      ...createdRun,
      versionLockId: runVersionLock.runVersionLockId,
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
      policyGuard: {
        allowed: true,
        policyProofRef: input.constraintPackRef,
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
