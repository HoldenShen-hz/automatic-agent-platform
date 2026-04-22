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
- **Release**: Durable 能力作为 phase 8b 验收门

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
