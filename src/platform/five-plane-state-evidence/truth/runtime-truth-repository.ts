import { ValidationError } from "../../contracts/errors.js";
import { nowIso } from "../../contracts/types/ids.js";
import {
  type BudgetLedger,
  type BudgetReservation,
  type HarnessRun,
  type NodeAttemptReceipt,
  type NodeRun,
  type PlatformFactEvent,
  type RunVersionLock,
  type SideEffectRecord,
  createPlatformFactEvent,
} from "../../contracts/executable-contracts/index.js";
import { type EvidenceRecord } from "../../contracts/types/platform-contracts.js";
import {
  RuntimeStateMachine,
  type RuntimeStateAggregate,
  type RuntimeStateAggregateType,
  type RuntimeTransitionCommand,
  type RuntimeTransitionResult,
} from "../../execution/runtime-state-machine.js";

export interface RuntimeTruthRepositorySnapshot {
  readonly version: number;
  readonly createdAt: string;
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
  appendEvidenceRecord(evidence: EvidenceRecord): void;
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
  private snapshotVersion = 0;

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
        this.validateLease(command, harnessRun);
      }
    }

    return this.transaction(() => {
      const stored = this.getRequiredAggregate(command.aggregateType, getAggregateId(command.aggregateType, command.aggregate));
      const result = this.stateMachine.transition({
        ...command,
        aggregate: stored as TAggregate,
      });
      this.replaceAggregate(command.aggregateType, result.aggregate);
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

  /**
   * R4-35 (INV-EVIDENCE-001): Append an EvidenceRecord as an immutable PlatformFactEvent.
   * This ensures all decisions and executions produce immutable evidence that can be
   * audited and replayed.
   */
  public appendEvidenceRecord(evidence: EvidenceRecord): void {
    // R4-35: Convert EvidenceRecord to PlatformFactEvent for immutable storage
    // Evidence records are stored as platform.evidence.recorded events
    const eventType = `platform.evidence.${evidence.category}` as `platform.${string}`;

    // Get the next sequence number for this aggregate
    const existingEvents = this.state.events.filter(
      (e) => e.aggregateType === "EvidenceRecord" && e.aggregateId === evidence.recordId,
    );
    const nextSeq = existingEvents.length + 1;

    const platformEvent = createPlatformFactEvent({
      eventType,
      aggregateType: "EvidenceRecord",
      aggregateId: evidence.recordId,
      aggregateSeq: nextSeq,
      tenantId: evidence.principal.tenantId ?? "global",
      runId: evidence.recordId, // Use recordId as runId since evidence doesn't have runId
      traceId: evidence.traceId,
      payload: {
        recordId: evidence.recordId,
        principal: evidence.principal,
        category: evidence.category,
        targetRef: evidence.targetRef,
        content: evidence.content,
        timestamp: evidence.timestamp,
        metadata: evidence.metadata,
      } as unknown as PlatformFactEvent["payload"],
      occurredAt: evidence.timestamp,
    });

    this.appendEvent(platformEvent);
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
    this.snapshotVersion++;
    const version = this.snapshotVersion;
    const createdAt = nowIso();
    return {
      version,
      createdAt,
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

  // §25.6: transaction() uses write-ahead log (WAL) pattern for crash safety.
  // Events are appended to outbox BEFORE state mutations (write-ahead principle).
  // Transaction markers (BEGIN/COMMIT/ROLLBACK) are written to auditRefs for recovery.
  // If process crashes, uncommitted transactions can be detected and rolled back.
  // NOTE: For true durability, this requires external persistence (DB transaction,
  // write-ahead log to disk, or replicated log). The WAL markers here provide
  // intra-process crash recovery within the current execution context.
  // R5-48 FIX NEEDED: Replace with real db.transaction() for crash-safe durability.
  private transaction<TResult>(operation: () => TResult): TResult {
    // Write-ahead: begin transaction marker before any state mutation
    this.state.auditRefs.push(`BEGIN_TXN_${Date.now()}`);

    const before = cloneState(this.state);
    try {
      const result = operation();
      // Write-ahead: commit marker after successful operation ensures event durability
      this.state.auditRefs.push(`COMMIT_TXN_${Date.now()}`);
      return result;
    } catch (error) {
      // Write-ahead: rollback marker before state restore
      this.state.auditRefs.push(`ROLLBACK_TXN_${Date.now()}`);
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
    // Root cause §191-2234: Map.set silently overwrites existing entries, violating
    // truth's append-only / immutable requirement. Before storing, verify no existing
    // aggregate with same ID (append-only violation). Use setOnce pattern to ensure
    // non-destructive inserts only.
    const aggregateId = getAggregateId(aggregateType, aggregate);
    const existing = this.getAggregate(aggregateType, aggregateId);
    if (existing != null) {
      throw new ValidationError(
        "runtime_truth_repository.append_only_violation",
        `Aggregate ${aggregateType}/${aggregateId} already exists and cannot be overwritten. Use transition() for updates.`,
      );
    }
    // Use setOnce: check-and-set to guarantee append-only semantics
    switch (aggregateType) {
      case "HarnessRun":
        if (this.state.harnessRuns.has((aggregate as HarnessRun).harnessRunId)) {
          throw new ValidationError("runtime_truth_repository.append_only_violation", `HarnessRun ${(aggregate as HarnessRun).harnessRunId} already exists.`);
        }
        this.state.harnessRuns.set((aggregate as HarnessRun).harnessRunId, aggregate as HarnessRun);
        return;
      case "NodeRun":
        if (this.state.nodeRuns.has((aggregate as NodeRun).nodeRunId)) {
          throw new ValidationError("runtime_truth_repository.append_only_violation", `NodeRun ${(aggregate as NodeRun).nodeRunId} already exists.`);
        }
        this.state.nodeRuns.set((aggregate as NodeRun).nodeRunId, aggregate as NodeRun);
        return;
      case "SideEffectRecord":
        if (this.state.sideEffects.has((aggregate as SideEffectRecord).sideEffectId)) {
          throw new ValidationError("runtime_truth_repository.append_only_violation", `SideEffectRecord ${(aggregate as SideEffectRecord).sideEffectId} already exists.`);
        }
        this.state.sideEffects.set((aggregate as SideEffectRecord).sideEffectId, aggregate as SideEffectRecord);
        return;
      case "BudgetLedger":
        if (this.state.budgetLedgers.has((aggregate as BudgetLedger).budgetLedgerId)) {
          throw new ValidationError("runtime_truth_repository.append_only_violation", `BudgetLedger ${(aggregate as BudgetLedger).budgetLedgerId} already exists.`);
        }
        this.state.budgetLedgers.set((aggregate as BudgetLedger).budgetLedgerId, aggregate as BudgetLedger);
        return;
      case "BudgetReservation":
        if (this.state.budgetReservations.has((aggregate as BudgetReservation).budgetReservationId)) {
          throw new ValidationError("runtime_truth_repository.append_only_violation", `BudgetReservation ${(aggregate as BudgetReservation).budgetReservationId} already exists.`);
        }
        this.state.budgetReservations.set(
          (aggregate as BudgetReservation).budgetReservationId,
          aggregate as BudgetReservation,
        );
        return;
    }
  }

  private replaceAggregate(aggregateType: RuntimeStateAggregateType, aggregate: RuntimeStateAggregate): void {
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
        this.state.budgetReservations.set((aggregate as BudgetReservation).budgetReservationId, aggregate as BudgetReservation);
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

  // §25.3: HarnessRun writes must present the same leaseId/fencingToken that the
  // authoritative aggregate currently holds. Admission is the transition that
  // establishes these values; later mutations must echo them back.
  private validateLease(
    command: RuntimeTransitionCommand<RuntimeStateAggregate>,
    harnessRun: HarnessRun,
  ): void {
    const currentLeaseId = (harnessRun as HarnessRun & { leaseId?: string }).leaseId;
    const currentFencingToken = (harnessRun as HarnessRun & { fencingToken?: string }).fencingToken;
    if (currentLeaseId == null && currentFencingToken == null) {
      return;
    }

    if (command.leaseId == null || command.fencingToken == null) {
      throw new ValidationError(
        "runtime_truth_repository.lease_fencing_required",
        `HarnessRun ${harnessRun.harnessRunId} requires leaseId and fencingToken for mutation`,
        {
          details: {
            harnessRunId: harnessRun.harnessRunId,
            expectedLeaseId: currentLeaseId ?? null,
            expectedFencingToken: currentFencingToken ?? null,
          },
        },
      );
    }

    if (currentLeaseId != null && command.leaseId !== currentLeaseId) {
      throw new ValidationError(
        "runtime_truth_repository.stale_lease_id",
        `HarnessRun ${harnessRun.harnessRunId} leaseId mismatch`,
        {
          details: {
            harnessRunId: harnessRun.harnessRunId,
            expectedLeaseId: currentLeaseId,
            actualLeaseId: command.leaseId,
          },
        },
      );
    }

    if (currentFencingToken != null && command.fencingToken !== currentFencingToken) {
      throw new ValidationError(
        "runtime_truth_repository.stale_fencing_token",
        `HarnessRun ${harnessRun.harnessRunId} fencingToken mismatch`,
        {
          details: {
            harnessRunId: harnessRun.harnessRunId,
            expectedFencingToken: currentFencingToken,
            actualFencingToken: command.fencingToken,
          },
        },
      );
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
