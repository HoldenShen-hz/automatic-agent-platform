# Prompt Management Contract

## 1. Scope

Define prompt versioning, tenant isolation, release, and rollback boundaries.

## 2. Core Objects

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

## 3. Constraints

- Prompts must explicitly carry `tenantId`.
- Both release and rollback must carry audit evidence and effective scope.
- When referencing prompts at runtime, must record the version and not just the logical name.