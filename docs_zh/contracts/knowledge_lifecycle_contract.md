# Knowledge Lifecycle Contract

## 1. 范围

定义知识条目的采集、验证、发布、退役与再训练边界。

## 2. 核心对象

```typescript
interface KnowledgeLifecycleRecord {
  knowledgeId: string;
  tenantId: string;
  sourceRef: string;
  lifecycleState: "draft" | "validated" | "published" | "retired";
  promotedFromRunId: string | null;
  updatedAt: string;
}
```

## 3. 约束

- 进入 `published` 前必须有验证与来源证据。
- 知识 promotion 必须关联产生它的 `HarnessRun` 或 evidence chain。
- retirement 不得删除历史 lineage。

