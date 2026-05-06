# Multimodal Gateway Contract

## 1. 范围

本 contract 定义 `§68` 的多模态 `ModelGateway` 扩展、请求结构和安全边界。

## 2. Canonical 对象

- `MultimodalRequest`
- `MultimodalInputPart`
- `ModalityRouteDecision`
- `MultimodalSafetyFinding`

## 3. `MultimodalRequest` 最小字段

- `request_id`
- `harness_run_id` — canonical 执行关联（必填）
- `node_run_id?` — canonical 节点关联
- `tenant_id` — 租户关联（必填）
- `trace_id` — trace 关联（必填）
- `modalities`
- `input_parts`
- `requested_outputs`
- `safety_policy_ref`
- `cost_budget`

`input_parts.type` 至少支持：

- `text`
- `image`
- `audio`
- `document`
- `video`

## 4. 规则

- 多模态请求必须沿用统一 trace、budget 和 policy 约束。
- `ModalityRouter` 必须显式选择 provider / processor。
- 未通过安全检查的模态输入不得进入模型调用。
- `video` 输入必须通过结构化 video pipeline 标准化，至少产出 metadata、scene timeline、keyframe、quality/readiness assessment；若 transcript segment 不可得，必须以 conditional safety finding 暴露，而不是静默忽略。

## 5. 测试要求

- unit：request validation、route decision、safety findings
- integration：multimodal request -> gateway -> output，且 `video` 路径需覆盖 transcript segment、scene timeline、keyframe 与 gateway summary
- contract：非法模态类型不得静默降级为文本执行

## 6. 导出与兼容规则

- 多模态请求、路由决策和安全发现进入 API、event 或审计导出链时，必须保留 `harness_run_id`、`node_run_id?`、`tenant_id`、`trace_id` 与 `safety_policy_ref`。
- legacy `execution_id` 若仍存在于 adapter 层，只能作为查询别名，不得替代 canonical runtime 关联字段。
- `video`、`audio`、`document` 的衍生 artifact 必须通过 `ArtifactRef` 出口导出，不得把大对象直接嵌进主请求 envelope。
- 多模态 provider 回退必须显式记录 `ModalityRouteDecision`，不得静默改走文本-only 路径。
- 安全裁剪后的输入必须保留裁剪摘要与原始 artifact 引用，方便审计与恢复。

## v4.3 Contract Remediation

- T-45A: 本文早期版本不足 60 行，且缺少 v4.3 contract remediation 与 canonical runtime 关联约束。根因是多模态 gateway contract 先冻结了输入类型，却没有同步绑定 `HarnessRun / NodeRun / trace / budget` 这组 canonical 执行锚点。修复：正文现补齐 `harness_run_id`、`node_run_id`、`tenant_id`、`trace_id` 与 `cost_budget` 字段，并将 remediation 固化到本节。

强制规则：状态迁移必须通过 `RuntimeStateMachine.transition(command)`；执行计划必须使用 `PlanGraphBundle`；执行结果必须使用 `NodeAttemptReceipt`；truth event 只能使用 `platform.*`；OAPEFLIR 只能作为 `oapeflir.view.*` / rationale 投影；预算必须使用 `BudgetLedger / BudgetReservation / BudgetSettlement`。
