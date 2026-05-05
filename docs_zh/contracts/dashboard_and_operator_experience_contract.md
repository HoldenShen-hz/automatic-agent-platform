# Dashboard And Operator Experience Contract

## 1. 范围

本 contract 定义 `§43-§44` 的运营看板、注意力队列和非技术用户体验。

## 2. Canonical 对象

- `AttentionItem`
- `OperatorDashboard`
- `DomainAdminDashboard`
- `PlatformOpsDashboard`
- `FleetDashboard`
- `DailySummary`
- `GuidedOnboardingSession`
- `WorkflowBuilderDraft`

## 3. 看板层次

平台必须至少支持四层视图：

- `operator`
- `domain_admin`
- `platform_ops`
- `fleet_admin`

每层视图都必须可映射为结构化 DTO，而不是 UI 私有拼接。

## 4. `AttentionItem` 最小字段

- `item_type`
- `priority`
- `title`
- `description`
- `action_options`
- `domain_id`
- `created_at`

规则：

- 所有需要人工操作的对象统一进入 `AttentionItem`。
- AttentionItem 必须保留来源对象引用，便于 drill-down。

## 5. UX 对象

`GuidedOnboardingSession` 最小字段：

- `session_id`
- `user_role`
- `current_step`
- `completed_steps`
- `recommended_templates`

`WorkflowBuilderDraft` 最小字段：

- `draft_id`
- `workflow_id?`
- `steps`
- `validation_findings`
- `owner_user_id`

## 6. 运行规则

- UX 层只负责引导与呈现，不持有最终治理权限。
- 非技术 UX 默认展示摘要、模板、向导，不直接暴露低层 runtime 术语。
- L1-L4 看板共享同一证据面与一致的时间基准。

## 7. 测试要求

- unit：dashboard aggregation、attention ranking、wizard step validation
- integration：console / dashboard 与 approval / incident / runtime 数据联动
- contract：不同角色不可见越权视图

## v4.3 Architecture Remediation

以下条目修复 `platform-architecture-implementation-consistency-audit.md` 中记录的 contract 偏差。本文档历史段落如与本节冲突，以本节、`docs_zh/architecture/00-platform-architecture.md`、ADR-109 至 ADR-113、以及 `src/platform/contracts/executable-contracts/` 为准。

- R16-86: 本 contract 定义看板与注意力队列，但未明确 dashboard 数据源必须锚定 v4.3 canonical entity。修复：正文现明确 `AttentionItem` 的 drill-down 引用必须能映射到 `HarnessRun` / `NodeRun`，看板展示不得直接拼装 `TaskRecord` / `WorkflowState` 作为 truth source；OAPEFLIR stage/iteration 视图只作为投影，不得作为运行时状态。

强制规则：`OperatorDashboard` / `PlatformOpsDashboard` 的执行状态聚合必须使用 `HarnessRun.status` + `NodeRun[]`；`AttentionItem.action_options` 必须携带可解析的 `harness_run_id` / `node_run_id` 作用域；旧 `workflow_run` / `TaskRecord` 只作为 legacy projection 查询兼容，不得作为新 dashboard 实现入口。

