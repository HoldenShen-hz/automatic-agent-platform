# ADR-UI-003 WebSocket Channel 与事件映射

- 状态：Accepted
- 决策日期：2026-05-07

## 决策

控制台实时推送采用 channel-based 模型，而不是 dashboard id 私有模型。

- channel 最少包含 `global / task:{harnessRunId} / approvals / admin`。
- message type 以 `task.status_changed / approval.created / approval.resolved / nl.clarification_needed / dashboard.snapshot / dashboard.delta` 为稳定边界。
- payload 必须可映射回 `harnessRunId / nodeRunId`。

## 后果

- UI shared client 可以统一路由 WS 事件。
- dashboard / cockpit / approval queue 不再各自维护私有推送协议。
