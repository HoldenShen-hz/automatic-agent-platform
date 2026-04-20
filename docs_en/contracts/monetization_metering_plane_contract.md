# Monetization Metering Plane Contract

## 1. Scope

This contract defines the commercial metering plane of the final platform, including usage metering, quota enforcement, entitlement evaluation, billing ledger, and plan catalog.

It extends `billing_and_tenant_contract.md` and `cost_and_budget_contract.md` to answer "how the platform connects usage, permissions, quotas, and billing into a closed loop."

## 2. Goals

- Elevate metering and quota from static fields to formal platform capabilities.
- Let runtime, API, and workspace permissions all consume entitlement decisions.
- Establish unified billing foundation for Pro and Enterprise charging models.
- Make usage, quota, billing, and tenant / organization models connectable.

## 3. Non-Goals

- This contract does not specify payment channel or tax product selection.
- This contract does not define market pricing strategy itself.
- This contract does not replace per-execution budget guard definition.

## 4. Core Components

- `UsageIngestionPipeline`
- `EntitlementEvaluator`
- `QuotaEnforcementHook`
- `BillingLedger`
- `PlanCatalog`
- `InvoiceBoundaryAdapter`

```mermaid
flowchart LR
    A["Runtime / API / Gateway"] --> B["EntitlementEvaluator"]
    B --> C["QuotaEnforcementHook"]
    C --> D["Execution / Feature Access"]
    D --> E["UsageIngestionPipeline"]
    E --> F["QuotaCounter"]
    E --> G["BillingLedger"]
    H["PlanCatalog"] --> B
    I["Tenant / Organization"] --> B
    G --> J["InvoiceBoundaryAdapter"]
```

## 5. Core Objects

- `UsageEvent`
- `EntitlementDecision`
- `QuotaCounter`
- `LedgerEntry`
- `PlanEntitlement`
- `BillingPeriod`

## 6. `UsageEvent` Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `usage_id` | `string` | Usage event ID |
| `subject_id` | `string` | Subject generating usage |
| `workspace_id?` | `string` | Associated workspace |
| `tenant_id?` | `string` | Associated tenant |
| `task_id?` | `string` | Associated task |
| `execution_id?` | `string` | Associated execution |
| `metric_type` | `string` | Metric type |
| `quantity` | `number` | Quantity |
| `source` | `runtime \| api \| gateway \| admin` | Source |
| `captured_at` | `timestamp` | Capture time |

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
- Number of enabled perception sources

## 8. `EntitlementDecision` Minimum Fields

- `decision_id`
- `subject_ref`
- `feature_key`
- `allowed`
- `decision_type` (`allow | deny | degrade | warn`)
- `reason?`
- `resolved_at`

Rules:

- Entitlement judgment must be able to be made before runtime execution.
- `degrade` is used for capability degradation, not complete rejection.
- `warn` can only be used in soft threshold scenarios that do not affect safety and billing correctness.

## 9. `QuotaCounter` and `LedgerEntry`

`QuotaCounter` minimum fields:

- `counter_id`
- `subject_ref`
- `metric_type`
- `window_start`
- `window_end`
- `used_quantity`
- `limit_quantity`
- `updated_at`

`LedgerEntry` minimum fields:

- `entry_id`
- `account_ref`
- `period_id`
- `entry_type`
- `amount`
- `currency`
- `source_refs`
- `recorded_at`

Rules:

- Quota counter serves real-time limits.
- Billing ledger serves billing and audit.
- Ledger must not depend on temporary in-memory cumulative results.
- Usage event, quota counter, and ledger entry must be reconcilable between each other and must not rely solely on final aggregated results.

## 10. Metering Granularity

Starting Phase 3, at minimum supports:

- token / model usage
- execution time
- tool call count
- artifact storage bytes
- active workspace count
- premium feature activation count

## 11. Typical Decision Path

1. User or system initiates action.
2. Runtime / API first requests `EntitlementEvaluator`.
3. Evaluator reads plan entitlement, quota counter, tenant/org ownership.
4. Returns `allow / deny / degrade / warn`.
5. After action executes, `UsageIngestionPipeline` writes back usage event.
6. Periodically or quasi-real-time aggregates into quota and ledger.

### 11.1 Commercial Closed-Loop Flow Diagram

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
    H --> J["Write BillingLedger"]
    I --> K["Next Decision"]
    J --> L["Billing / Audit"]
```

### 11.2 Metering Object Relationship Diagram

```mermaid
flowchart LR
    A["PlanCatalog"] --> B["PlanEntitlement"]
    B --> C["EntitlementDecision"]
    D["UsageEvent"] --> E["QuotaCounter"]
    D --> F["LedgerEntry"]
    C --> G["Runtime / API Gate"]
    E --> C
```

## 12. Quota Enforcement Rules

- When quota is exceeded, there must be unified `deny / degrade / warn` semantics.
- High-cost or high-risk capabilities prioritize hard deny.
- Experience capabilities can use degrade, e.g., reduce concurrency or delay execution.
- Quota judgment results should be traceable to plan entitlement and current counter.
- Entitlement decisions must not rely solely on stale cache; if authoritative counter is unavailable, should prioritize fail-closed or conservative degrade.

## 13. Tenant / Organization Relationship

- Workspace-level plans can map to org / tenant-level billing subjects.
- Enterprise settlement should support organization-level aggregation.
- Usage event must be attributable to workspace, tenant, or organization.

## 14. Relationship with Existing Documents

- `billing_and_tenant_contract.md` is the subject model baseline.
- `cost_and_budget_contract.md` is the per-execution budget baseline.
- `tenant_and_organization_contract.md` defines ownership boundaries.
- This contract defines the complete platform layer for product billing, quota, and billing.

## 15. Failure Mode

Key areas to prevent:

- Action executes successfully but usage not written back.
- Ledger delay causes billing inconsistency.
- Quota counter lags causing overdraft execution.
- Tenant ownership error during organization aggregation.

Handling principles:

- High-cost actions prefer to be conservative and deny rather than execute without metering.
- Usage pipeline and ledger pipeline must have compensation paths.
- Entitlement decisions prioritize authoritative counter over cached guess value.
- If action executed but usage not written back, system must be able to reconcile through reconciliation task, not silently lose metering.

## 16. Phased Introduction

- Phase 3: Pro usage metering + entitlement + quota enforcement.
- Phase 4: Enterprise ledger, organization settlement, audit, and invoice boundary.

## 17. Closure Conclusion

The core of monetization plane is not "post-hoc billing" but forming a closed loop between runtime, permissions, quota, and billing before and after execution.

Any future billing capability that cannot connect to usage, entitlement, and ledger three chains should not be considered a formal commercial capability.
