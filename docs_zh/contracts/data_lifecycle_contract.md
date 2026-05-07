# Data Lifecycle Contract

## 1. 范围

定义平台数据从创建、热存储、归档、保留到删除的生命周期边界。

## 2. 核心对象

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

## 3. 约束

- truth、event、audit retention 必须显式建模，不得依赖隐式数据库默认值。
- `legalHoldSupported=true` 的数据在 hold 期间不得自动删除。
- 归档与删除都必须留下可审计记录。

