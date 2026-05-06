# Quota Preemption And Fair Scheduling Contract

## 1. Scope

This contract defines resource quotas, priority preemption, and fair scheduling for `§53`.

## 2. Canonical Objects

- `QuotaPolicy`
- `SchedulingClass`
- `PreemptionDecision`
- `FairQueueSnapshot`
- `ResourceClaim`

## 3. `QuotaPolicy` Minimum Fields

- `scope`
- `resource_type`
- `hard_limit`
- `soft_limit`
- `burst_limit?`
- `reset_window`

## 4. Scheduling Rules

- Scheduling must consider at least five dimensions: `tenant / org / domain / sla_tier / priority`.
- Preemption must output `PreemptionDecision` and record the preempted object and reason.
- Fair scheduling must explicitly expose starvation protection and age weighting.

## 5. Test Requirements

- unit: quota match, preemption scoring, fair queue ordering
- integration: high-priority tasks preempting low-priority tasks
- contract: over-quota tasks must not silently enter execution

## 6. Association and Export Rules

- When `PreemptionDecision` is exported, it must include `harness_run_id`, `node_run_id?`, `attempt_id?`, `quota_policy_ref`, `reason_code`.
- `FairQueueSnapshot` must expose backlog and wait time for `tenant`, `org`, `domain`, `sla_tier`, `priority` dimensions.
- `ResourceClaim` cannot just reference queue tickets; it must be traceable back to `HarnessRun / NodeRun` on runtime truth.
- Legacy `execution_id`, `workflow_id` are only allowed as migration-period query aliases and must not become quota decision primary keys.

## 7. ContractEnvelope Alignment

- All externally published quota / preemption / fairness objects must declare `schema_version`, `idempotency_key?`, `causation_id?`, `partition_key?`, `ttl?` or equivalent envelope fields.
- If an object is only used within a process, envelope may be omitted; once it enters event, API, or audit export chain, the above metadata must be added.

## 8. Closure Conclusion

- Quota decisions must be able to explain "why blocked, why allowed, why preempted".
- Fair scheduling must be able to explain "why this tenant/domain/priority executed first".
- Any over-quota allowance must leave explicit policy / approval exception evidence.
- Recovery or compensation paths after resource preemption must also be auditable; preempted objects must not be silently dropped back into the queue.
- Quota contract only freezes canonical runtime boundaries and does not grant any implementation the privilege to bypass budget truth.

## v4.3 Contract Remediation

- T-45: This document was originally less than 60 lines and lacked ContractEnvelope compliance declaration and remediation section. v4.3 requires all contracts to include a v4.3 Contract Remediation section recording historical deviations and fix conclusions. Fix: This section was added, and new objects must carry `harness_run_id` / `node_run_id` association fields.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger / BudgetReservation / BudgetSettlement`.
