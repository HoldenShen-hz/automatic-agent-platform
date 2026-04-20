# Billing And Tenant Contract

## 1. Scope

This contract defines the minimum object model for metering, quotas, billing, plan boundaries, and future multi-tenant isolation.

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

- Metering, quotas, and billing must be traceable to tasks or principals.
- Isolation between Pro and Enterprise cannot rely solely on UI distinction.
- Before multi-tenant design enters implementation, tenant-level storage boundaries and permission boundaries must be clarified.
- Refunds, corrections, suspension due to arrears, and capability degradation must be expressed as independent accounting facts; do not directly rewrite historical usage.

## 7. Supplementary Rules

### 7.1 Payment Provider Interface

Payment providers should at minimum support:

- `create_subscription`
- `update_plan`
- `capture_invoice`
- `mark_payment_failed`
- `cancel_subscription`

### 7.2 Invoices and Refunds

- Invoices, refunds, and corrections must be traceable to `billing_account` and time window.
- Refunds must not silently rewrite the usage ledger; they should be expressed as independent adjustment records.

### 7.3 Enterprise Account Model

- `organization_account` is the Enterprise billing and policy ownership principal.
- Workspace / project resource consumption is ultimately aggregated to the organization-level accounting boundary.
