import { ValidationError } from "../../contracts/errors.js";
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
}

export interface RuntimeRepository {
  seed(aggregateType: RuntimeStateAggregateType, aggregate: RuntimeStateAggregate): void;
  transition<TAggregate extends RuntimeStateAggregate>(
    command: RuntimeTransitionCommand<TAggregate>,
  ): RuntimeTransitionResult<TAggregate>;
  appendNodeAttemptReceipt(receipt: NodeAttemptReceipt): void;
  appendRunVersionLock(lock: RunVersionLock): void;
  snapshot(): RuntimeTruthRepositorySnapshot;
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

  public transition<TAggregate extends RuntimeStateAggregate>(
    command: RuntimeTransitionCommand<TAggregate>,
  ): RuntimeTransitionResult<TAggregate> {
    // §25.3: Lease/fencing validation for HarnessRun transitions
    if (command.aggregateType === "HarnessRun") {
      const harnessRun = this.getHarnessRun(getAggregateId(command.aggregateType, command.aggregate as RuntimeStateAggregate) as string);
      if (harnessRun != null) {
        this.validateLease(harnessRun);
      }
    }

    return this.transaction(() => {
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

  public snapshot(): RuntimeTruthRepositorySnapshot {
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
    };
  }

  // §25.6: transaction() uses in-memory clone-and-rollback for atomicity.
// NOTE: This is NOT crash-safe because there's no actual database commit.
  // If the process crashes between state mutation and outbox flush, events are lost.
  // For production, replace with proper database transaction (BEGIN/COMMIT/ROLLBACK).
  // The pattern here ensures atomicity within the operation, but crash recovery
  // requires external persistence (e.g., write-ahead log, journal, or DB transaction).
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

  // §25.3: Lease/fencing validation for HarnessRun
  private validateLease(harnessRun: HarnessRun): void {
    if (harnessRun.lease != null) {
      const now = Date.now();
      const leaseExpiry = new Date(harnessRun.lease.expiresAt).getTime();
      if (now > leaseExpiry) {
        throw new ValidationError(
          "runtime_truth_repository.lease_expired",
          `HarnessRun ${harnessRun.harnessRunId} has expired lease`,
          { details: { harnessRunId: harnessRun.harnessRunId, leaseExpiresAt: harnessRun.lease.expiresAt } },
        );
      }
      if (harnessRun.lease.ownerId !== harnessRun.ownedBy) {
        throw new ValidationError(
          "runtime_truth_repository.lease_fencing_violation",
          `HarnessRun ${harnessRun.harnessRunId} lease owner mismatch`,
          { details: { leaseOwner: harnessRun.lease.ownerId, ownedBy: harnessRun.ownedBy } },
        );
      }
    }
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
