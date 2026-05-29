# ADR-099 Harness Async Mode

---

## OAPEFLIR 关联

- **Observe**: 接收异步队列、sleep lease vs外部事件
- **Assess**: 判断isno可继续执lines
- **Plan**: 规划异步恢复vs重新调度
- **Execute**: via async harness handle长时任务
- **Feedback**: record异步delay、timeoutvs恢复结果
- **Learn**: 汇总异步failed模式
- **Improve**: 优化异步策略vs backlog
- **Release**: Async Harness 作为 Ring 2 async-readiness 验收项

---

- Status：Accepted
- Decision日期：2026-04-23

## Background

长时任务、外部等待和人工审批都要求 Harness 拥有正式异步模式。

## Decision

- `AsyncHarnessService` 作为 Harness 的正式子系统
- async run 需要 queue / checkpoint / resume 能力
- sleep / wake / timeout 必须is同一生命cycle模型的一部分

## Consequences

- Harness 可承载真正的异步工作流

## v4.3 ADR Remediation

- A-31: 本 ADR 原先uses `phase 8c` 作为交付门禁术语，Root cause:  async mode ADR accesses along用了历史阶段排期，没有切换到主Architecture统一的 ring 口径。修复：正文现改为 `Ring 2 async-readiness`。
