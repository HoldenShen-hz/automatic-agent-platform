# Phase 1a Foundation

## 1. 目标

建立单 Agent 平台基建闭环，让系统具备可执行、可恢复、可审批、可计费和可观测的最小能力。

## 2. 进入条件

- [readiness_review.md](../../reviews/readiness_review.md) 对当前阶段保持 `ready`
- [operations-checklist.md](../operations-checklist.md) 当前阶段项可签收
- [operations-checklist.md](../operations-checklist.md) 可逐项勾核

## 3. 必做范围

- `src/`、`config/`、`divisions/`、`tests/` 目录骨架。
- 任务、工作流、审批、事件、成本相关核心类型。
- SQLite 单机存储初版。
- 单 Agent happy path。
- 基础 provider 抽象与工具执行抽象。
- edit 工具三层替换链：精确匹配、空白归一化、缩进归一化。
- 预算守卫、审批守卫、最小恢复路径。
- 测试单例 reset 基建与 fixture-only 测试基线。
- `/healthz` 基线与最小 inspect 查询。

## 4. 非目标

- 多事业部并行编排。
- 感知模块。
- 复杂记忆提取。
- Stage 2 compaction agent。
- 商业化功能。

## 5. 关键 contract / 主文档

- [task_and_workflow_contract.md](../../contracts/task_and_workflow_contract.md)
- [runtime_state_machine_contract.md](../../contracts/runtime_state_machine_contract.md)
- [runtime_execution_contract.md](../../contracts/runtime_execution_contract.md)
- [storage_schema_contract.md](../../contracts/storage_schema_contract.md)
- [event_bus_contract.md](../../contracts/event_bus_contract.md)
- [policy_engine_contract.md](../../contracts/policy_engine_contract.md)
- [gap-analysis.md](../gap-analysis.md)
- [gap-analysis.md](../gap-analysis.md)
- [operations-checklist.md](../operations-checklist.md)

## 6. 核心交付物

- Phase 1a 代码骨架。
- SQLite 初版 schema。
- 单通道接入能力。
- 核心 contract 对齐的测试集。

## 7. 验收与退出门槛

- 单 Agent 任务成功率达到既定基线。
- 审批和恢复链路可验证。
- 成本记录可追踪。
- 文档与实现无明显冲突。
- 当前阶段涉及模块已满足 `operations-checklist.md` 中对应的”当前阶段可验收”标准。
- Stable Core 范围未被隐式突破，稳定性阻塞项有明确关闭证据。

## 8. 风险与控制点

- 风险：过早引入多 Agent、远程 worker、复杂记忆。
- 控制：严格按单 Agent 主链收口，不抢跑后续阶段能力。
- 风险：SQLite/单机设计被误当成长期生产方案。
- 控制：实现时仍按 PG/queue 语义设计接口。

## 9. 向下一阶段交接

- Phase 1b 只能建立在 1a 主链稳定、状态/恢复/审批闭合的前提上。
- 任何未完成但被判定为“当前不做”的事项，必须留在 roadmap，不得隐式漂移进 1b。
