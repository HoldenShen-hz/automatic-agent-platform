# Execution Sandbox Contract

## 1. 范围

定义执行面沙箱模式、路径/网络约束与逃逸拒绝语义。

## 2. 核心对象

```typescript
interface ExecutionSandboxPolicy {
  sandboxMode: "none" | "workspace_read" | "workspace_write" | "strict";
  allowedPaths: string[];
  allowedTools: string[];
  networkAccess: boolean;
  timeoutMs: number;
}
```

## 3. 约束

- 任一执行尝试都必须绑定 `ExecutionSandboxPolicy`。
- 未列入 `allowedPaths` 的写入必须拒绝。
- `networkAccess=false` 时不得通过 provider/tool 间接放开网络侧写。

