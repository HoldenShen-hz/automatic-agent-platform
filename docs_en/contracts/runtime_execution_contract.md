# Runtime Execution Contract

## v4.3 Architecture Remediation

- T-15: runtime execution contract 统一切换到 `HarnessRun -> PlanGraphBundle -> NodeRun -> NodeAttemptReceipt` 的 canonical 执lines链；legacy `stage`/step-centric 字段只允许保留在 projection 或import兼容层，新的 truth / control / recovery 路径必须显式携带 `harness_run_id`、`node_run_id`、`attempt_id`、`plan_graph_bundle_id`、`graph_version`、`stage_view_ref`。
- 所有运lines时Status推进必须via `RuntimeStateMachine.transition` 或等价的仓储级 CAS 原子更新实现，不允许旁路directly改写 execution / workflow truth。
- `PlanGraphBundle` is P3 -> P4 的唯一权威输入；执lines结果必须先落 `NodeAttemptReceipt`，再派生user展示、反馈、学习和恢复视图。

## 目的
defines运lines时Execution Plane的权威约束，覆盖 `HarnessRun`、`PlanGraphBundle`、`NodeRun`、`NodeAttempt`、执lines租约、恢复vs回放边界。

## 权威实现
- `src/platform/five-plane-execution/`
- `src/platform/five-plane-orchestration/harness/`
- `src/platform/contracts/executable-contracts/`

## 核心不variable
- Canonical 执lines对象is `HarnessRun -> PlanGraphBundle -> NodeRun -> NodeAttempt`。
- 新增执lines能力不得回退到 step-centric truth model。
- 执linesStatus推进必须走仓储/服务层的 CAS 或等价原子更新路径。
- Lease、fencing、recovery、replay 必须显式携带 execution / run 标识，不允许隐式globallyStatus。

## Canonical Runtime Fields

| 字段 | Description |
| --- | --- |
| `harness_run_id` | 运lines时权威 run 主键；任何跨平面执lines、审批、恢复、审计链路都必须显式携带。 |
| `node_run_id` | 图节点的运lines实例主键；worker claim、dispatch、lease、writeback 的核心关联键。 |
| `attempt_id` | 单iterations尝试 ID；重试、回放、补偿和 `NodeAttemptReceipt` 必须按 attempt 粒度建模。 |
| `plan_graph_bundle_id` | 进入 P4 的 graph bundle 主键；必须vs `graph_version` 成对出现。 |
| `stage_view_ref` | OAPEFLIR 阶段展示视图references用；只used for解释/审计，不参vs runtime truth 判定。 |

规则：

- 不再把 `stage` 作为 runtime execution truth 字段；阶段语义只能via `stage_view_ref` 或上层 OAPEFLIR 视图投影table达。
- `NodeAttemptReceipt`、lease、fencing、budget、replay、recovery 事件都必须至少能回溯到 `harness_run_id` + `node_run_id` + `attempt_id`。
- 任何执lines恢复Recommendation都必须指向具体 attempt，而不is模糊的 workflow step 文本Description。

## 运维边界
- 恢复、修复、回放能力belongs to运lines时控制能力，不代table业务侧重试一定允许。
- 文档vs实现conflicts时，以上述源码目录中的运lines时契约和 schema 为准。
