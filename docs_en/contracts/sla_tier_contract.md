# SLA Tier Contract

## 1. Scope

This contract defines the SLA tiering model and SLA-aware scheduling for `§54`.

## 2. Canonical Objects

- `SlaTier`
- `SlaCommitment`
- `SlaRoutingHint`
- `SlaBreachRecord`

## 3. `SlaTier` Minimum Fields

- `tier_id`
- `display_name`
- `target_latency_ms`
- `target_success_rate`
- `max_queue_wait_ms`
- `preemption_priority`
- `reserved_capacity_percent`

## 4. Operational Rules

- SLA tier must participate in queuing, resource reservation, preemption, and escalation.
- Breach detection must distinguish between queue timeout, execution timeout, and dependency unavailable.
- Low tier must not starve high tier; high tier must not arbitrarily preempt global resources.
- SLA evidence must be traceable back to `harness_run_id`, `node_run_id`, and corresponding `NodeAttemptReceipt`.
- `platinum` tier can only be committed externally when failover, quorum, drill, and capacity reservation evidence are all in place.

## 4A. HarnessRun / NodeRun Integration Points

| Integration Scenario | Required Fields | Description |
| --- | --- | --- |
| SLA commitment binding | `harness_run_id`, `tier_id` | Each HarnessRun must carry SLA tier identifier |
| Latency tracking | `harness_run_id`, `node_run_id`, `queued_at`, `started_at`, `completed_at` | Used to calculate queue wait and execution latency |
| Success rate aggregation | `harness_run_id`, `node_run_id`, `attempt_id`, `status` | Aggregated by `NodeAttemptReceipt.status` |
| Budget association | `harness_run_id`, `node_run_id`, `budget_reservation_id` | Used for SLA cost accounting |
| Breakpoint traceback | `harness_run_id`, `node_run_id`, `receipt_id` | `SlaBreachRecord` must reference `NodeAttemptReceipt` |

**v4.3 Remediation**: The original document only stated "trace back to HarnessRun/NodeRun" without specifying integration field lists. Fix: This section now supplements the above table, specifying required fields for each integration scenario to ensure consistent anchors on the implementation side.

## 5. Testing Requirements

- unit: tier resolution, breach classification
- integration: SLA-aware scheduling
- contract: Objects with committed tier must retain auditable SLO evidence

## v4.3 Contract Remediation

- T-73: This document originally only defined SLA tiers themselves without binding runtime chain evidence and high-tier prerequisites. The root cause was that the SLA contract wrote business commitments first and then supplemented runtime verifiability. Fix: The main text now requires SLA evidence to trace back to `HarnessRun / NodeRun / NodeAttemptReceipt`, and makes `platinum` prerequisites explicit.