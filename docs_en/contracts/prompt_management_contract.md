# Prompt Management Contract

## 1. Scope

Defines versioning, tenant isolation, release, and rollback boundaries for prompts.

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
- When referencing a prompt at runtime, the version must be recorded, not just the logical name.
