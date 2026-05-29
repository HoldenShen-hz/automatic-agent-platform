# Harness Run Lifecycle Contract

## 1. 范围

defines `HarnessRun` 从 admission 到终态的生命cyclevs恢复语义。

## 2. 生命cycle

`created -> admitted -> planning -> ready -> running -> {pausing|paused|replanning|compensating|completed|failed|cancelled|aborted}`

## 3. 约束

- 所有Status推进必须via `RuntimeStateMachine`。
- `HarnessRun` is唯一权威 run truth；任何 workflow/session onlyis projection。
- replanning 必须保留历史 `PlanGraphBundle`，via patch/新版本table达。
