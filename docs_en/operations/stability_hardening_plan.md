# Stability Hardening Plan

> Document positioning:
> This document belongs to `operations/` execution plan layer, used to guide stability governance and implementation sequence.
> It is not the top-level architecture factual source; if conclusions affect system boundaries, must first write back to `01` ~ `07` and `contracts/`.

## 1. Goal

This document defines the stability hardening plan for Automatic Agent before entering "stable operation".

Here stability is not "process still alive", but simultaneously satisfying:

- Task/workflow/step state does not drift
- Execution rights are not double-written, duplicate advanced, or stale written back
- Crash, cancel, timeout, and retry all enter deterministic semantics
- Key events are not silently lost
- Tool side effects are not amplified in recovery chain
- Failures can be observed, analyzed, reconciled, and taken over

## 2. Current Structural Risks

As of current documentation state, 5 main structural risks closest to "stable operation":

1. Execution chain already designed complete, but real runtime has not yet produced stable operation evidence.
2. Events, state, recovery three chains have frozen contracts, but not yet verified by `kill -9/busy/cancel propagation/duplicate event` real verification.
3. SQLite is still current Stable Core baseline, needs stricter backup/restore/integrity/write-pressure foundation.
4. `bash/write/edit/MCP` high-risk tools need to truly form parameter, path, cancel, cleanup closed loop in implementation.
5. Long-term capabilities like remote worker, marketplace, complex multi-tenant have not entered current stabilization scope, must continue to be constrained by Stable Core.

## 3. Stability Hard Goals

### 3.1 Operational Goals

- Single-machine Stable Core runs continuously `7 ~ 14 days` without manual DB repair.
- `crash recovery` success rate reaches `100%` verification target.
- No orphan queue, zombie lock, stale owner continuously writing.
- Key task state remains consistent in inspect and persistence layer.

### 3.2 Governance Goals

- High-risk actions must go through Policy Engine and approval chain, cannot rely on prompt fallback.
- High-risk tool output cannot enter memory or long-term context without purification.
- Human takeover must be logged, cannot bypass policy and tenant boundaries.

## 4. P0/P1/P2 Hardening Checklist

### 4.1 P0

These must be prioritized completed, otherwise system should not claim "stable operation".

| P0 Item | Goal |
| --- | --- |
| Unified state closed loop | task/workflow/step/execution state consistent |
| Unified idempotency key and receipt | Key side effects and recovery chain replay without duplicate effect |
| Tier 1 event reliable delivery | Persist first then distribute, support ack/replay/dead-letter |
| Crash recovery measured | `kill -9`, `SQLITE_BUSY`, cancel propagation, half-written scenarios recoverable |
| Tool cancel/timeout/cleanup closed loop | Upper cancel truly propagates to LLM, tool, child process |
| SQLite foundation | `WAL/busy_timeout/foreign_keys/backup/integrity_check/restore verify` |
| Admission control | Do admission, degradation, or fail-fast before overload |
| Observability foundation | structured logs + metrics + trace + inspect can trace task timeline |

### 4.2 P1

| P1 Item | Goal |
| --- | --- |
| Reconciler | Periodically reconcile task/workflow/event/decision/lock |
| Human takeover capability | Retry step, skip step, override output, force unlock, end task |
| Stress test and long-run test | `24h/72h` soak, concurrency, fault injection |
| Configuration governance | Schema, version, audit, rollback |
| Stalled runtime detection | Distinguish "alive but no progress" from "completely lost" |

### 4.3 P2

| P2 Item | Goal |
| --- | --- |
| Remote worker lease | Multi-worker execution right and takeover chain stable |
| File sync consistency | hash/version/conflict semantics frozen |
| PG/Redis evolution | Prepare for higher concurrency and more formal queue |
| Industrial SLO/runbook/rollout | Elevate from Stable Core to production platform governance |

## 5. Permanent Stability Rules

From current phase, subsequent stability construction must long-term follow:

1. Backlog does not equal execution; any backlog must have clear dispatch chain.
2. Single instance appearing online does not equal no duplicate execution; must simultaneously have execution right and write permission protection.
3. Long tasks must have heartbeat/progress evidence; recovery must be layered.
4. Development-time fallback cannot long-term replace real approval and real policy evaluation.
5. Stability panel must express real blocking reasons, not just display "Idle/Busy".

## 6. Execution Sequence

Recommended sequence to continue:

1. State, idempotency, reliable event delivery
2. Crash recovery, cancel propagation, tool cleanup
3. SQLite backup/integrity/restore verification
4. Reconciler and human takeover
5. Stress test, soak, stable runtime verification
6. Then enter remote worker, PG/Redis, industrial extension

## 7. Related Documents

- [stable_core_scope.md](./stable_core_scope.md)
- [stable_runtime_validation_plan.md](./stable_runtime_validation_plan.md)
- [stable_launch_execution_plan.md](./stable_launch_execution_plan.md)
- [module_remediation_backlog.md](./module_remediation_backlog.md)
- [pre_launch_top20_hard_checklist.md](./pre_launch_top20_hard_checklist.md)
- [../reviews/stable_runtime_blockers_checklist.md](../reviews/stable_runtime_blockers_checklist.md)
- [../reviews/pre_stable_launch_blockers_checklist.md](../reviews/pre_stable_launch_blockers_checklist.md)
