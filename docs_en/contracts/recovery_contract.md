# Recovery Contract

> Scope note:
> This document defines only the minimum cadence/report objects for recovery.
> Idempotency, the compensation matrix, and tool recovery semantics are governed by `idempotency_and_recovery_matrix_contract.md` and `tool_metadata_and_recovery_contract.md`.

## 1. Scope

Defines the runtime recovery worker, recovery cadence, and recovery report objects.

## 2. Core Objects

```typescript
interface RecoveryCadence {
  workerId: string;
  intervalMs: number;
  maxConcurrentRuns: number;
}

interface RecoveryReport {
  reportId: string;
  harnessRunId: string | null;
  nodeRunId: string | null;
  outcome: "recovered" | "skipped" | "failed";
  reasonCode: string;
  createdAt: string;
}
```

## 3. Constraints

- Recovery actions must record cadence and reports.
- Recovery must not implicitly advance terminal-state run/node.
- Reports must carry run/node association keys, not just legacy execution ids.
