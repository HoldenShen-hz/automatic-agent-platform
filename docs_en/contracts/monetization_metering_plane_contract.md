# Monetization Metering Plane Contract

---

## OAPEFLIR Association

This contract participates in the following phases of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines the commercialization metering plane for the ultimate platform, including usage metering, quota enforcement, entitlement evaluation, budget truth, settlement read model, and plan catalog.

It extends `billing_and_tenant_contract.md` and `cost_and_budget_contract.md` to answer "how the platform closes the loop connecting usage, entitlements, quotas, and billing".

## 2. Goals

- Elevate metering and quota from static fields to formal platform capabilities.
- Allow runtime, API, and workspace permissions to consume entitlement decisions.
- Establish a unified budget and settlement foundation for Pro and Enterprise billing models.
- Enable usage, quota, billing, and tenant / organization models to connect.

## 3. Non-Goals

- This contract does not mandate payment channel or tax product selection.
- This contract does not define market pricing strategy itself.
- This contract does not replace single execution budget guard definitions.

## 4. Core Components

- `UsageIngestionPipeline`
- `EntitlementEvaluator`
- `QuotaEnforcementHook`
- `BudgetLedgerProjector`
- `SettlementReadModel`
- `PlanCatalog`
- `InvoiceBoundaryAdapter`

```mermaid
flowchart LR
    A["Runtime / API / Gateway"] --> B["EntitlementEvaluator"]
    B --> C["QuotaEnforcementHook"]
    C --> D["Execution / Feature Access"]
    D --> E["UsageIngestionPipeline"]
    E --> F["QuotaCounter"]
    E --> G["BudgetLedgerProjector"]
    H["PlanCatalog"] --> B
    I["Tenant / Organization"] --> B
    G --> J["SettlementReadModel"]
    J --> K["InvoiceBoundaryAdapter"]
```

## 5. Core Objects

- `UsageEvent`
- `EntitlementDecision`
- `QuotaCounter`
- `SettlementReadEntry`
- `PlanEntitlement`
- `BillingPeriod`

Notes:

- `BudgetLedger / BudgetReservation / BudgetSettlement` are runtime truth; frozen definitions are in `budget-ledger-contract.md`.
- `SettlementReadModel / SettlementReadEntry` are derived read models for invoices, reconciliation, and commercial reporting, and must not reverse-act as budget truth.

## 6. `UsageEvent` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `usage_id` | `string` | Usage event ID |
| `subject_id` | `string` | Subject that generated usage |
| `workspace_id?` | `string` | Associated workspace |
| `tenant_id?` | `string` | Associated tenant |
| `harness_run_id?` | `string` | Associated run primary chain truth |
| `node_run_id?` | `string` | Associated node run truth |
| `task_id?` | `string` | Associated task projection |
| `execution_id?` | `string` | Legacy execution projection or migration input |
| `metric_type` | `string` | Metric type |
| `quantity` | `number` | Quantity |
| `source` | `runtime \| api \| gateway \| admin \| tool \| model \| side_effect` | Source |
| `cost_source` | `provider_invoice \| internal_compute \| human_review \| storage \| egress` | Cost attribution source |
| `captured_at` | `timestamp` | Capture time |

Rules:

- `harness_run_id / node_run_id` are v4.3 runtime truth alignment fields; `task_id / execution_id` are allowed only as projections, legacy query keys, or migration inputs retained.
- `source` indicates which type of entry point or execution source the usage came from; `cost_source` indicates which type of settlement basis ultimately drives the cost; the two must not be mixed.

## 7. `PlanEntitlement` Minimum Fields

- `plan_id`
- `feature_key`
- `limit_type` (`hard | soft | burst`)
- `limit_value`
- `reset_policy`
- `applies_to`

Examples:

- Monthly token limit
- Concurrent execution limit
- Number of available workspaces
- Number of enabled Observe sources

## 8. `EntitlementDecision` Minimum Fields

- `decision_id`
- `subject_ref`
- `feature_key`
- `allowed`
- `decision_type` (`allow | deny | degrade | warn`)
- `reason?`
- `resolved_at`

Rules:

- Entitlement decision must be available before runtime execution.
- `degrade` is for capability degradation, not complete rejection.
- `warn` can only be used for soft threshold scenarios that do not affect security and billing correctness.

## 9. `QuotaCounter`, `BudgetLedger`, and `SettlementReadEntry`

`QuotaCounter` minimum fields:

- `counter_id`
- `subject_ref`
- `metric_type`
- `window_start`
- `window_end`
- `used_quantity`
- `limit_quantity`
- `updated_at`

`BudgetLedger` / `BudgetReservation` / `BudgetSettlement`:

- Truth contract directly reuses `budget-ledger-contract.md`
- This document does not define another set of parallel ledger truth DTOs

`SettlementReadEntry` minimum fields:

- `entry_id`
- `account_ref`
- `period_id`
- `entry_type`
- `amount`
- `currency`
- `source_refs`
- `recorded_at`

Rules:

- Quota counter serves real-time limiting.
- `BudgetLedger` is responsible for pre-execution budget truth and settlement facts and must not rely on temporary in-memory accumulated results.
- `SettlementReadEntry` serves billing display, invoice boundary, and reconciliation reports.
- Usage event, quota counter, budget settlement, and settlement read entry must be reconcilable between each other and must not rely solely on final aggregate results.

## 10. Metering Granularity

From Phase 3, support at minimum:

- token / model usage
- execution time
- tool call count
- artifact storage bytes
- active workspace count
- premium feature activation count

## 11. Typical Decision Path

1. User or system initiates action.
2. Runtime / API first requests `EntitlementEvaluator`.
3. Evaluator reads plan entitlement, quota counter, and tenant/org ownership.
4. Returns `allow / deny / degrade / warn`.
5. After action execution, `UsageIngestionPipeline` writes back usage event.
6. Periodic or near-real-time aggregation enters quota, budget settlement, and settlement read model.

### 11.1 Commercialization Closed-Loop Flow Diagram

```mermaid
flowchart TD
    A["Action Request"] --> B["Entitlement Evaluation"]
    B --> C{"Allow / Deny / Degrade / Warn"}
    C -- "Deny" --> D["Reject Action"]
    C -- "Warn" --> E["Continue With Warning"]
    C -- "Degrade" --> F["Reduced Capability"]
    C -- "Allow" --> G["Execute Action"]
    E --> G
    F --> G
    G --> H["Capture UsageEvent"]
    H --> I["Update QuotaCounter"]
    H --> J["Project BudgetSettlement To SettlementReadModel"]
    I --> K["Next Decision"]
    J --> L["Billing / Audit"]
```

### 11.2 Metering Object Relationship Diagram

```mermaid
flowchart LR
    A["PlanCatalog"] --> B["PlanEntitlement"]
    B --> C["EntitlementDecision"]
    D["UsageEvent"] --> E["QuotaCounter"]
    D --> F["SettlementReadEntry"]
    C --> G["Runtime / API Gate"]
    E --> C
```

## 12. Quota Enforcement Rules

- Quota exceeding must have unified `deny / degrade / warn` semantics.
- High-cost or high-risk capabilities prioritize hard deny.
- Experience capabilities can use degrade, such as reducing concurrency or delaying execution.
- Quota decision results should be traceable to plan entitlement and current counter.
- Entitlement decisions must not rely solely on stale cache; if authoritative counter is unavailable, should prioritize fail-closed or conservative degrade.
- Commercial metering must not bypass `BudgetLedger / BudgetReservation / BudgetSettlement` truth to directly write invoice ledger fields.

## 13. Tenant / Organization Relationship

- Workspace-level plans can map to org / tenant-level billing subjects.
- Enterprise settlement should support organization-level aggregation.
- Usage events must be attributable to workspace, tenant, or organization.

## 14. Relationship with Existing Documents

- `billing_and_tenant_contract.md` is the primary model baseline.
- `cost_and_budget_contract.md` is the single execution budget baseline.
- `budget-ledger-contract.md` freezes `BudgetLedger / BudgetReservation / BudgetSettlement` as runtime truth.
- `tenant_and_organization_contract.md` defines ownership boundaries.
- This contract defines the complete platform layer for product billing, quota, budget truth, and settlement derived read model.

## 15. Failure Mode

Key points to guard against:

- Action executed successfully but usage not written back.
- Settlement read model delay or replay failure causing billing display inconsistency.
- Quota counter lag causing overdraft execution.
- Tenant ownership errors during organization aggregation.

Handling principles:

- High-cost actions should prefer conservative deny over metered execution.
- Usage pipeline, budget settlement projector, and settlement read model pipeline must have compensation paths.
- Entitlement decisions prioritize authoritative counter, not cached speculative values.
- If action has been executed but usage not written back, the system must be able to reconcile via reconciliation tasks, not silently lose metering.

## 16. Phased Introduction

- Phase 3: Pro usage metering + entitlement + quota enforcement.
- Phase 4: Enterprise ledger, organizational settlement, audit, and invoice boundary.

## 17. Closure Conclusion

The core of the monetization plane is not "post-hoc billing", but forming a closed loop before and after execution among runtime, entitlements, quotas, budget truth, and settlement read model.

Subsequent any billing capability that cannot integrate with usage, entitlement, and `BudgetLedger / BudgetReservation / BudgetSettlement` three chains should not be considered formal commercialization capability.

## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-35: This document originally wrote `BillingLedger / LedgerEntry` as the core object of the commercialization metering plane. The root cause was that the old version's copy mixed invoice/report read models and pre-execution budget truth into one layer, without synchronizing and restructuring after v4.3 introduced `BudgetLedger / BudgetReservation / BudgetSettlement`. Fix: The body now explicitly clarifies that budget truth reuses `budget-ledger-contract.md`, and `SettlementReadModel / SettlementReadEntry` are retained only as derived billing read models.
- T-55: The original `UsageEvent.source` in this document still停留在 `runtime / api / gateway / admin` four-type entry enum. The root cause was that paragraph followed the early API entry perspective and did not expand with the unified cost attribution model as tool execution, model calls, and side-effect settlement were integrated. Fix: The body now supplements `tool / model / side_effect` source and adds independent `cost_source` enum to carry `provider_invoice / internal_compute / human_review / storage / egress`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
