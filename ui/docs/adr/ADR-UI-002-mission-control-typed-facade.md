# ADR-UI-002 Mission Control Typed Façade

- 状态：Accepted
- 决策日期：2026-05-07

## 决策

UI 访问后端 presentation API 时，统一经 `MissionControlService` typed façade，而不是散落的自由路径拼接。

- façade 的 canonical 查询键为 `harnessRunId / nodeRunId / planGraphId`。
- `getTaskCockpitByTaskId()` 与 `getWorkflowCockpitByTaskId()` 只保留为 projection alias。
- 返回对象必须与 `docs_zh/contracts/sdk_surface_contract.md` 和 `ui_console_and_cockpit_contract.md` 对齐。

## 后果

- UI 不再把 task/workflow 旧投影当作 runtime truth。
- 端点命名与 contract 可做静态校验。
