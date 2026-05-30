# SLA Tier Contract

## 1. Scope

This contract defines the SLA tier model and SLA-aware scheduling for §54.

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

- SLA tier must participate in queuing, resource reservation, preemption, and upgrade.
- Breach detection must distinguish between queue timeout, execution timeout, and dependency unavailable.
- Low tier must not starve high tier; high tier must not unlimited-preempt global resources.
- SLA evidence must be traceable back to `harness_run_id`, `node_run_id`, and corresponding `NodeAttemptReceipt`.
- `platinum` tier can only be externally committed when failover, quorum, drill, and capacity reservation evidence are all ready.

## 5. Test Requirements

- unit: tier resolution, breach classification
- integration: SLA-aware scheduling
- contract: Committed tier objects must retain auditable SLO evidence

## v4.3 Contract Remediation

- T-73: This document originally only defined SLA tiers themselves, without binding runtime chain evidence and high-tier prerequisites. Root cause: SLA contract first wrote business commitments, then added runtime verifiability. Fix: This version now requires SLA evidence to chain back to `HarnessRun / NodeRun / NodeAttemptReceipt`, and makes `platinum` prerequisites explicit.