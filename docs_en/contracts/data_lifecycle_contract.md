# Data Lifecycle Contract

## 1. 范围

defines平台data从创建、热storage、归档、保留到删除的生命cycle边界。

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

- truth、event、audit retention 必须显式建模，不得relies on隐式data库defaults to值。
- `legalHoldSupported=true` 的data在 hold 期间不得自动删除。
- 归档vs删除都必须留下可审计record。

