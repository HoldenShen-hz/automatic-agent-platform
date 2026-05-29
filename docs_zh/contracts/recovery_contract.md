# Recovery Contract

> Scope note:
> 本文只定义恢复 cadence/report 最小对象。
> 幂等、补偿矩阵和工具恢复语义以 `idempotency_and_recovery_matrix_contract.md` 与 `tool_metadata_and_recovery_contract.md` 为准。

## 1. 范围

定义运行恢复 worker、恢复 cadence 与恢复报告对象。

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

- 恢复动作必须记录 cadence 与报告。
- 恢复不得隐式推进终态 run/node。
- 报告必须带 run/node 关联键而非只带 legacy execution id。
