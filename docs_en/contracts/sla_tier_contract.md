# SLA Tier Contract

## 1. Scope

This contract defines SLA tier model and SLA-aware scheduling as per `§54`.

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

## 4. Operating Rules

- SLA tier must participate in queue, resource reservation, preemption, and escalation.
- Breach detection must distinguish queue timeout, execution timeout, and dependency unavailable.
- Low tier must not starve high tier; high tier must not unlimitedly preempt global resources.
- SLA evidence must at minimum be traceable back to `harness_run_id`, `node_run_id`, and corresponding `NodeAttemptReceipt`.
- `platinum` tier can only make external commitments when failover, quorum, drill, and capacity reservation evidence are all ready.

## 5. Testing Requirements

- unit: tier resolution, breach classification
- integration: SLA-aware scheduling
- contract: objects with committed tier must retain auditable SLO evidence

## v4.3 Contract Remediation

- T-73: This document originally only defined SLA tier itself, did not bind operating chain evidence and high-tier prerequisites. Root cause: SLA contract first wrote business commitment, then added runtime verifiability. Fix: Body now requires SLA evidence traceable to `HarnessRun / NodeRun / NodeAttemptReceipt`, and explicitly states `platinum` prerequisites.
