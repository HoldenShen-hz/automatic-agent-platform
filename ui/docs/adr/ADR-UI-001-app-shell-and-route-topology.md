# ADR-UI-001 应用壳与路由拓扑

- 状态：Accepted
- 决策日期：2026-05-07

## 决策

UI shell 必须采用分层路由，而不是单层扁平页面集合。

- 一级导航按 `Mission Control / Operations / Governance / Admin / Extended / Shared Features` 组织。
- `Task Cockpit / Workflow Cockpit / Admin Takeover Console` 必须以 `harnessRunId` 作为 canonical 路由锚点。
- `taskId` 只允许作为 projection alias，用于兼容跳转或检索。

## 后果

- UI contract 与 runtime truth 保持一致。
- 旧 `workflow_id + steps[]` 页面不再作为权威入口。
