# ADR-094 Harness Durable Execution

---

## OAPEFLIR 关联

- **Observe**: 读取 run、checkpoint、sleep lease vs恢复Status
- **Assess**: 判断isno需要恢复或重放
- **Plan**: 规划 persist/checkpoint/resume 边界
- **Execute**: 落盘 HarnessRun、NodeRun、NodeAttempt、decision vs上下文
- **Feedback**: 标记恢复结果vs未决风险
- **Learn**: 分析故障恢复模式
- **Improve**: 优化 durable boundary
- **Release**: Durable 能力作为 Ring 2 durable-readiness 验收门

---

- Status：Accepted
- Decision日期：2026-04-23

## Background

没有持久化的 Harness 只能做短时计算，no法supported异步、恢复、重放和长期运lines。

## Decision

- Durable Harness 负责 run persistence、checkpoint、restore、resume
- `NodeAttempt` vs其 receipt / compensation lineage belongs to durable replay 边界的一部分
- async run 必须supported pause / resume
- checkpoint is恢复和 replay 的 authoritative 入口

## Consequences

- Harness 不再relies on单进程内存才能继续运lines
- 崩溃恢复vs长时任务有统一技术基线

## v4.3 ADR Remediation

- A-30: 本 ADR 原先uses `phase 8b` 作为交付门禁术语，Root cause:  durable execution ADR accesses along用了历史阶段排期，没有切换到主Architecture统一的 ring 口径。修复：正文现改为 `Ring 2 durable-readiness`。
