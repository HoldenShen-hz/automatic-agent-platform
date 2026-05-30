# Dashboard And Operator Experience Contract

## 1. Scope

This contract defines operations dashboards, attention queues, and non-technical user experience for `§43-§44`.

## 2. Canonical Objects

- `AttentionItem`
- `OperatorDashboard`
- `DomainAdminDashboard`
- `PlatformOpsDashboard`
- `FleetDashboard`
- `DailySummary`
- `GuidedOnboardingSession`
- `WorkflowBuilderDraft`

## 3. Dashboard Layers

The platform must support at least four layers of views:

- `operator`
- `domain_admin`
- `platform_ops`
- `fleet_admin`

Each layer view must be mappable to structured DTOs and must not be UI-private拼接.

## 4. `AttentionItem` Minimum Fields

- `item_type`
- `priority`
- `title`
- `description`
- `action_options`
- `domain_id`
- `created_at`

Rules:

- All objects requiring human operation enter `AttentionItem` uniformly.
- AttentionItem must retain source object reference for drill-down.

## 5. UX Objects

`GuidedOnboardingSession` minimum fields:

- `session_id`
- `user_role`
- `current_step`
- `completed_steps`
- `recommended_templates`

`WorkflowBuilderDraft` minimum fields:

- `draft_id`
- `workflow_id?`
- `steps`
- `validation_findings`
- `owner_user_id`

## 6. Runtime Rules

- UX layer is only responsible for guidance and presentation and does not hold final governance authority.
- Non-technical UX defaults to displaying summaries, templates, and wizards, and does not directly expose low-level runtime terms.
- L1-L4 dashboards share the same evidence plane and consistent time基准.

## 7. Testing Requirements

- unit: dashboard aggregation, attention ranking, wizard step validation
- integration: console / dashboard with approval / incident / runtime data linkage
- contract: different roles cannot see unauthorized views