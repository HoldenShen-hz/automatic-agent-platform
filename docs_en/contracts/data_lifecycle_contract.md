# Data Lifecycle Contract

## 1. Scope

Defines the lifecycle boundaries for platform data from creation, hot storage, archiving, retention to deletion.

## 2. Core Objects

```typescript
interface DataLifecyclePolicy {
  policyId: string;
  dataClass: "runtime_truth" | "event_log" | "artifact" | "audit" | "cache";
  retentionDays: number;
  archiveAfterDays: number | null;
  deleteAfterDays: number | null;
  legalHoldSupported: boolean;
}
```

## 3. Constraints

- truth, event, and audit retention must be explicitly modeled and must not rely on implicit database defaults.
- Data with `legalHoldSupported=true` must not be automatically deleted during a hold period.
- Both archiving and deletion must leave auditable records.
