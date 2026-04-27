# Billing And Tenant Contract

---

## OAPEFLIR Association

This contract participates in the following phases of the OAPEFLIR eight-phase loop:

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

This contract defines metering, quotas, billing, plan boundaries, and the minimum object model for future multi-tenant isolation.

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

## 6. Behavior Constraints

- Metering, quotas, and billing must be traceable to tasks or subjects.
- Pro and Enterprise isolation strategies cannot rely on UI distinction alone.
- Before multi-tenant design enters implementation, tenant-level storage boundaries and permission boundaries must be clarified.
- Refunds, reversals, overdue freezes, and capability downgrades must be expressed as independent accounting facts, not directly rewriting historical usage.

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
- Refunds must not silently rewrite usage ledger; should be expressed as independent adjustment records.

### 7.3 Enterprise Account Model

- `organization_account` is the Enterprise billing and policy ownership subject.
- Resource consumption of workspace / project ultimately aggregates to organization-level accounting boundary.
