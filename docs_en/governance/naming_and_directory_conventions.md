# Naming And Directory Conventions

## 1. Objective

Unify platform terminology, directory naming, and file naming to prevent multiple conflicting names across documentation, configuration, and code.

## 2. Core Terminology

Use the following terms uniformly:

- `HQ`: Headquarters layer capabilities
- `division`: Business division
- `role`: Role within a division
- `task`: Task
- `workflow`: Workflow
- `artifact`: Artifact reference
- `approval`: Approval
- `gateway`: Channel access layer
- `provider`: Model provider layer

### 2.2 OAPEFLIR 8-Stage Terminology (Added 2026-04-17)

Use the following OAPEFLIR terms uniformly:

| Stage | Term | Description |
|------|------|-------------|
| O | Observe / Observe Hub | Collect task/context/system status |
| A | Assess / Assess Hub | Pre-execution risk/complexity/resource assessment |
| P | Plan / Plan Hub | Generate execution plan based on assessment |
| E | Execute / Execute Hub | Invoke runtime to execute plan |
| F | Feedback / Feedback Hub | Collect execution result feedback signals |
| L | Learn / Learn Hub | Extract patterns/knowledge from signals |
| I | Improve / Improve Hub | Evaluate improvement candidates + guardrail |
| R | Rollout / Rollout | Controlled release of improvements to production |

Dual-chain topology terminology:
- `Main Chain`: O→A→P→E→F (real-time execution chain)
- `Auxiliary Chain`: F→L→I→R (async improvement chain)

Avoid mixing:

- Do not write `division` as `department` or `business-unit`.
- Do not mix `role`, `agent`, `worker` at the same semantic layer.
- Do not treat `session` and `task` as synonyms.
- Do not treat `tenant`, `workspace`, `organization` as synonyms.

### 2.1 Canonical ID Format

When referencing control layer objects in documentation, use:

- `canonical_id` (business alias: narrative name)

Examples:

- `strategic_governor` (business alias: CEO)
- `intake_router` (business alias: VP Operations)
- `workflow_planner` (business alias: VP Orchestration)
- `division_lead` (business alias: Lead Agent)

## 3. File Naming Rules

- Main documents use `NN_topic.md`.
- ADRs use `NNN-topic.md`.
- Contracts use `snake_case_contract.md`.
- Guides use `kebab-case.md`.
- Governance / reviews / operations documents use `snake_case.md`.

## 4. Directory Naming Rules

- Directories use lowercase letters with hyphens or underscores; no spaces.
- `<division-id>` in `divisions/<division-id>/` must be stable and programmatically referenceable.
- Filenames under `roles/` should align with `role_id`.
- Filenames under `workflows/` should express business actions, not author preferences.

## 5. ID Conventions

- `task_id`, `approval_id`, `session_id`, `event_id` are platform-level unique identifiers.
- `division_id`, `role_id`, `tool_name` are stable readable identifiers; do not rely on display names.
- External message IDs and platform internal IDs must be separate.

### 5.1 Other Naming Conventions

- Event types use `<domain>.<action>` uniformly, e.g., `workflow.step_completed`.
- OAPEFLIR event types use `<stage>:<event>` uniformly, e.g., `feedback:collected`, `learning:object_promoted`, `improvement:auto_rollback`.
- Database tables use plural `snake_case`.
- Environment variables use `UPPER_SNAKE_CASE`.
- Config keys recommend stable namespaces, e.g., `runtime.max_concurrency`.
- Feature flags recommend `domain.feature_name` style, e.g., `gateway.enable_stream_bridge`.

### 5.2 OAPEFLIR Module Directory Naming

New module directories follow these naming rules:

| Directory | Naming | Description |
|------|------|-------------|
| agent-loop | `agent-loop/` | OapeflirLoopService + Assess + Handoff |
| planning | `planning/` | PlanBuilder + DAG + Replanning |
| feedback | `feedback/` | Collector + Preprocessor + Consumer |
| learning | `learning/` | PatternDetector + Validator + Distillation |
| improvement | `improvement/` | Rollout + AutoRollback + Guardrail |
| knowledge | `knowledge/` | Ingestion + Query + Governance |
| domain-registry | `domain-registry/` | PluginSPI + DomainRegistry |
| plugins | `plugins/` | Domain Plugins + Adapters |

## 6. Documentation and Code Synchronization Rules

- When adding core objects, prioritize completing contracts first, then write type definitions.
- If code naming conflicts with documentation naming, correct the documentation source of truth first, then unify code.
- Inventing parallel terminology in code for local implementation convenience is prohibited.

## 7. Documentation Writing Rules

- When a narrative name and engineering name first appear together in a chapter, both mappings must be provided.
- Tables, protocols, schemas, and event registries prioritize canonical IDs.
- When preserving external project names at historical/research layers, explicitly mark them as "not this project's source of truth."
