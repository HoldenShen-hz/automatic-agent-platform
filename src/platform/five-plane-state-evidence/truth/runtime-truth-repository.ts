import { createHash } from "node:crypto";
import { ValidationError, WorkflowStateError } from "../../contracts/errors.js";
import { newId } from "../../contracts/types/ids.js";
import type { EvidenceRecord } from "../../contracts/types/platform-contracts.js";
import {
  type BudgetLedger,
  type BudgetReservation,
  type HarnessRun,
  type NodeAttemptReceipt,
  type NodeRun,
  type PlatformFactEvent,
  type RunVersionLock,
  type SideEffectRecord,
} from "../../contracts/executable-contracts/index.js";
import {
  RuntimeStateMachine,
  type RuntimeStateAggregate,
  type RuntimeStateAggregateType,
  type RuntimeTransitionCommand,
  type RuntimeTransitionResult,
} from "../../shared/runtime-state-machine.js";
import type { RuntimeStatus } from "../../shared/runtime-state-machine-model.js";

/** R11-12: Snapshot version for CAS operations */
export interface SnapshotVersion {
  readonly versionId: string;
  readonly version: number;
  readonly stateHash: string;
  readonly createdAt: string;
}

/** R11-12: CAS operation result */
export interface CasResult<TAggregate> {
  readonly success: boolean;
  readonly aggregate?: TAggregate;
  readonly expectedVersion?: number;
  readonly actualVersion?: number;
  readonly expectedProtectionHash?: string;
  readonly actualProtectionHash?: string;
}

export interface RuntimeTruthRepositorySnapshot {
  readonly harnessRuns: readonly HarnessRun[];
  readonly nodeRuns: readonly NodeRun[];
  readonly sideEffects: readonly SideEffectRecord[];
  readonly budgetLedgers: readonly BudgetLedger[];
  readonly budgetReservations: readonly BudgetReservation[];
  readonly nodeAttemptReceipts: readonly NodeAttemptReceipt[];
  readonly runVersionLocks: readonly RunVersionLock[];
  readonly events: readonly PlatformFactEvent[];
  readonly outbox: readonly PlatformFactEvent[];
  readonly auditRefs: readonly string[];
  readonly version: number;
  readonly createdAt: string;
  /** R11-12: Snapshot metadata with versioning */
  readonly snapshotVersion: SnapshotVersion;
}

export interface RuntimeRepository {
  seed(aggregateType: RuntimeStateAggregateType, aggregate: RuntimeStateAggregate): void;
  transition<TAggregate extends RuntimeStateAggregate>(
    command: RuntimeTransitionCommand<TAggregate>,
  ): RuntimeTransitionResult<TAggregate>;
  appendNodeAttemptReceipt(receipt: NodeAttemptReceipt): void;
  appendRunVersionLock(lock: RunVersionLock): void;
  appendEvidenceRecord(record: EvidenceRecord): void;
  snapshot(): RuntimeTruthRepositorySnapshot;
  /**
   * R24-34: Replay events to rebuild aggregate state from event store.
   * This enables event-sourced reconstruction of aggregates from their event history.
   * Events are processed in sequence; each event's status change is applied to
   * reconstruct the current aggregate state.
   *
   * @param events - Sorted list of PlatformFactEvents to replay
   */
  replayEvents(events: readonly PlatformFactEvent[]): void;
}

interface RuntimeTruthRepositoryState {
  readonly harnessRuns: Map<string, HarnessRun>;
  readonly nodeRuns: Map<string, NodeRun>;
  readonly sideEffects: Map<string, SideEffectRecord>;
  readonly budgetLedgers: Map<string, BudgetLedger>;
  readonly budgetReservations: Map<string, BudgetReservation>;
  readonly nodeAttemptReceipts: Map<string, NodeAttemptReceipt>;
  readonly runVersionLocks: Map<string, RunVersionLock>;
  readonly events: PlatformFactEvent[];
  readonly outbox: PlatformFactEvent[];
  readonly auditRefs: string[];
  readonly eventSequenceByAggregate: Map<string, number>;
  /** R11-12: Current snapshot version for CAS */
  snapshotVersion: number;
  transactionCounter: number;
  fencingCounter: number;
}

interface TransactionContext {
  readonly undoOperations: Array<() => void>;
}

const MAX_CONTENTION_RETRIES = 3;
const CONTENTION_BACKOFF_MS = [1, 5, 10] as const;
const RETRYABLE_CONTENTION_CODES = new Set([
  "runtime_truth_repository.lease_fencing_required",
  "runtime_truth_repository.stale_lease_id",
  "runtime_truth_repository.stale_fencing_token",
  "runtime_state_machine.lease_and_fencing_required",
  "runtime_state_machine.lease_mismatch",
  "runtime_state_machine.fencing_token_mismatch",
  "runtime_state_machine.harness_fencing_required",
  "runtime_state_machine.harness_fencing_token_mismatch",
  "runtime_state_machine.side_effect_fencing_required",
  "runtime_state_machine.side_effect_lease_mismatch",
  "runtime_state_machine.side_effect_fencing_token_mismatch",
]);

function sleepMs(durationMs: number): void {
  if (durationMs <= 0) {
    return;
  }
  const shared = new SharedArrayBuffer(4);
  const buffer = new Int32Array(shared);
  Atomics.wait(buffer, 0, 0, durationMs);
}

function isRetryableRuntimeContentionError(error: unknown): error is ValidationError | WorkflowStateError {
  return (
    (error instanceof ValidationError || error instanceof WorkflowStateError)
    && RETRYABLE_CONTENTION_CODES.has(error.code)
  );
}

export class RuntimeTruthRepository implements RuntimeRepository {
  private state: RuntimeTruthRepositoryState = createEmptyState();
  private readonly stateMachine: RuntimeStateMachine;
  private activeTransaction: TransactionContext | null = null;

  public constructor(options: { readonly stateMachine?: RuntimeStateMachine } = {}) {
    this.stateMachine = options.stateMachine ?? new RuntimeStateMachine({ persistEvent: () => undefined });
  }

  public seed(aggregateType: RuntimeStateAggregateType, aggregate: RuntimeStateAggregate): void {
    this.storeAggregate(aggregateType, aggregate);
  }

  /**
   * R11-12: CAS (Compare-And-Swap) upsert with version checking
   * Ensures atomic updates by verifying expected version before committing
   */
  public upsertWithCas<TAggregate extends RuntimeStateAggregate>(params: {
    aggregateType: RuntimeStateAggregateType;
    aggregateId: string;
    aggregate: TAggregate;
    expectedVersion: number;
    expectedProtectionHash?: string;
  }): CasResult<TAggregate> {
    const currentVersion = this.getAggregateVersion(params.aggregateType, params.aggregateId);
    const currentAggregate = this.getAggregate(params.aggregateType, params.aggregateId);
    const currentProtectionHash = currentAggregate == null
      ? null
      : computeAggregateProtectionHash(params.aggregateType, currentAggregate);
    const nextProtectionHash = computeAggregateProtectionHash(params.aggregateType, params.aggregate);

    if (currentVersion !== null && currentVersion !== params.expectedVersion) {
      return {
        success: false,
        expectedVersion: params.expectedVersion,
        actualVersion: currentVersion,
      };
    }

    if (
      currentProtectionHash != null
      && nextProtectionHash != null
      && currentProtectionHash !== nextProtectionHash
      && params.expectedProtectionHash !== currentProtectionHash
    ) {
      return {
        success: false,
        expectedVersion: params.expectedVersion,
        ...(currentVersion != null ? { actualVersion: currentVersion } : {}),
        ...(params.expectedProtectionHash != null ? { expectedProtectionHash: params.expectedProtectionHash } : {}),
        actualProtectionHash: currentProtectionHash,
      };
    }

    this.storeAggregate(params.aggregateType, params.aggregate);
    return {
      success: true,
      aggregate: params.aggregate,
    };
  }

  /**
   * R11-12: Get the current version of an aggregate
   */
  public getAggregateVersion(aggregateType: RuntimeStateAggregateType, aggregateId: string): number | null {
    const aggregate = this.getAggregate(aggregateType, aggregateId);
    if (aggregate == null) return null;

    switch (aggregateType) {
      case "HarnessRun":
        return (aggregate as HarnessRun).currentSeq ?? 0;
      case "NodeRun":
        return (aggregate as NodeRun).currentSeq ?? 0;
      case "BudgetLedger":
        return (aggregate as BudgetLedger).version;
      case "BudgetReservation":
        return 0; // Reservations don't have sequential versions
      default:
        return 0;
    }
  }

  public getAggregateProtectionHash(
    aggregateType: RuntimeStateAggregateType,
    aggregateId: string,
  ): string | null {
    const aggregate = this.getAggregate(aggregateType, aggregateId);
    if (aggregate == null) {
      return null;
    }
    return computeAggregateProtectionHash(aggregateType, aggregate);
  }

  /**
   * R11-12: Verify state integrity using hash comparison
   */
  public verifyStateIntegrity(expectedHash: string): boolean {
    const currentHash = this.computeStateHash();
    return currentHash === expectedHash;
  }

  /**
   * R11-12: Compute hash of current state for integrity verification
   */
  private computeStateHash(): string {
    const normalizedState = {
      harnessRuns: [...this.state.harnessRuns.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      nodeRuns: [...this.state.nodeRuns.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      sideEffects: [...this.state.sideEffects.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      budgetLedgers: [...this.state.budgetLedgers.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      budgetReservations: [...this.state.budgetReservations.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    };

    const stateJson = JSON.stringify(normalizedState);
    return createHash("sha256").update(stateJson).digest("hex");
  }

  public transition<TAggregate extends RuntimeStateAggregate>(
    command: RuntimeTransitionCommand<TAggregate>,
  ): RuntimeTransitionResult<TAggregate> {
    for (let attempt = 0; attempt <= MAX_CONTENTION_RETRIES; attempt += 1) {
      try {
        return this.transitionOnce(command);
      } catch (error) {
        if (!isRetryableRuntimeContentionError(error) || attempt >= MAX_CONTENTION_RETRIES) {
          if (isRetryableRuntimeContentionError(error) && attempt >= MAX_CONTENTION_RETRIES) {
            throw new ValidationError(
              "runtime_truth_repository.contention_retry_exhausted",
              "Runtime truth repository contention retry budget exhausted.",
              {
                details: {
                  aggregateType: command.aggregateType,
                  aggregateId: getAggregateId(command.aggregateType, command.aggregate),
                  attempts: attempt + 1,
                  causeCode: error.code,
                },
                cause: error,
              },
            );
          }
          throw error;
        }
        sleepMs(CONTENTION_BACKOFF_MS[attempt] ?? CONTENTION_BACKOFF_MS[CONTENTION_BACKOFF_MS.length - 1]!);
      }
    }
    throw new ValidationError(
      "runtime_truth_repository.contention_retry_exhausted",
      "Runtime truth repository contention retry budget exhausted.",
    );
  }

  private transitionOnce<TAggregate extends RuntimeStateAggregate>(
    command: RuntimeTransitionCommand<TAggregate>,
  ): RuntimeTransitionResult<TAggregate> {
    return this.transaction(() => {
      // R5-44: Lease/fencing validation for HarnessRun transitions
      if (command.aggregateType === "HarnessRun") {
        const harnessRun = command.aggregate as HarnessRun;
        const currentRun = this.getHarnessRun(harnessRun.harnessRunId);
        if (currentRun) {
          if (currentRun.leaseId != null && (command.leaseId == null || command.fencingToken == null)) {
            throw new ValidationError(
              "runtime_truth_repository.lease_fencing_required",
              `HarnessRun ${harnessRun.harnessRunId} requires the active lease and fencing token`,
              { details: { harnessRunId: harnessRun.harnessRunId } },
            );
          }
          if (currentRun.leaseId != null && command.leaseId !== currentRun.leaseId) {
            throw new ValidationError(
              "runtime_truth_repository.stale_lease_id",
              `HarnessRun ${harnessRun.harnessRunId} has an active lease held by another process`,
              { details: { harnessRunId: harnessRun.harnessRunId, expectedLease: currentRun.leaseId, actualLease: command.leaseId } },
            );
          }
          if (currentRun.fencingToken != null && command.fencingToken != null && command.fencingToken !== currentRun.fencingToken) {
            throw new ValidationError(
              "runtime_truth_repository.stale_fencing_token",
              `HarnessRun ${harnessRun.harnessRunId} requires the active fencing token`,
              { details: { harnessRunId: harnessRun.harnessRunId, expectedToken: currentRun.fencingToken, actualToken: command.fencingToken } },
            );
          }
          // R5-44: Lease owner must match the HarnessRun's ownership
          // The lease holder (leaseId) must match the ownership owner
          if (currentRun.leaseId != null && currentRun.leaseId !== currentRun.ownership.ownerId) {
            throw new ValidationError(
              "runtime_truth_repository.lease_owner_mismatch",
              `HarnessRun ${harnessRun.harnessRunId} lease holder does not match ownership owner`,
              { details: { harnessRunId: harnessRun.harnessRunId, leaseHolderId: currentRun.leaseId, ownershipOwnerId: currentRun.ownership.ownerId } },
            );
          }
        }
      }

      const transactionMarker = `TXN_${++this.state.transactionCounter}`;
      this.appendAuditRef(`BEGIN_${transactionMarker}`);
      const aggregateId = getAggregateId(command.aggregateType, command.aggregate);
      const existingAggregate = this.getAggregate(command.aggregateType, aggregateId);
      const stored = existingAggregate ?? bindInitialCommandLeaseAndFencing(command);
      const inheritedLeaseId =
        normalizeOptionalToken(command.leaseId)
        ?? ("leaseId" in stored ? normalizeOptionalToken(stored.leaseId) : undefined)
        ?? `lease://runtime-truth/${aggregateId}`;
      const inheritedFencingToken =
        normalizeOptionalToken(command.fencingToken)
        ?? ("fencingToken" in stored ? normalizeOptionalToken(stored.fencingToken) : undefined)
        ?? this.nextFallbackFencingToken();
      const result = this.stateMachine.transition({
        ...command,
        auditRef: command.auditRef ?? `audit://runtime-truth/${command.aggregateType}/${aggregateId}/${transactionMarker}`,
        leaseId: inheritedLeaseId,
        fencingToken: inheritedFencingToken,
        aggregate: stored as TAggregate,
      });
      this.storeAggregate(command.aggregateType, result.aggregate);
      const event = this.appendEvent(result.event);
      if (command.auditRef != null) {
        this.appendAuditRef(command.auditRef);
      }
      this.appendAuditRef(`COMMIT_${transactionMarker}`);
      return { ...result, event };
    });
  }

  public appendNodeAttemptReceipt(receipt: NodeAttemptReceipt): void {
    this.transaction(() => {
      if (this.state.nodeAttemptReceipts.has(receipt.nodeAttemptReceiptId)) {
        throw new ValidationError(
          "runtime_truth_repository.duplicate_node_attempt_receipt",
          "NodeAttemptReceipt is append-only and cannot be overwritten.",
        );
      }
      this.storeAppendOnlyEntry(this.state.nodeAttemptReceipts, receipt.nodeAttemptReceiptId, receipt);
    });
  }

  public appendRunVersionLock(lock: RunVersionLock): void {
    this.transaction(() => {
      if (this.state.runVersionLocks.has(lock.runVersionLockId)) {
        throw new ValidationError(
          "runtime_truth_repository.duplicate_run_version_lock",
          "RunVersionLock is append-only and cannot be overwritten.",
        );
      }
      this.storeAppendOnlyEntry(this.state.runVersionLocks, lock.runVersionLockId, lock);
    });
  }

  public getHarnessRun(harnessRunId: string): HarnessRun | null {
    return this.state.harnessRuns.get(harnessRunId) ?? null;
  }

  public getNodeRun(nodeRunId: string): NodeRun | null {
    return this.state.nodeRuns.get(nodeRunId) ?? null;
  }

  public getSideEffect(sideEffectId: string): SideEffectRecord | null {
    return this.state.sideEffects.get(sideEffectId) ?? null;
  }

  public getBudgetLedger(budgetLedgerId: string): BudgetLedger | null {
    return this.state.budgetLedgers.get(budgetLedgerId) ?? null;
  }

  public getBudgetReservation(budgetReservationId: string): BudgetReservation | null {
    return this.state.budgetReservations.get(budgetReservationId) ?? null;
  }

  public listEvents(): readonly PlatformFactEvent[] {
    return [...this.state.events];
  }

  public listOutbox(): readonly PlatformFactEvent[] {
    return [...this.state.outbox];
  }

  public listAuditRefs(): readonly string[] {
    return [...this.state.auditRefs];
  }

  public appendEvidenceRecord(record: EvidenceRecord): void {
    this.transaction(() => {
      this.appendAuditRef(record.recordId);
    });
  }

  /**
   * R24-34: Replay events to rebuild aggregate state from event store.
   * Events are processed in sequence, applying status changes to reconstruct aggregates.
   * This enables event-sourced reconstruction when state needs to be rebuilt from events.
   */
  public replayEvents(events: readonly PlatformFactEvent[]): void {
    this.transaction(() => {
      for (const event of events) {
        const aggregateId = event.aggregateId;
        const aggregateType = event.aggregateType as RuntimeStateAggregateType;
        const currentAggregate = this.getAggregate(aggregateType, aggregateId);
        if (currentAggregate == null) {
          continue;
        }
        const payload = asRuntimeEventPayload(event.payload);
        const fromStatus = toRuntimeStatus(payload?.fromStatus);
        const toStatus = toRuntimeStatus(payload?.toStatus);
        if (toStatus == null) {
          continue;
        }
        const leaseId = readAggregateLeaseId(currentAggregate);
        const fencingToken = readAggregateFencingToken(currentAggregate);
        const command: RuntimeTransitionCommand<RuntimeStateAggregate> = {
          commandId: event.eventId,
          entityType: aggregateType,
          entityId: aggregateId,
          aggregateType,
          aggregate: currentAggregate,
          fromStatus: fromStatus ?? statusOf(currentAggregate),
          toStatus,
          principal: "system",
          traceId: event.traceId,
          tenantId: event.tenantId,
          reasonCode: payload?.reasonCode ?? "event_replay",
          emittedBy: payload?.emittedBy ?? "runtime_truth_repository.replay",
          occurredAt: event.occurredAt,
          auditRef: payload?.auditRef ?? `audit://runtime-truth/replay/${aggregateType}/${aggregateId}/${event.eventId}`,
          ...(payload?.runVersionLockId != null ? { runVersionLockId: payload.runVersionLockId } : {}),
          ...(leaseId != null ? { leaseId } : {}),
          ...(fencingToken != null ? { fencingToken } : {}),
        };
        const result = this.stateMachine.transition(command);
        this.storeAggregate(aggregateType, result.aggregate);
        this.appendReplayedEvent(event);
      }
    });
  }

  public snapshot(): RuntimeTruthRepositorySnapshot {
    const stateHash = this.computeStateHash();
    const now = new Date().toISOString();
    const version = this.state.snapshotVersion + 1;
    this.state.snapshotVersion = version;

    return {
      harnessRuns: [...this.state.harnessRuns.values()],
      nodeRuns: [...this.state.nodeRuns.values()],
      sideEffects: [...this.state.sideEffects.values()],
      budgetLedgers: [...this.state.budgetLedgers.values()],
      budgetReservations: [...this.state.budgetReservations.values()],
      nodeAttemptReceipts: [...this.state.nodeAttemptReceipts.values()],
      runVersionLocks: [...this.state.runVersionLocks.values()],
      events: [...this.state.events],
      outbox: [...this.state.outbox],
      auditRefs: [...this.state.auditRefs],
      version,
      createdAt: now,
      // R11-12: Include snapshot version metadata
      snapshotVersion: {
        versionId: `snapshot-${now}`,
        version,
        stateHash,
        createdAt: now,
      },
    };
  }

  private transaction<TResult>(operation: () => TResult): TResult {
    if (this.activeTransaction != null) {
      return operation();
    }
    const context: TransactionContext = {
      undoOperations: [],
    };
    this.activeTransaction = context;
    try {
      return operation();
    } catch (error) {
      for (let index = context.undoOperations.length - 1; index >= 0; index--) {
        context.undoOperations[index]?.();
      }
      throw error;
    } finally {
      this.activeTransaction = null;
    }
  }

  private getRequiredAggregate(
    aggregateType: RuntimeStateAggregateType,
    aggregateId: string,
  ): RuntimeStateAggregate {
    const aggregate = this.getAggregate(aggregateType, aggregateId);
    if (aggregate == null) {
      throw new ValidationError(
        "runtime_truth_repository.aggregate_not_found",
        `Runtime aggregate not found: ${aggregateType}/${aggregateId}`,
      );
    }
    return aggregate;
  }

  private getAggregate(aggregateType: RuntimeStateAggregateType, aggregateId: string): RuntimeStateAggregate | null {
    switch (aggregateType) {
      case "HarnessRun":
        return this.getHarnessRun(aggregateId);
      case "NodeRun":
        return this.getNodeRun(aggregateId);
      case "SideEffectRecord":
        return this.getSideEffect(aggregateId);
      case "BudgetLedger":
        return this.getBudgetLedger(aggregateId);
      case "BudgetReservation":
        return this.getBudgetReservation(aggregateId);
    }
  }

  private storeAggregate(aggregateType: RuntimeStateAggregateType, aggregate: RuntimeStateAggregate): void {
    switch (aggregateType) {
      case "HarnessRun":
        this.storeEntry(this.state.harnessRuns, (aggregate as HarnessRun).harnessRunId, aggregate as HarnessRun);
        return;
      case "NodeRun":
        this.storeEntry(this.state.nodeRuns, (aggregate as NodeRun).nodeRunId, aggregate as NodeRun);
        return;
      case "SideEffectRecord":
        this.storeEntry(this.state.sideEffects, (aggregate as SideEffectRecord).sideEffectId, aggregate as SideEffectRecord);
        return;
      case "BudgetLedger":
        this.storeEntry(this.state.budgetLedgers, (aggregate as BudgetLedger).budgetLedgerId, aggregate as BudgetLedger);
        return;
      case "BudgetReservation":
        this.storeEntry(
          this.state.budgetReservations,
          (aggregate as BudgetReservation).budgetReservationId,
          aggregate as BudgetReservation,
        );
        return;
    }
  }

  private appendEvent(event: PlatformFactEvent): PlatformFactEvent {
    const aggregateKey = buildAggregateEventKey(event.aggregateType as RuntimeStateAggregateType, event.aggregateId);
    const previousSeq = this.state.eventSequenceByAggregate.get(aggregateKey) ?? 0;
    const nextSeq = previousSeq + 1;
    const normalizedEvent: PlatformFactEvent = {
      ...event,
      aggregateSeq: nextSeq,
    };
    return this.appendPersistedEvent(normalizedEvent, {
      aggregateKey,
      previousSeq,
      includeOutbox: true,
    });
  }

  private appendReplayedEvent(event: PlatformFactEvent): PlatformFactEvent {
    const aggregateKey = buildAggregateEventKey(event.aggregateType as RuntimeStateAggregateType, event.aggregateId);
    const previousSeq = this.state.eventSequenceByAggregate.get(aggregateKey) ?? 0;
    if (event.aggregateSeq <= previousSeq) {
      throw new ValidationError(
        "runtime_truth_repository.duplicate_event_sequence",
        "Replay event aggregate sequence must advance monotonically.",
      );
    }
    return this.appendPersistedEvent(event, {
      aggregateKey,
      previousSeq,
      includeOutbox: false,
    });
  }

  private appendPersistedEvent(
    event: PlatformFactEvent,
    options: {
      aggregateKey: string;
      previousSeq: number;
      includeOutbox: boolean;
    },
  ): PlatformFactEvent {
    this.recordUndo(() => {
      this.state.events.pop();
      if (options.includeOutbox) {
        this.state.outbox.pop();
      }
      if (options.previousSeq === 0) {
        this.state.eventSequenceByAggregate.delete(options.aggregateKey);
      } else {
        this.state.eventSequenceByAggregate.set(options.aggregateKey, options.previousSeq);
      }
    });
    this.state.events.push(event);
    if (options.includeOutbox) {
      this.state.outbox.push(event);
    }
    this.state.eventSequenceByAggregate.set(options.aggregateKey, event.aggregateSeq);
    return event;
  }

  private appendAuditRef(auditRef: string): void {
    this.recordUndo(() => {
      this.state.auditRefs.pop();
    });
    this.state.auditRefs.push(auditRef);
  }

  private nextFallbackFencingToken(): string {
    const next = this.state.fencingCounter + 1;
    this.recordUndo(() => {
      this.state.fencingCounter = next - 1;
    });
    this.state.fencingCounter = next;
    return String(next);
  }

  private storeEntry<TValue>(map: Map<string, TValue>, key: string, value: TValue): void {
    const hadPrevious = map.has(key);
    const previousValue = map.get(key);
    this.recordUndo(() => {
      if (hadPrevious) {
        map.set(key, previousValue as TValue);
      } else {
        map.delete(key);
      }
    });
    map.set(key, value);
  }

  private storeAppendOnlyEntry<TValue>(map: Map<string, TValue>, key: string, value: TValue): void {
    this.recordUndo(() => {
      map.delete(key);
    });
    map.set(key, value);
  }

  private recordUndo(undo: () => void): void {
    this.activeTransaction?.undoOperations.push(undo);
  }
}

function toRuntimeStatus(value: unknown): RuntimeStatus<RuntimeStateAggregate> | null {
  return typeof value === "string" ? value as RuntimeStatus<RuntimeStateAggregate> : null;
}

function statusOf(aggregate: RuntimeStateAggregate): RuntimeStatus<RuntimeStateAggregate> {
  return aggregate.status as RuntimeStatus<RuntimeStateAggregate>;
}

function createEmptyState(): RuntimeTruthRepositoryState {
  return {
    harnessRuns: new Map(),
    nodeRuns: new Map(),
    sideEffects: new Map(),
    budgetLedgers: new Map(),
    budgetReservations: new Map(),
    nodeAttemptReceipts: new Map(),
    runVersionLocks: new Map(),
    events: [],
    outbox: [],
    auditRefs: [],
    eventSequenceByAggregate: new Map(),
    // R11-12: Initialize snapshot version
    snapshotVersion: 0,
    transactionCounter: 0,
    fencingCounter: 0,
  };
}

function getAggregateId(aggregateType: RuntimeStateAggregateType, aggregate: RuntimeStateAggregate): string {
  switch (aggregateType) {
    case "HarnessRun":
      return (aggregate as HarnessRun).harnessRunId;
    case "NodeRun":
      return (aggregate as NodeRun).nodeRunId;
    case "SideEffectRecord":
      return (aggregate as SideEffectRecord).sideEffectId;
    case "BudgetLedger":
      return (aggregate as BudgetLedger).budgetLedgerId;
    case "BudgetReservation":
      return (aggregate as BudgetReservation).budgetReservationId;
  }
}

function bindInitialCommandLeaseAndFencing<TAggregate extends RuntimeStateAggregate>(
  command: RuntimeTransitionCommand<TAggregate>,
): TAggregate {
  switch (command.aggregateType) {
    case "HarnessRun":
      return {
        ...(command.aggregate as HarnessRun),
        ...(command.leaseId != null ? { leaseId: command.leaseId } : {}),
        ...(command.fencingToken != null ? { fencingToken: command.fencingToken } : {}),
      } as TAggregate;
    case "NodeRun":
      return {
        ...(command.aggregate as NodeRun),
        ...(command.leaseId != null ? { leaseId: command.leaseId } : {}),
        ...(command.fencingToken != null ? { fencingToken: command.fencingToken } : {}),
      } as TAggregate;
    case "SideEffectRecord":
      return {
        ...(command.aggregate as SideEffectRecord),
        ...(command.leaseId != null ? { leaseId: command.leaseId } : {}),
        ...(command.fencingToken != null ? { fencingToken: command.fencingToken } : {}),
      } as TAggregate;
    default:
      return command.aggregate;
  }
}

function buildAggregateEventKey(aggregateType: RuntimeStateAggregateType, aggregateId: string): string {
  return `${aggregateType}:${aggregateId}`;
}

function computeAggregateProtectionHash(
  aggregateType: RuntimeStateAggregateType,
  aggregate: RuntimeStateAggregate,
): string | null {
  const protectionState = readAggregateProtectionState(aggregateType, aggregate);
  if (protectionState == null) {
    return null;
  }
  return createHash("sha256").update(JSON.stringify(protectionState)).digest("hex");
}

function readAggregateProtectionState(
  aggregateType: RuntimeStateAggregateType,
  aggregate: RuntimeStateAggregate,
): Record<string, unknown> | null {
  switch (aggregateType) {
    case "HarnessRun": {
      const harnessRun = aggregate as HarnessRun;
      return {
        leaseId: normalizeOptionalToken(harnessRun.leaseId) ?? null,
        fencingToken: normalizeOptionalToken(harnessRun.fencingToken) ?? null,
        ownershipOwnerId: harnessRun.ownership.ownerId,
        ownershipOwnerType: harnessRun.ownership.ownerType,
      };
    }
    case "NodeRun": {
      const nodeRun = aggregate as NodeRun;
      return {
        leaseId: normalizeOptionalToken(nodeRun.leaseId) ?? null,
        fencingToken: normalizeOptionalToken(nodeRun.fencingToken) ?? null,
      };
    }
    case "SideEffectRecord": {
      const sideEffect = aggregate as SideEffectRecord;
      return {
        leaseId: normalizeOptionalToken(sideEffect.leaseId) ?? null,
        fencingToken: normalizeOptionalToken(sideEffect.fencingToken) ?? null,
      };
    }
    default:
      return null;
  }
}

function asRuntimeEventPayload(value: unknown): {
  readonly toStatus?: unknown;
  readonly fromStatus?: unknown;
  readonly reasonCode?: string;
  readonly emittedBy?: string;
  readonly auditRef?: string;
  readonly runVersionLockId?: string;
} | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as {
    readonly toStatus?: unknown;
    readonly fromStatus?: unknown;
    readonly reasonCode?: string;
    readonly emittedBy?: string;
    readonly auditRef?: string;
    readonly runVersionLockId?: string;
  };
}

function readAggregateLeaseId(aggregate: RuntimeStateAggregate): string | undefined {
  if ("leaseId" in aggregate) {
    return normalizeOptionalToken(aggregate.leaseId);
  }
  return undefined;
}

function readAggregateFencingToken(aggregate: RuntimeStateAggregate): string | undefined {
  if ("fencingToken" in aggregate) {
    return normalizeOptionalToken(aggregate.fencingToken);
  }
  return undefined;
}

function normalizeOptionalToken(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
