# Naming And Directory Conventions

## 1. Goal

Unify platform terminology, directory naming, and file naming, avoid multiple naming systems appearing across documents, configurations, and code.

## 2. Core Terminology

Unified use of the following terms:

- `HQ`: Headquarters layer capabilities
- `division`: Business division
- `role`: Role within division
- `task`: Task
- `workflow`: Workflow
- `artifact`: Artifact reference
- `approval`: Approval
- `gateway`: Channel access layer
- `provider`: Model supply layer

Avoid mixing:

- Do not write `division` as `department` or `business-unit`.
- Do not mix `role`, `agent`, `worker` at the same semantic layer.
- Do not treat `session` and `task` as synonyms.
- Do not treat `tenant`, `workspace`, `organization` as synonyms.

### 2.1 Canonical ID Writing

When involving control layer objects in documents, unified use:

- `canonical_id` (business alias: narrative name)

For example:

- `strategic_governor` (business alias: CEO)
- `intake_router` (business alias: VP Operations)
- `workflow_planner` (business alias: VP Orchestration)
- `division_lead` (business alias: Lead Agent)

## 3. File Naming Rules

- Main documents use `NN_topic.md`.
- ADR uses `NNN-topic.md`.
- Contract uses `snake_case_contract.md`.
- Guide uses `kebab-case.md`.
- Governance/reviews/operations documents use `snake_case.md`.

## 4. Directory Naming Rules

- Directories uniformly use lowercase letters with hyphens or underscores, no spaces.
- `<division-id>` in `divisions/<division-id>/` must be stable and programmatically referenceable.
- Filenames under `roles/` should align with `role_id`.
- Filenames under `workflows/` should express business actions, not author preferences.

## 5. ID Conventions

- `task_id`, `approval_id`, `session_id`, `event_id` are platform-level unique identifiers.
- `division_id`, `role_id`, `tool_name` are stable readable identifiers, not dependent on display names.
- External message IDs and platform internal IDs must be separate.

### 5.1 Other Naming Conventions

- Event types uniformly use `<domain>.<action>`, such as `workflow.step_completed`.
- Database tables uniformly use plural `snake_case`.
- Environment variables uniformly use `UPPER_SNAKE_CASE`.
- Config keys recommend stable namespace, such as `runtime.max_concurrency`.
- Feature flags recommend `domain.feature_name` style, such as `gateway.enable_stream_bridge`.

## 6. Document and Code Synchronization Rules

- When adding core objects, prioritize supplementing contracts, then write type definitions.
- If code naming conflicts with document naming, first correct document factual source, then unify code.
- Prohibit inventing parallel terminology in code for local implementation convenience.

## 7. Document Writing Rules

- When a chapter first appears, both narrative and engineering names must be provided at the same time.
- Tables, protocols, schemas, and event registries prioritize canonical id.
- When historical layer and research layer retain external project original names, should explicitly mark "not this project's factual source".
