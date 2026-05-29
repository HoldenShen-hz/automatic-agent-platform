# Prompt Management Contract

## 1. 范围

defines prompt 的版本化、租户隔离、发布vs回滚边界。

## 2. 核心对象

```typescript
interface PromptVersion {
  promptId: string;
  tenantId: string;
  version: string;
  status: "draft" | "active" | "deprecated" | "rolled_back";
  contentHash: string;
  updatedAt: string;
}
```

## 3. 约束

- prompt 必须显式带 `tenantId`。
- 发布vs回滚都必须带审计证据vs生效范围。
- 运lines时references用 prompt 时必须record版本而不is只record逻辑名称。

