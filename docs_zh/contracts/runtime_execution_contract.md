# Runtime Execution Contract

## 目的
定义运行时执行面的权威约束，覆盖 `HarnessRun`、`PlanGraphBundle`、`NodeRun`、`NodeAttempt`、执行租约、恢复与回放边界。

## 权威实现
- `src/platform/five-plane-execution/`
- `src/platform/five-plane-orchestration/harness/`
- `src/platform/contracts/executable-contracts/`

## 核心不变量
- Canonical 执行对象是 `HarnessRun -> PlanGraphBundle -> NodeRun -> NodeAttempt`。
- 新增执行能力不得回退到 step-centric truth model。
- 执行状态推进必须走仓储/服务层的 CAS 或等价原子更新路径。
- Lease、fencing、recovery、replay 必须显式携带 execution / run 标识，不允许隐式全局状态。

## 运维边界
- 恢复、修复、回放能力属于运行时控制能力，不代表业务侧重试一定允许。
- 文档与实现冲突时，以上述源码目录中的运行时契约和 schema 为准。
