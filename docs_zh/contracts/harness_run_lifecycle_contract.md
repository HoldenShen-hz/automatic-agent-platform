# Harness Run Lifecycle Contract

## 1. 范围

定义 `HarnessRun` 从 admission 到终态的生命周期与恢复语义。

## 2. 生命周期

`created -> admitted -> planning -> ready -> running -> {paused|replanning|compensating|completed|failed|aborted}`

## 3. 约束

- 所有状态推进必须经 `RuntimeStateMachine`。
- `HarnessRun` 是唯一权威 run truth；任何 workflow/session 仅是 projection。
- replanning 必须保留历史 `PlanGraphBundle`，通过 patch/新版本表达。

