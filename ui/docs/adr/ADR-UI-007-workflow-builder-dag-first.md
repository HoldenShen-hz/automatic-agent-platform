# ADR-UI-007 Workflow Builder 采用 DAG-first 草稿模型

- 状态：Accepted
- 决策日期：2026-05-07

## 决策

Workflow Builder 的草稿结构必须以 `PlanGraphDraft` 为 truth，而不是线性 `steps[]`。

- UI 中的步骤列表只是 graph 的投影视图。
- 草稿最少包含 `graphId / nodes / edges / entryNodeIds / terminalNodeIds / joinStrategy`。
- publish / validate API 都必须以 graph draft 为输入。

## 后果

- builder 与 runtime `PlanGraphBundle` 无需二次语义翻译。
- 条件分支、join、replan diff 可直接投影到 UI。
