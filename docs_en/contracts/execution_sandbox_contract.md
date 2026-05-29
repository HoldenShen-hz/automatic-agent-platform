# Execution Sandbox Contract

## 1. 范围

definesExecution Plane沙箱模式、路径/network约束vs逃逸拒绝语义。

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

- 任一执lines尝试都必须绑定 `ExecutionSandboxPolicy`。
- 未列入 `allowedPaths` 的writes必须拒绝。
- `networkAccess=false` 时不得via provider/tool indirectly放开network侧写。

