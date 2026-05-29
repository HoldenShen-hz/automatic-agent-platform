# Dashboard And Operator Experience Contract

## 1. 范围

本 contract defines `§43-§44` 的运营看板、注意力队列和非技术user体验。

## 2. Canonical 对象

- `AttentionItem`
- `OperatorDashboard`
- `DomainAdminDashboard`
- `PlatformOpsDashboard`
- `FleetDashboard`
- `DailySummary`
- `GuidedOnboardingSession`
- `WorkflowBuilderDraft`

## 3. 看板层iterations

平台必须至少supported四层视图：

- `operator`
- `domain_admin`
- `platform_ops`
- `fleet_admin`

每层视图都必须可映射为结构化 DTO，而不is UI 私有拼接。

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
- AttentionItem 必须保留来源对象references用，便于 drill-down。

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

## 6. 运lines规则

- UX 层只负责references导vs呈现，不持有最终治理permission。
- 非技术 UX defaults to展示摘要、模板、向导，不directly暴露低层 runtime 术语。
- L1-L4 看板共享同一Evidence Planevs一致的time基准。

## 7. 测试要求

- unit：dashboard aggregation、attention ranking、wizard step validation
- integration：console / dashboard vs approval / incident / runtime data联动
- contract：不同角色不可见越权视图

