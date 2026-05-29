# Recovery Contract

> Scope note:
> 本文只defines恢复 cadence/report 最小对象。
> 幂等、补偿矩阵和工具恢复语义以 `idempotency_and_recovery_matrix_contract.md` vs `tool_metadata_and_recovery_contract.md` 为准。

## 1. 范围

defines运lines恢复 worker、恢复 cadence vs恢复报告对象。

## 2. 核心对象

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

## 3. 约束

- 恢复动作必须record cadence vs报告。
- 恢复不得隐式推进终态 run/node。
- 报告必须带 run/node 关联键而非只带 legacy execution id。
