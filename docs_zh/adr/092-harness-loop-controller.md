# ADR-092 Harness Loop Controller

---

## OAPEFLIR 关联

- **Observe**: 读取当前 run、上下文、预算与阶段输入
- **Assess**: 判断是否继续、重试、重规划或转人工
- **Plan**: 安排下一轮 iteration 与阶段顺序
- **Execute**: 驱动 planner -> generator -> evaluator
- **Feedback**: 写入每轮 decision 与 timeline
- **Learn**: 沉淀循环失败模式
- **Improve**: 支持循环策略演化
- **Release**: 将 loop 行为纳入回归与演练

---

- 状态：Accepted
- 决策日期：2026-04-23

## 背景

Harness 需要从单轮 `runLoop()` 升级为可迭代、可中断、可恢复的主控循环，否则无法支撑长时任务、重试与异步挂起。

## 决策

- Loop Controller 作为 Harness 的正式控制器
- 每轮 iteration 都必须记录 step、decision、context snapshot 与 timeline
- 循环退出只允许通过六类 HarnessDecision 或预算上限触发
- loop controller 必须能处理 sleep / recover / HITL / resume

## 后果

- 迭代控制不再散落在单个 helper 中
- Harness 行为可重放、可恢复、可审计
