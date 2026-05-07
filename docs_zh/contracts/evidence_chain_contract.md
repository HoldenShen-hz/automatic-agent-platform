# Evidence Chain Contract

## 1. 范围

定义运行证据链的对象模型，覆盖 artifact、fact event、审计引用与校验哈希。

## 2. 核心对象

```typescript
interface EvidenceChainLink {
  evidenceId: string;
  harnessRunId: string;
  nodeRunId: string | null;
  sourceType: "artifact" | "event" | "audit" | "projection";
  sourceRef: string;
  hash: string | null;
  occurredAt: string;
}
```

## 3. 约束

- 任何可回放/可审计结论都必须能追到 `harnessRunId`。
- `nodeRunId` 缺失时必须说明该证据属于 run 级而非 node 级。
- 证据链不得仅依赖 `taskId` / `executionId`。

