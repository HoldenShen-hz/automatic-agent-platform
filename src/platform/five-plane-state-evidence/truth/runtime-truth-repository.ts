import { createHash } from "node:crypto";
import { ValidationError } from "../../contracts/errors.js";
import { newId } from "../../contracts/types/ids.js";
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
} from "../../execution/runtime-state-machine.js";

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
  /** R11-12: Current snapshot version for CAS */
  readonly snapshotVersion: number;
}

export class RuntimeTruthRepository implements RuntimeRepository {
  private state: RuntimeTruthRepositoryState = createEmptyState();
  private readonly stateMachine: RuntimeStateMachine;

  public constructor(options: { readonly stateMachine?: RuntimeStateMachine } = {}) {
    this.stateMachine = options.stateMachine ?? new RuntimeStateMachine();
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
  }): CasResult<TAggregate> {
    const currentVersion = this.getAggregateVersion(params.aggregateType, params.aggregateId);

    if (currentVersion !== null && currentVersion !== params.expectedVersion) {
      return {
        success: false,
        expectedVersion: params.expectedVersion,
        actualVersion: currentVersion,
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
    return this.transaction(() => {
      // R5-44: Lease/fencing validation for HarnessRun transitions
      if (command.aggregateType === "HarnessRun") {
        const harnessRun = command.aggregate as HarnessRun;
        const currentRun = this.getHarnessRun(harnessRun.harnessRunId);
        if (currentRun) {
          // Check lease token if present
          if (harnessRun.leaseId != null && currentRun.leaseId != null && harnessRun.leaseId !== currentRun.leaseId) {
            throw new ValidationError(
              "runtime_truth_repository.lease_conflict",
              `HarnessRun ${harnessRun.harnessRunId} has an active lease held by another process`,
              { details: { harnessRunId: harnessRun.harnessRunId, expectedLease: currentRun.leaseId, actualLease: harnessRun.leaseId } },
            );
          }
          // Check fencing token if present
          if (harnessRun.fencingToken != null && currentRun.fencingToken != null && harnessRun.fencingToken !== currentRun.fencingToken) {
            throw new ValidationError(
              "runtime_truth_repository.fencing_token_conflict",
              `HarnessRun ${harnessRun.harnessRunId} has a conflicting fencing token`,
              { details: { harnessRunId: harnessRun.harnessRunId, expectedToken: currentRun.fencingToken, actualToken: harnessRun.fencingToken } },
            );
          }
        }
      }

      const stored = this.getRequiredAggregate(command.aggregateType, getAggregateId(command.aggregateType, command.aggregate));
      const result = this.stateMachine.transition({
        ...command,
        aggregate: stored as TAggregate,
      });
      this.storeAggregate(command.aggregateType, result.aggregate);
      const event = this.appendEvent(result.event);
      if (command.auditRef != null) {
        this.state.auditRefs.push(command.auditRef);
      }
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
      this.state.nodeAttemptReceipts.set(receipt.nodeAttemptReceiptId, receipt);
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
      this.state.runVersionLocks.set(lock.runVersionLockId, lock);
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

  /**
   * R24-34: Replay events to rebuild aggregate state from event store.
   * Events are processed in sequence, applying status changes to reconstruct aggregates.
   * This enables event-sourced reconstruction when state needs to be rebuilt from events.
   */
  public replayEvents(events: readonly PlatformFactEvent[]): void {
    for (const event of events) {
      // Get the current aggregate state
      const aggregateId = event.aggregateId;
      const aggregateType = event.aggregateType as RuntimeStateAggregateType;
      const currentAggregate = this.getAggregate(aggregateType, aggregateId);

      if (currentAggregate == null) {
        // Cannot replay event for aggregate that doesn't exist - skip
        continue;
      }

      // Apply event to reconstruct state - we extract the toStatus from the event payload
      const payload = event.payload as { toStatus?: string; fromStatus?: string } | null;
      if (!payload?.toStatus) {
        continue;
      }

      // Create a transition command to apply the event's status change
      const command: RuntimeTransitionCommand<RuntimeStateAggregate> = {
        commandId: newId("replay"),
        entityType: aggregateType,
        entityId: aggregateId,
        aggregateType: aggregateType,
        aggregate: currentAggregate,
        fromStatus: payload.fromStatus as any,
        toStatus: payload.toStatus as any,
        principal: "system",
        traceId: event.traceId ?? newId("trace"),
        tenantId: event.tenantId,
        reasonCode: "event_replay",
        emittedBy: "runtime_truth_repository.replay",
        occurredAt: event.occurredAt,
      };

      // Apply the transition which will update the aggregate and emit a new event
      const result = this.stateMachine.transition(command);
      this.storeAggregate(aggregateType, result.aggregate);

      // Also append to outbox for event sourcing integrity
      this.appendEvent(result.event);
    }
  }

  public snapshot(): RuntimeTruthRepositorySnapshot {
    const stateHash = this.computeStateHash();
    const now = new Date().toISOString();

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
      // R11-12: Include snapshot version metadata
      snapshotVersion: {
        versionId: `snapshot-${now}`,
        version: this.state.snapshotVersion + 1,
        stateHash,
        createdAt: now,
      },
    };
  }

  private transaction<TResult>(operation: () => TResult): TResult {
    const before = cloneState(this.state);
    try {
      return operation();
    } catch (error) {
      this.state = before;
      throw error;
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
        this.state.harnessRuns.set((aggregate as HarnessRun).harnessRunId, aggregate as HarnessRun);
        return;
      case "NodeRun":
        this.state.nodeRuns.set((aggregate as NodeRun).nodeRunId, aggregate as NodeRun);
        return;
      case "SideEffectRecord":
        this.state.sideEffects.set((aggregate as SideEffectRecord).sideEffectId, aggregate as SideEffectRecord);
        return;
      case "BudgetLedger":
        this.state.budgetLedgers.set((aggregate as BudgetLedger).budgetLedgerId, aggregate as BudgetLedger);
        return;
      case "BudgetReservation":
        this.state.budgetReservations.set(
          (aggregate as BudgetReservation).budgetReservationId,
          aggregate as BudgetReservation,
        );
        return;
    }
  }

  private appendEvent(event: PlatformFactEvent): PlatformFactEvent {
    const nextSeq = this.state.events.filter((existing) => {
      return existing.aggregateType === event.aggregateType && existing.aggregateId === event.aggregateId;
    }).length + 1;
    const normalizedEvent: PlatformFactEvent = {
      ...event,
      aggregateSeq: nextSeq,
    };
    const duplicate = this.state.events.some((existing) => {
      return (
        existing.aggregateType === normalizedEvent.aggregateType &&
        existing.aggregateId === normalizedEvent.aggregateId &&
        existing.aggregateSeq === normalizedEvent.aggregateSeq
      );
    });
    if (duplicate) {
      throw new ValidationError(
        "runtime_truth_repository.duplicate_event_sequence",
        "Platform fact event aggregate sequence must be unique.",
      );
    }
    this.state.events.push(normalizedEvent);
    this.state.outbox.push(normalizedEvent);
    return normalizedEvent;
  }
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
    // R11-12: Initialize snapshot version
    snapshotVersion: 0,
  };
}

function cloneState(state: RuntimeTruthRepositoryState): RuntimeTruthRepositoryState {
  return {
    harnessRuns: new Map(state.harnessRuns),
    nodeRuns: new Map(state.nodeRuns),
    sideEffects: new Map(state.sideEffects),
    budgetLedgers: new Map(state.budgetLedgers),
    budgetReservations: new Map(state.budgetReservations),
    nodeAttemptReceipts: new Map(state.nodeAttemptReceipts),
    runVersionLocks: new Map(state.runVersionLocks),
    events: [...state.events],
    outbox: [...state.outbox],
    auditRefs: [...state.auditRefs],
    snapshotVersion: state.snapshotVersion,
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
