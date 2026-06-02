# Execution Sandbox Contract

## 1. Scope

Defines the execution-plane sandbox modes, path/network constraints, and escape-rejection semantics.

## 2. Core Objects

```typescript
interface ExecutionSandboxPolicy {
  sandboxMode: "none" | "workspace_read" | "workspace_write" | "strict";
  allowedPaths: string[];
  allowedTools: string[];
  networkAccess: boolean;
  timeoutMs: number;
}
```

## 3. Constraints

- Every execution attempt must be bound to an `ExecutionSandboxPolicy`.
- Writes to paths not in `allowedPaths` must be rejected.
- When `networkAccess=false`, network side effects must not be indirectly opened up via providers/tools.
