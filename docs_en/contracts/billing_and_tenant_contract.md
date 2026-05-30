# Billing And Tenant Contract

---

## OAPEFLIR Relationship

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate assessment and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines the minimum object model for metering, quota, billing, plan boundaries, and future multi-tenant isolation.

## 2. Key Objects

- `UsageRecord`
- `QuotaPolicy`
- `BillingAccount`
- `BudgetLedger`
- `BudgetReservation`
- `PlanDefinition`
- `TenantBoundary`

Note:

- `UsageRecord` is the metering fact object.
- The truth definition of `BudgetLedger / BudgetReservation` is frozen in `budget-ledger-contract.md`; this document only defines their relationship with tenant / billing subject, and does not reinvent a second budget ledger.

## 3. UsageRecord Minimum Fields

- `usage_id`
- `subject_id`
- `tenant_id`
- `workspace_id?`
- `harness_run_id?`
- `node_run_id?`
- `task_id?`
- `metric_type`
- `quantity`
- `cost_source?`
- `captured_at`

## 4. BillingAccount Minimum Fields

- `account_id`
- `owner_id`
- `plan_id`
- `status`
- `balance_snapshot?`
- `created_at`

## 5. TenantBoundary Minimum Fields

- `tenant_id`
- `storage_scope`
- `artifact_scope`
- `identity_scope`
- `policy_scope`

## 6. Behavioral Constraints

- Metering, quota, and billing must be traceable to `tenant / subject / harness_run / node_run`.
- Pro vs Enterprise isolation strategy cannot be distinguished by UI alone.
- Before multi-tenant design enters implementation, tenant-level storage boundaries and permission boundaries must be clarified first.
- Refunds, reversals, overdue freezes, and capability degradation must be expressed as independent accounting facts; rewriting historical usage directly is not allowed.
- Bill aggregation must not bypass `BudgetLedger / BudgetReservation / BudgetSettlement` truth; usage and budget can only be derived one-way to billing projection.

## 7. Supplementary Rules

### 7.1 Payment Provider Interface

Payment providers should support at least:

- `create_subscription`
- `update_plan`
- `capture_invoice`
- `mark_payment_failed`
- `cancel_subscription`

### 7.2 Invoices and Refunds

- Invoices, refunds, and reversals must be traceable to `billing_account` and time window.
- Refunds must not silently rewrite `UsageRecord` or `BudgetLedger` history; they should be expressed as independent adjustment records.

### 7.3 Enterprise Account Model

- `organization_account` is the Enterprise billing and strategy ownership subject.
- Resource consumption of workspace / project is ultimately aggregated to the organization-level billing boundary.
- Organization-level billing projection must be able to trace back to `UsageRecord` and `BudgetLedger` under the tenant.

## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 to ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-40: This document originally continued using `UsageMeter` and had absolutely no relationship between tenant billing and frozen `BudgetLedger / BudgetReservation` written into the main text. Root cause: The billing contract stayed in product plan/billing perspective for a long time and did not synchronize with v4.3's usage fact and budget truth model upgrade. Fix: The main text now converges metering facts to `UsageRecord` and explicitly references `BudgetLedger / BudgetReservation` as the budget truth main chain, only allowing derivation to billing projection.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.