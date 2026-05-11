# Recovery Contract

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
- Recovery must not implicitly advance terminal-state runs/nodes.
- Reports must carry run/node correlation keys rather than legacy execution IDs alone.
