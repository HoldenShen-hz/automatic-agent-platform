# ADR-092 Harness Loop Controller

---

## OAPEFLIR 关联

- **Observe**: 读取当前 run、上下文、budgetvs阶段输入
- **Assess**: 判断isno继续、重试、重规划或转人工
- **Plan**: 安排下一轮 iteration vs阶段顺序
- **Execute**: 驱动 planner -> generator -> evaluator
- **Feedback**: writes每轮 decision vs timeline
- **Learn**: 沉淀循环failed模式
- **Improve**: supported循环策略演化
- **Release**: 将 loop lines为纳入回归vs演练

---

- Status：Accepted
- Decision日期：2026-04-23

## Background

Harness 需要从单轮 `runLoop()` 升级为可迭代、可中断、可恢复的主控循环，no则no法支撑长时任务、重试vs异步挂起。

## Decision

- Loop Controller 作为 Harness 的正式控制器
- 每轮 iteration 都必须record `NodeRun / NodeAttempt`、decision、context snapshot vs timeline
- 循环退出只允许via六class HarnessDecision 或budgetupper limit触发
- loop controller 必须能handle sleep / recover / HITL / resume

## Consequences

- 迭代控制不再散落在单个 helper 中
- Harness lines为可重放、可恢复、可审计

## v4.3 ADR Remediation

- A-33: 本 ADR 原先用 `step / decision` record主time线，Root cause:  loop controller ADR 继承了语义 step 叙事，没有随着 `NodeRun / NodeAttempt` 成为执lines真相对象而改写。修复：正文现将time线主语收敛到 `NodeRun / NodeAttempt`，step 只保留为语义投影。
