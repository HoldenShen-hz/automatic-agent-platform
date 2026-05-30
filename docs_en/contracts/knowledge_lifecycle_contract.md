# Knowledge Lifecycle Contract

## 1. Scope

Defines the collection, validation, publication, retirement, and retraining boundaries of knowledge entries.

## 2. Core Objects

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

## 3. Constraints

- There must be validation and source evidence before entering `published`.
- Knowledge promotion must be associated with the `HarnessRun` or evidence chain that generated it.
- Retirement must not delete historical lineage.