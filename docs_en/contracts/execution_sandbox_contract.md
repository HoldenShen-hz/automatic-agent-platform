# Execution Sandbox Contract

## 1. Scope

Define execution plane sandbox mode, path/network constraints and escape rejection semantics.

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

- Any execution attempt must bind `ExecutionSandboxPolicy`.
- Writes to paths not listed in `allowedPaths` must be rejected.
- When `networkAccess=false`, must not indirectly enable network side writes through provider/tool.
