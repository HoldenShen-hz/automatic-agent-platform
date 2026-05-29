# Evidence Chain Contract

## 1. 范围

defines运lines证据链的对象模型，覆盖 artifact、fact event、审计references用vs校验哈希。

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

- 任何可回放/可审计Conclusion都必须能追到 `harnessRunId`。
- `nodeRunId` 缺失时必须Description该证据belongs to run 级而非 node 级。
- 证据链不得onlyrelies on `taskId` / `executionId`。

