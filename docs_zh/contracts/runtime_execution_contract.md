# Runtime Execution Contract

## v4.3 Architecture Remediation

- T-15: runtime execution contract 统一切换到 `HarnessRun -> PlanGraphBundle -> NodeRun -> NodeAttemptReceipt` 的 canonical 执行链；legacy `stage`/step-centric 字段只允许保留在 projection 或导入兼容层，新的 truth / control / recovery 路径必须显式携带 `harness_run_id`、`node_run_id`、`attempt_id`、`plan_graph_bundle_id`、`graph_version`、`stage_view_ref`。
- 所有运行时状态推进必须通过 `RuntimeStateMachine.transition` 或等价的仓储级 CAS 原子更新实现，不允许旁路直接改写 execution / workflow truth。
- `PlanGraphBundle` 是 P3 -> P4 的唯一权威输入；执行结果必须先落 `NodeAttemptReceipt`，再派生用户展示、反馈、学习和恢复视图。

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

## Canonical Runtime Fields

| 字段 | 说明 |
| --- | --- |
| `harness_run_id` | 运行时权威 run 主键；任何跨平面执行、审批、恢复、审计链路都必须显式携带。 |
| `node_run_id` | 图节点的运行实例主键；worker claim、dispatch、lease、writeback 的核心关联键。 |
| `attempt_id` | 单次尝试 ID；重试、回放、补偿和 `NodeAttemptReceipt` 必须按 attempt 粒度建模。 |
| `plan_graph_bundle_id` | 进入 P4 的 graph bundle 主键；必须与 `graph_version` 成对出现。 |
| `stage_view_ref` | OAPEFLIR 阶段展示视图引用；只用于解释/审计，不参与 runtime truth 判定。 |

规则：

- 不再把 `stage` 作为 runtime execution truth 字段；阶段语义只能通过 `stage_view_ref` 或上层 OAPEFLIR 视图投影表达。
- `NodeAttemptReceipt`、lease、fencing、budget、replay、recovery 事件都必须至少能回溯到 `harness_run_id` + `node_run_id` + `attempt_id`。
- 任何执行恢复建议都必须指向具体 attempt，而不是模糊的 workflow step 文本描述。

## 运维边界
- 恢复、修复、回放能力属于运行时控制能力，不代表业务侧重试一定允许。
- 文档与实现冲突时，以上述源码目录中的运行时契约和 schema 为准。
