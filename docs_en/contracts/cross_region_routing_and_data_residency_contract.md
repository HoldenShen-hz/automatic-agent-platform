# Cross Region Routing And Data Residency Contract

## 1. Scope

This contract defines `§52` Region model, cross-region routing, and data residency constraints.

## 2. Canonical Objects

- `RegionDescriptor`
- `ResidencyPolicy`
- `CrossRegionRouteRequest`
- `CrossRegionRouteDecision`
- `ReplicationPolicy`

## 3. `RegionDescriptor` Minimum Fields

- `region_id`
- `provider`
- `control_plane_endpoint`
- `data_plane_endpoint`
- `country_code`
- `jurisdiction`
- `data_residency_policy`
- `capabilities`
- `status`

## 4. `CrossRegionRouteDecision` Minimum Fields

- `selected_region_id`
- `candidate_regions`
- `residency_decision`
- `latency_score`
- `recovery_topology`
- `blocked_regions`

## 5. Rules

- Data residency takes precedence over latency optimization.
- Cross-border transfer must have explicit policy and audit records.
- Regions not meeting residency requirements must be excluded from candidate sets.
- Cross-region route decision can only determine read routing, worker placement, and disaster recovery switching, and must not bypass truth write boundaries.
- Truth writes for `HarnessRun / NodeRun / BudgetLedger` must maintain single-writer semantics; cross-region takeover must complete CAS verification, lease transfer, and fencing token rotation first.
- A single `harness_run_id / node_run_id` can only have one active region owner capable of submitting truth mutations at any given moment.
- If region failure triggers takeover, the new writer region must first confirm the old lease is invalidated or explicitly recovered before proceeding with `RuntimeStateMachine.transition(command)`.

## 6. Test Requirements

- unit: region matching, residency checks, candidate scoring
- integration: cross-region routing and failover decision
- contract: residency-violating requests must not be scheduled to illegal regions



## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-42: This document previously described cross-region contract as a pure candidate region scoring model. Root cause: the documentation only covered routing/residency selection and did not include multi-region truth write boundaries and takeover semantics in the contract. Fix: The main text now supplements `RegionDescriptor` with `provider / control_plane_endpoint / data_plane_endpoint / data_residency_policy`, and explicitly states that cross-region takeover must comply with CAS, lease transfer, and fencing token rotation.

Mandatory Rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.