# ADR-094 Harness Durable Execution

---

## OAPEFLIR 关联

- **Observe**: 读取 run、checkpoint、sleep lease 与恢复状态
- **Assess**: 判断是否需要恢复或重放
- **Plan**: 规划 persist/checkpoint/resume 边界
- **Execute**: 落盘 run、step、decision 与上下文
- **Feedback**: 标记恢复结果与未决风险
- **Learn**: 分析故障恢复模式
- **Improve**: 优化 durable boundary
- **Release**: Durable 能力作为 Ring 2 durable-readiness 验收门

---

- 状态：Accepted
- 决策日期：2026-04-23

## 背景

没有持久化的 Harness 只能做短时计算，无法支持异步、恢复、重放和长期运行。

## 决策

- Durable Harness 负责 run persistence、checkpoint、restore、resume
- async run 必须支持 pause / resume
- checkpoint 是恢复和 replay 的 authoritative 入口

## 后果

- Harness 不再依赖单进程内存才能继续运行
- 崩溃恢复与长时任务有统一技术基线

## v4.3 ADR Remediation

- A-30: 本 ADR 原先使用 `phase 8b` 作为交付门禁术语，根因是 durable execution ADR 沿用了历史阶段排期，没有切换到主架构统一的 ring 口径。修复：正文现改为 `Ring 2 durable-readiness`。
