# Dashboard And Operator Experience Contract

## 1. Scope

This contract defines operational dashboards, attention queues, and non-technical user experience for `§43-§44`.

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

The platform must support at least four layers of views:

- `operator`
- `domain_admin`
- `platform_ops`
- `fleet_admin`

Each layer view must be mappable to structured DTOs, not UI-private patching (composition).

## 4. `AttentionItem` Minimum Fields

- `item_type`
- `priority`
- `title`
- `description`
- `action_options`
- `domain_id`
- `created_at`

Rules:

- All objects requiring human action must enter `AttentionItem`.
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

- The UX layer is responsible only for guidance and presentation; it does not hold final governance authority.
- Non-technical UX defaults to showing summaries, templates, and wizards; it must not directly expose low-level runtime terminology.
- L1-L4 dashboards share the same evidence plane and consistent time baseline.

## 7. Test Requirements

- unit: dashboard aggregation, attention ranking, wizard step validation
- integration: console / dashboard linked with approval / incident / runtime data
- contract: different roles must not see unauthorized views