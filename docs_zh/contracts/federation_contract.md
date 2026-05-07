# Federation Contract

## 1. 范围

定义跨租户/跨区域联合查询与能力互联的边界。

## 2. 核心对象

```typescript
interface FederationRequest {
  requestId: string;
  tenantId: string;
  sourceRegion: string;
  targetRegion: string;
  intent: "query" | "search" | "handoff";
  dataResidencyClass: string;
}
```

## 3. 约束

- federation 只能在显式 allowlist 的 region / tenant 对之间发生。
- 跨边界查询必须保留数据驻留与脱敏策略。
- 任何 handoff 都必须记录来源、目标与 policy proof。

