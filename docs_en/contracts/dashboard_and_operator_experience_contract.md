# Dashboard And Operator Experience Contract

## 1. Scope

This contract defines `§43-§44` operational dashboards, attention queues, and non-technical user experience.

## 2. Canonical Objects

- `AttentionItem`
- `OperatorDashboard`
- `DomainAdminDashboard`
- `PlatformOpsDashboard`
- `FleetDashboard`
- `DailySummary`
- `GuidedOnboardingSession`
- `WorkflowBuilderDraft`

## 3. Dashboard Hierarchy

The platform must support at minimum four view layers:

- `operator`
- `domain_admin`
- `platform_ops`
- `fleet_admin`

Each view layer must be mappable to structured DTOs, not UI-private stitching.

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
- AttentionItem must preserve source object references for drill-down.

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
- Non-technical UX defaults to showing summaries, templates, and wizards, not directly exposing low-level runtime terminology.
- L1-L4 dashboards share the same evidence plane and consistent time baseline.

## 7. Test Requirements

- unit: dashboard aggregation, attention ranking, wizard step validation
- integration: console / dashboard data linkage with approval / incident / runtime
- contract: different roles cannot see out-of-authority views

