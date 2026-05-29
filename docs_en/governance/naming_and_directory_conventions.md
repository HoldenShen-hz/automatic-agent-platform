# Naming And Directory Conventions

##1. Objective

Unify platform terminology, directory naming, and file naming, avoiding multiple sets of terminology across documents, configurations, and code.

##2. Core Terminology

Use the following terms uniformly:

- `HQ`: Headquarters layer capability
- `division`: Business division
- `role`: Role within division
- `task`: Task
- `workflow`: Workflow
- `artifact`: Artifact reference
- `approval`: Approval
- `gateway`: Channel access layer
- `provider`: Model provider layer

###2.2 OAPEFLIR Eight-Stage Terminology (Added2026-04-17)

Use the following OAPEFLIR terms uniformly:

| Stage | Term | Description |
|------|------|------|
| O | Observe / Observe Hub | Collect task/context/system state |
| A | Assess / Assess Hub | Pre-execution risk/complexity/resource evaluation |
| P | Plan / Plan Hub | Generate execution plan based on evaluation |
| E | Execute / Execute Hub | Call runtime to execute plan |
| F | Feedback / Feedback Hub | Collect execution result feedback signals |
| L | Learn / Learn Hub | Extract patterns/knowledge from signals |
| I | Improve / Improve Hub | Evaluate improvement candidates + guardrail |
| R | Rollout / Rollout | Controlled release of improvements to production |

Dual-chain topology terms:
- `Main chain`: O→A→P→E→F (real-time execution chain)
- `Sub chain`: F→L→I→R (asynchronous improvement chain)

Avoid mixing:

- Do not write `division` as `department` or `business-unit`.
- Do not mix `role`, `agent`, `worker` at the same semantic layer.
- Do not use `session` and `task` as synonyms.
- Do not use `tenant`, `workspace`, `organization` as synonyms.

###2.1 Canonical ID Format

When referring to control layer objects in documents, uniformly use:

- `canonical_id` (Business alias: narrative name)

For example:

- `strategic_governor` (Business alias: CEO)
- `intake_router` (Business alias: VP Operations)
- `workflow_planner` (Business alias: VP Orchestration)
- `division_lead` (Business alias: Lead Agent)

##3. File Naming Rules

- Mainline documents use `NN_topic.md`.
- ADRs use `NNN-topic.md`.
- Contracts use `snake_case_contract.md`.
- Guides use `kebab-case.md`.
- Governance / reviews / operations documents use `snake_case.md`.

##4. Directory Naming Rules

- Directories uniformly use lowercase letters and hyphens or underscores, no spaces.
- In `divisions/<division-id>/`, `<division-id>` must be stable and programmatically referenceable.
- File names under `roles/` should align with `role_id`.
- File names under `workflows/` should express business actions rather than author preferences.

##5. ID Conventions

- `task_id`, `approval_id`, `session_id`, `event_id` are platform-level unique identifiers.
- `division_id`, `role_id`, `tool_name` are stable readable identifiers, not depending on display names.
- External message IDs and platform internal IDs must be separated.

###5.1 Other Naming Conventions

- Event types uniformly use `<domain>.<action>`, such as `workflow.step_completed`.
- OAPEFLIR event types uniformly use `<stage>:<event>`, such as `feedback:collected`, `learning:object_promoted`, `improvement:auto_rollback`.
- Database tables uniformly use plural `snake_case`.
- Environment variables uniformly use `UPPER_SNAKE_CASE`.
- Config keys recommend using stable namespaces, such as `runtime.max_concurrency`.
- Feature flags recommend using `domain.feature_name` style, such as `gateway.enable_stream_bridge`.

###5.2 OAPEFLIR Module Directory Naming

New module directory naming follows these rules:

| Directory | Naming | Description |
|------|------|------|
| agent-loop | `agent-loop/` | OapeflirLoopService + Assess + Handoff |
| planning | `planning/` | PlanBuilder + DAG + Replanning |
| feedback | `feedback/` | Collector + Preprocessor + Consumer |
| learning | `learning/` | PatternDetector + Validator + Distillation |
| improvement | `improvement/` | Rollout + AutoRollback + Guardrail |
| knowledge | `knowledge/` | Ingestion + Query + Governance |
| domain-registry | `domain-registry/` | PluginSPI + DomainRegistry |
| plugins | `plugins/` | Domain Plugins + Adapters |

##6. Document and Code Synchronization Rules

- When adding new core objects, prioritize completing the contract before writing type definitions.
- If code naming conflicts with document naming, fix the document source of truth first, then unify the code.
- It is prohibited to invent parallel terminology in code for local implementation convenience.

##7. Document Writing Rules

- When narrative names and engineering names first appear in the same section, both mappings must be provided simultaneously.
- Tables, protocols, schemas, and event registries prefer canonical ids.
- When historical layer or research layer retains external project original names, it should be explicitly marked as "not the source of truth for this project".
