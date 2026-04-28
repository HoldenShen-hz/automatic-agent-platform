# ADR-099 Harness Async Mode

---

## OAPEFLIR 关联

- **Observe**: 接收异步队列、sleep lease 与外部事件
- **Assess**: 判断是否可继续执行
- **Plan**: 规划异步恢复与重新调度
- **Execute**: 通过 async harness 处理长时任务
- **Feedback**: 记录异步延迟、超时与恢复结果
- **Learn**: 汇总异步失败模式
- **Improve**: 优化异步策略与 backlog
- **Release**: Async Harness 作为 Ring 2 async-readiness 验收项

---

- 状态：Accepted
- 决策日期：2026-04-23

## 背景

长时任务、外部等待和人工审批都要求 Harness 拥有正式异步模式。

## 决策

- `AsyncHarnessService` 作为 Harness 的正式子系统
- async run 需要 queue / checkpoint / resume 能力
- sleep / wake / timeout 必须是同一生命周期模型的一部分

## 后果

- Harness 可承载真正的异步工作流

## v4.3 ADR Remediation

- A-31: 本 ADR 原先使用 `phase 8c` 作为交付门禁术语，根因是 async mode ADR 沿用了历史阶段排期，没有切换到主架构统一的 ring 口径。修复：正文现改为 `Ring 2 async-readiness`。
