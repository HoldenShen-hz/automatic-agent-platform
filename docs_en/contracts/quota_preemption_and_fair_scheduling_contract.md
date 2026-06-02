# Quota Preemption And Fair Scheduling Contract

## 1. Scope

This contract defines resource quota, priority preemption, and fair scheduling for §53.

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

- Scheduling must consider at least the five dimensions of `tenant / org / domain / sla_tier / priority`.
- Preemption must emit a `PreemptionDecision` and record the preempted subject and reason.
- Fair scheduling must explicitly expose starvation protection and age weighting.

## 5. Testing Requirements

- unit: quota match, preemption scoring, fair queue ordering
- integration: high-priority tasks preempt low-priority tasks
- contract: over-quota tasks must not silently enter execution
