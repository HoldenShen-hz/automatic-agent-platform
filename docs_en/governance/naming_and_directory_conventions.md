# Naming And Directory Conventions

## 1. Objective

Unify platform terminology, directory naming, and file naming to avoid multiple naming conventions among documents, configuration, and code.

## 2. Core Terminology

Use the following terms consistently:

- `HQ`: Headquarters layer capability
- `division`: Business division
- `role`: Role within division
- `task`: Task
- `workflow`: Workflow
- `artifact`: Artifact reference
- `approval`: Approval
- `gateway`: Channel access layer
- `provider`: Model supply layer

### 2.2 OAPEFLIR Eight-Stage Terminology (Added 2026-04-17)

Use the following OAPEFLIR terms consistently:

| Stage | Term | Description |
|------|------|-------------|
| O | Observe / Observe Hub | Collect task/context/system state |
| A | Assess / Assess Hub | Pre-execution risk/complexity/resource assessment |
| P | Plan / Plan Hub | Generate execution plan based on assessment |
| E | Execute / Execute Hub | Invoke runtime to execute plan |
| F | Feedback / Feedback Hub | Collect execution result feedback signals |
| L | Learn / Learn Hub | Extract patterns/knowledge from signals |
| I | Improve / Improve Hub | Evaluate improvement candidates + guardrail |
| R | Rollout / Rollout | Controlled release of improvements to production |

Dual-chain topology terms:
- `Main chain`: O→A→P→E→F (real-time execution chain)
- `Secondary chain`: F→L→I→R (async improvement chain)

Avoid mixing:

- Do not write `division` as `department` or `business-unit`.
- Do not mix `role`, `agent`, `worker` at the same semantic layer.
- Do not treat `session` and `task` as synonyms.
- Do not treat `tenant`, `workspace`, `organization` as synonyms.

### 2.1 Canonical ID Format

When control layer objects are mentioned in documents, use consistently:

- `canonical_id` (business alias: narrative name)

For example:

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

- Directories use lowercase letters with hyphens or underscores, no spaces.
- `<division-id>` in `divisions/<division-id>/` must be stable and program-referenceable.
- Filenames under `roles/` should align with `role_id`.
- Filenames under `workflows/` should express business actions, not author preferences.

## 5. ID Conventions

- `task_id`, `approval_id`, `session_id`, `event_id` are platform-level unique identifiers.
- `division_id`, `role_id`, `tool_name` are stable readable identifiers that do not depend on display names.
- External message IDs and platform internal IDs must be separate.

### 5.1 Other Naming Conventions

- Event types use `<domain>.<action>` consistently, such as `workflow.step_completed`.
- OAPEFLIR event types use `<stage>:<event>` consistently, such as `feedback:collected`, `learning:object_promoted`, `improvement:auto_rollback`.
- Database tables use plural `snake_case`.
- Environment variables use `UPPER_SNAKE_CASE`.
- Configuration keys recommend stable namespaces, such as `runtime.max_concurrency`.
- Feature flags recommend `domain.feature_name` style, such as `gateway.enable_stream_bridge`.

### 5.2 OAPEFLIR Module Directory Naming

New module directories follow these rules:

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

## 6. Document and Code Synchronization Rules

- When adding core objects, prioritize supplementing contracts, then write type definitions.
- If code naming conflicts with document naming, first correct document source of truth, then unify code.
- Prohibition against inventing parallel terminology in code for local implementation convenience.

## 7. Document Writing Rules

- When a canonical name and engineering name first appear together in the same chapter, both must be provided with mappings.
- Tables, protocols, schemas, and event registries prioritize canonical IDs.
- When historical or research layers retain external project names, explicitly mark "Not this project's source of truth".
