# Runtime Sequence Diagrams

> Last updated: 2026-04-12
>
> This document describes the four core runtime execution paths in the Automatic Agent System.

---

## 1. Task Intake → Workflow Start

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Client    │     │  HTTP API    │     │  IntakeRouter   │     │ Phase1bOrchestr. │
│  (CLI/SDK)   │     │   Server     │     │                  │     │                  │
└──────┬──────┘     └──────┬───────┘     └────────┬─────────┘     └────────┬─────────┘
       │                  │                        │                       │
       │ POST /tasks      │                        │                       │
       │─────────────────>│                        │                       │
       │                  │                        │                       │
       │                  │ routeTask()           │                       │
       │                  │───────────────────────>│                       │
       │                  │                        │                       │
       │                  │                        │ Division routing       │
       │                  │                        │ Create TaskRecord      │
       │                  │                        │ Create WorkflowState   │
       │                  │                        │──────────────────────>│
       │                  │                        │                       │
       │                  │                        │                       │ TransitionService
       │                  │                        │                       │ queued→pending
       │                  │                        │                       │ createTier1Event
       │                  │                        │                       │
       │                  │                        │                       │ dispatch:ticket_created
       │                  │                        │                       │ (Tier-2 event)
       │                  │                        │                       │
       │  Task created    │                        │                       │
       │<─────────────────│                        │                       │
       │                  │                        │                       │
```

**Key Points:**
- `IntakeRouter.routeTask()` performs Division routing based on task content
- Task and WorkflowState created atomically
- Tier-1 `task:status_changed` event created within same transaction
- Tier-2 `dispatch:ticket_created` event emitted after commit

---

## 2. Workflow Step Dispatch → Execution Lease → Worker Writeback

```
┌─────────────────────┐   ┌──────────────────┐   ┌─────────────────┐   ┌────────────────┐
│ ExecutionDispatch   │   │ WorkerRegistry    │   │ ExecutionLease  │   │     Worker     │
│    Service          │   │    Service        │   │    Service      │   │    (Agent)     │
└──────────┬──────────┘   └─────────┬─────────┘   └────────┬────────┘   └───────┬────────┘
           │                         │                      │                     │
           │ dispatchNext()          │                      │                     │
           │ listDispatchableTickets │                      │                     │
           │<────────────────────────│                      │                     │
           │                         │                      │                     │
           │ evaluateWorkersForTicket│                      │                     │
           │<────────────────────────│                      │                     │
           │ eligibleWorkers[]       │                      │                     │
           │                         │                      │                     │
           │ selectEligibleWorkers() │                      │                     │
           │                         │                      │                     │
           │ acquireLease()           │                      │                     │
           │───────────────────────────────────────────────>│                     │
           │                         │                      │                     │
           │                         │         Insert ExecutionLeaseRecord         │
           │                         │         fencing_token = latest + 1        │
           │                         │                      │                     │
           │ lease.acquired          │                      │                     │
           │<──────────────────────────────────────────────│                     │
           │                         │                      │                     │
           │ dispatch:ticket_claimed (Tier-2)               │                     │
           │                         │                      │                     │
           │                         │     heartbeat()      │                     │
           │                         │<─────────────────────│                     │
           │                         │                      │                     │
           │                         │                      │       execute()     │
           │                         │                      │<─────────────────── │
           │                         │                      │                     │
           │                         │                      │    execution writeback
           │                         │                      │    with fencing_token
           │                         │                      │────────────────────>│
           │                         │                      │                     │
           │                         │                      │     validateWrite   │
           │                         │                      │     (fencing token)  │
           │                         │                      │                     │
           │                         │                      │     success/reject   │
           │                         │                      │<────────────────────│
           │                         │                      │                     │
```

**Key Points:**
- `fencing_token` increments on each lease acquisition
- Worker must include `fencing_token` in writeback
- `validateWriteAccess()` rejects writes with stale tokens (split-brain prevention)
- Heartbeat renews lease; if missed → `reclaimExpiredLeases()`

---

## 3. Approval Requested → Approved/Rejected → Resume

```
┌──────────────┐   ┌─────────────────┐   ┌────────────────┐   ┌─────────────────┐
│  Execution   │   │  ApprovalService │   │  Human (HITL)  │   │ TransitionServ. │
│   Service    │   │                  │   │                │   │                 │
└──────┬───────┘   └────────┬────────┘   └───────┬────────┘   └────────┬────────┘
       │                      │                    │                    │
       │ executing             │                    │                    │
       │──────────────────────>│                    │                    │
       │                      │                    │                    │
       │ Execution enters     │                    │                    │
       │ "blocked" state      │                    │                    │
       │                      │                    │                    │
       │                      │ createApproval()    │                    │
       │                      │                    │                    │
       │                      │ ApprovalRecord     │                    │
       │                      │ status = REQUESTED │                    │
       │                      │───────────────────>│                    │
       │                      │                    │                    │
       │                      │      approval request      │           │
       │                      │<─────────────────────       │           │
       │                      │                    │                    │
       │                      │                    │   approve/reject   │
       │                      │                    │<────────────────── │
       │                      │                    │                    │
       │                      │ processApproval()  │                    │
       │                      │                    │                    │
       │                      │                    │                    │ blocked→executing
       │                      │                    │                    │ (or failed)
       │                      │                    │                    │
       │  resume/fail         │                    │                    │
       │<─────────────────────│                    │                    │
       │                      │                    │                    │
```

**Key Points:**
- `blocked` is a terminal-ish state in Execution state machine
- `ApprovalService` creates `ApprovalRecord` with `requestJson` (context) and `responseJson` (decision)
- Human decision triggers `TransitionService.transition()` to resume or fail
- Workflow continues from `currentStepIndex`

---

## 4. Event Emit → Persist → Replay/Recovery

```
┌──────────────┐   ┌─────────────────┐   ┌────────────────┐   ┌─────────────────┐
│   Producer   │   │ DurableEventBus │   │    SQLite      │   │ RecoveryService │
│   Service    │   │                 │   │    Store       │   │                 │
└──────┬───────┘   └────────┬────────┘   └───────┬────────┘   └────────┬────────┘
       │                     │                    │                    │
       │ emit(Tier1, event)  │                    │                    │
       │────────────────────>│                    │                    │
       │                     │                    │                    │
       │                     │ db.transaction()    │                    │
       │                     │───────────────────>│                    │
       │                     │                    │                    │
       │                     │ Insert EventRecord │                    │
       │                     │───────────────────>│                    │
       │                     │                    │                    │
       │                     │ Commit              │
       │                     │<───────────────────│                    │
       │                     │                    │                    │
       │                     │ dispatch to consumers│                   │
       │                     │ (tier-specific ack) │                    │
       │                     │                    │                    │
       │                     │                    │  RuntimeRecoveryService
       │                     │                    │  detects anomaly   │
       │                     │                    │<───────────────────│
       │                     │                    │                    │
       │                     │                    │   RuntimeRecoveryReplay
       │                     │                    │   Service.replay() │
       │                     │                    │                    │
       │                     │                    │   Rebuild state    │
       │                     │                    │   from Tier1 events │
       │                     │                    │                    │
       │                     │                    │   reclaimExpired   │
       │                     │                    │   Leases()         │
       │                     │                    │                    │
```

**Key Points:**
- **Tier 1**: `db.transaction()` ensures event persisted before `commit()`; consumers must ack
- **Tier 2**: At-least-once; small percentage loss acceptable
- **Tier 3**: Best-effort; high-frequency transient events (e.g., stream chunks)
- `RuntimeRecoveryService` detects:
  - Stale leases (heartbeat missed)
  - Stall detection (execution not progressing)
  - Orphaned tickets (worker disappeared)
- `RuntimeRecoveryReplayService` replays Tier-1 events to rebuild consistent state

---

## 5. State Transition: Task Lifecycle

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                        Task                                 │
                    └─────────────────────────────────────────────────────────────┘

    queued ────────┬─────────────────────────────────────────────────────────────
                   │
                   │ TransitionService.transition(reasonCode, traceId, ...)
                   │ [task intake, workflow created]
                   ▼
              pending ────────────────────────────────────────────────────────────
                   │
                   │ dispatch:ticket_claimed (Tier-2 event)
                   │ execution lease acquired
                   ▼
           in_progress ─────────────────────────────────────────────────────────
                   │
                   ├────────────────────────────────────────────────────────────┐
                   │                                                            │
                   │ [tool blocked, approval needed, dependency not met]         │
                   ▼                                                            ▼
        awaiting_decision                                                (awaiting_decision)
                   │                                                            │
                   │ [human approved, tool unblocked, dependency satisfied]       │
                   │                                                            │
                   └────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                    ┌──────────────────┴──────────────────┐
                    │                                     │
              succeeded                                 failed
                    │                                     │
                    │      [terminal states - no transitions]
                    └─────────────────────────────────────┘

    Any non-terminal state ────────────────────────────────────────────────────────
                   │
                   │ [cancelled by user or system]
                   ▼
               cancelled
```

---

## 6. Lease Lifecycle (Fencing Token)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Lease Lifecycle with Fencing Token                       │
└─────────────────────────────────────────────────────────────────────────────────┘

Time ──────────────────────────────────────────────────────────────────────────────►

Worker A acquired lease_id=1, fencing_token=1 ──────────────────────────────────►
    │
    │  heartbeat() renews lease
    │
Worker A acquired lease_id=2, fencing_token=2 ─────────────────────────────────►
    │
    │  (lease_id=1 expires or released)
    │
Worker A crashes ────────────────────────────────────────────────────────────────
                                                                                     │
                                                                                     ▼
                                                                              Worker B tries
                                                                              to write with
                                                                              fencing_token=1
                                                                              (stale!)

    validateWriteAccess() ──────────────────────────────────────────────────────►
           │
           │ fencing_token mismatch (current=2, received=1)
           ▼
      REJECTED
           │
           │ (prevents split-brain: stale worker can't overwrite)
           ▼
    Lease reclaimed, new lease issued to healthy worker
```

---

## 7. Key Files for Each Flow

| Flow | Key Files |
|------|-----------|
| Task Intake | `intake-router.ts`, `phase1b-orchestration.ts`, `transition-service.ts` |
| Dispatch → Lease → Writeback | `execution-dispatch-service.ts`, `execution-lease-service.ts`, `execution-worker-handshake/writeback-service.ts` |
| Approval | `approval-service.ts`, `transition-service.ts` |
| Recovery/Replay | `runtime-recovery-service.ts`, `runtime-recovery-replay-service.ts`, `durable-event-bus.ts` |
| Task State Machine | `transition-service.ts` (lines ~100-200 for Task transitions) |
| Lease Validation | `execution-lease-service.ts` (`validateWriteAccess()`) |