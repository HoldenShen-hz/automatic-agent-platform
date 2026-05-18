# Knowledge Lifecycle Contract

## 1. Scope

Defines the boundaries of knowledge entry collection, validation, publication, retirement, and retraining.

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

- Must have validation and source evidence before entering `published`.
- Knowledge promotion must be associated with the `HarnessRun` or evidence chain that produced it.
- Retirement must not delete historical lineage.
