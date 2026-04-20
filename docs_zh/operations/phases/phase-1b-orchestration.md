# Phase 1b Orchestration

## 1. 目标

在 Phase 1a 之上补齐 HQ 侧多 Agent 编排基础，让系统可以进行分诊、拆分、聚合和流式反馈。

## 2. 进入条件

- Phase 1a 主链已稳定跑通
- 单 Agent 审批、恢复、预算和事件链已闭合
- 基础 gateway / inspect / health 已可用
- 进入 1b 前已重新通过 `operations-checklist.md` 的当前阶段签收

## 3. 必做范围

- `intake_router` / `workflow_planner` 基础运行时（业务 alias：VP 运营 / VP 编排）。
- 多 Agent 任务拆分与依赖表达。
- 至少一个网关的 SSE / 流式输出。
- 任务看板或基础状态查询接口。
- 两阶段上下文压缩与消息裁剪策略。
- edit 工具的 fuzzy / context-anchored 替换增强。
- VCR replay 与流式 chunk 回放测试增强。
- debug dump、provider success rate 与背压降级增强。

## 4. 非目标

- 大规模多事业部生态。
- 复杂 HR Agent。
- Phase 3 商业化能力。
- 完整 execution plane 多 worker 调度。

## 5. 关键 contract / 主文档

- [agent_contract.md](../../contracts/agent_contract.md)
- [gateway_streaming_contract.md](../../contracts/gateway_streaming_contract.md)
- [message_parts_contract.md](../../contracts/message_parts_contract.md)
- [context_compaction_and_overflow_contract.md](../../contracts/context_compaction_and_overflow_contract.md)
- [edit_replacement_chain_contract.md](../../contracts/edit_replacement_chain_contract.md)
- [operations-checklist.md](../operations-checklist.md)

## 6. 核心交付物

- 多 Agent orchestration 最小闭环。
- 任务状态可视化或查询能力。
- 流式回复链路。
- Phase 1b 集成测试集。

## 7. 验收与退出门槛

- 多 Agent 端到端成功率达标。
- 聚合输出与 trace 能稳定回溯。
- 上下文压缩不会破坏核心任务成功率。
- fuzzy edit 只在唯一候选和足够相似时生效，并保留 warning。
- 当前阶段涉及模块已满足 `operations-checklist.md` 中对应的“当前阶段可验收”标准。

## 8. 风险与控制点

- 风险：把 Phase 1b 误做成完整 execution plane 或远程 worker。
- 控制：仅做最小编排，不引入多 worker 控制面。
- 风险：流式输出与任务事实状态分叉。
- 控制：streaming 只表达展示语义，不替代 task/execution 真相。

## 9. 向下一阶段交接

- 2a 接手的是“多个 division 的平台验证”，不是在 1b 内偷做多事业部。
- 进入 2a 前，应先把 orchestration、context 和 streaming 稳定性跑通。
