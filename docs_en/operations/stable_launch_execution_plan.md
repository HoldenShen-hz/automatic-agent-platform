# Stable Launch Execution Plan

> Document positioning:
> This document belongs to `operations/` execution plan layer, defining "what must be closed in what sequence before stable operation".
> It is not the top-level architecture factual source; if conclusions affect system boundaries, must first write back to `01` ~ `07` and `contracts/`.

## 1. Goal

This document organizes "what must be done before stable operation" into execution sequence.

It only cares about stabilization, not expanding functionality.

## 2. Execution Principles

- First tighten state, then tighten execution, then tighten data, finally supplement operations closed loop.
- Complete P0 first, then consider P1.
- Before Stable Core runs stably, do not expand system scope.
- If boundary changes found during execution, first modify main documents and contracts, then return to execution plan.

## 3. Batch 1: Clear Hard Failure Sources First

### 3.1 State Closed Loop

- Close task/workflow/step state machine.
- Fix illegal transition rejection strategy.
- Fix `cancel/fail/retry/resume/partial result` semantics.

### 3.2 Idempotency and Events

- Establish unified `idempotency_key` rules.
- Key events changed to persist first then distribute.
- Supplement key event ack, replay, deduplication, and failure table.
- Introduce Effect Buffer/post-transaction side effects to ensure authoritative state success before sending events, callback UI, and triggering external side effects.

### 3.3 Recovery and Cancel

- Complete crash recovery drill matrix.
- Complete task -> workflow -> tool -> child process cancel propagation.
- Supplement lock release, incomplete event/decision cleanup.

### 3.4 Tool Security

- Implement `bash/write/edit/MCP` parameter-level and path-level validation.
- Complete output sanitization, label isolation, and high-risk command interception.
- Remain fail-closed for unknown commands, interpreter inline scripts, `curl | bash` patterns.

### 3.5 Resource-Aware Retry

- Clarify error classification for `429/quota/busy/transient/auth/context_overflow`.
- Respect `retry-after`/`retry-after-ms`, unify jitter/breaker/limiter.
- `max_output_tokens`/continuation recovery should be in same reliability chain, not as scattered special cases.

## 4. Batch 2: Supplement Data and Operations Foundation

### 4.1 SQLite Foundation

- Backup and recovery automation.
- Disaster recovery playbook and restore readiness included in stable release checklist.
- `integrity_check` and corruption detection.
- Migration interruption test.
- Write rate limiting and long transaction control.

### 4.2 Reconciliation and Human Takeover

- Add reconciler.
- Add manual retry, skip, override output, force unlock, redispatch, end task.

### 4.3 Observability and Long-Run

- Structured logs, metrics, trace in place.
- Observability data retention policy in place: `tier_2/tier_3` events and terminal session non-summary messages are controllably cleaned; `tier_1` audit events and historical summaries retained.
- Observability dashboard baseline in place.
- Complete stress test, `24h` soak test, `72h` soak test.

## 5. Batch 3: Foundation for Next Phase

- Remote worker lease.
- Graceful maintenance drain drill, draining worker new dispatch rejection, and active lease step-boundary handover playbook.
- Tenant-gray cohort gray release, feature flag release, and rollback switch playbook.
- Rolling upgrade drill, canary repo-version routing, and step-boundary handover playbook.
- Remote file sync consistency verification.
- Security audit deepening.
- PostgreSQL/Redis evolution preparation.

## 6. Completion Determination

Only when all following conditions are met simultaneously can "first phase stabilization complete" be considered:

- [../reviews/pre_stable_launch_blockers_checklist.md](../reviews/pre_stable_launch_blockers_checklist.md) `P0` closed.
- Key evidence from [../reviews/stable_runtime_blockers_checklist.md](../reviews/stable_runtime_blockers_checklist.md) produced.
- All mandatory tests in [stable_runtime_validation_plan.md](./stable_runtime_validation_plan.md) passed.
- Stable Core scope not breached.

## 7. Related Documents

- [stability_hardening_plan.md](./stability_hardening_plan.md)
- [stable_core_scope.md](./stable_core_scope.md)
- [stable_runtime_validation_plan.md](./stable_runtime_validation_plan.md)
- [module_remediation_backlog.md](./module_remediation_backlog.md)
- [pre_launch_top20_hard_checklist.md](./pre_launch_top20_hard_checklist.md)
- [../reviews/pre_stable_launch_blockers_checklist.md](../reviews/pre_stable_launch_blockers_checklist.md)
- [../reviews/stable_runtime_blockers_checklist.md](../reviews/stable_runtime_blockers_checklist.md)
