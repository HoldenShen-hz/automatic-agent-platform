# Billing And Tenant Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR 8-stage loop:

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

This contract defines the minimum object model for metering, quota, billing, plan boundaries, and future multi-tenant isolation.

## 2. Key Objects

- `UsageMeter`
- `QuotaPolicy`
- `BillingAccount`
- `PlanDefinition`
- `TenantBoundary`

## 3. UsageMeter Minimum Fields

- `usage_id`
- `subject_id`
- `task_id?`
- `metric_type`
- `quantity`
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

- Metering, quota, and billing must be traceable to tasks or subjects.
- Isolation strategies for Pro and Enterprise cannot be distinguished by UI alone.
- Before multi-tenant design enters implementation, tenant-level storage boundaries and permission boundaries must be clarified.
- Refunds, reversals, overdue freezes, and capability degradation must be expressed as independent billing facts, and must not directly rewrite historical usage.

## 7. Supplementary Rules

### 7.1 Payment Provider Interface

Payment provider should at least support:

- `create_subscription`
- `update_plan`
- `capture_invoice`
- `mark_payment_failed`
- `cancel_subscription`

### 7.2 Invoices and Refunds

- Invoices, refunds, and reversals must be traceable to `billing_account` and time window.
- Refunds must not silently modify usage ledger; should be expressed as independent adjustment records.

### 7.3 Enterprise Account Model

- `organization_account` is the Enterprise billing and policy attribution subject.
- Resource consumption of workspace / project ultimately aggregates to organization-level billing boundary.
