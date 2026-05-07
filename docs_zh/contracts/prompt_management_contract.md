# Prompt Management Contract

## 1. 范围

定义 prompt 的版本化、租户隔离、发布与回滚边界。

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
- 发布与回滚都必须带审计证据与生效范围。
- 运行时引用 prompt 时必须记录版本而不是只记录逻辑名称。

