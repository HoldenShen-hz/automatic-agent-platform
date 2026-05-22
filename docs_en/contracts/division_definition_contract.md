# Division Definition Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines the declarative configuration structure of a division, along with minimum requirements for roles, workflows, triggers, and retry strategies.

## 2. Division Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Division unique identifier |
| `version` | `string \| number` | Division definition version |
| `name` | `string` | Display name |
| `description` | `string` | Division description |
| `priority` | `number?` | Routing priority; higher value means higher priority |
| `triggers` | `string[]` | Routing trigger rules |
| `domain` | `string?` | Domain bound to the division |
| `tool_bundle_ref` | `string?` | Bound domain tool bundle |
| `plugin_refs` | `string[]?` | Allowed plugin references to load |
| `knowledge_namespace` | `string?` | Knowledge namespace for this division |
| `roles` | `RoleRef[]` | Role definition list |
| `default_plan_blueprint_ref` | `string` | Default PlanGraph/blueprint reference |
| `orchestration_plan_blueprint_ref` | `string?` | Multi-step orchestration blueprint reference |
| `default_workflow` | `string?` | Legacy loader alias |
| `orchestration_workflow` | `string?` | Legacy loader alias |

## 3. Trigger Rules

- Triggers are used for first-stage rule matching in VP operations.
- Should prioritize high-frequency user language.
- Should not be overly broad to avoid multiple divisions having large overlapping matches.

## 4. RoleRef Minimum Fields

- `id`
- `name`
- `prompt`
- `model`
- `tools`
- `domain_id?`
- `max_instances?`

## 5. Workflow Rules

- `division.yaml` should prioritize referencing orchestration blueprints via `default_plan_blueprint_ref` / `orchestration_plan_blueprint_ref`; `default_workflow` / `orchestration_workflow` are retained only as compatibility aliases.
- Workflow definitions can be inlined in the minimum definition supported by the loader, or placed in the `workflows/` directory and loaded by the loader as a whole.
- Data is passed between steps via output keys; if rework or rollback exists, it should be expressed explicitly, not relying on implicit conventions.
- If a division declares a `domain`, tool / plugin references in workflows must match that domain.

## v4.3 Contract Remediation

- T-72: This document originally described `default_workflow / orchestration_workflow` as canonical references. The root cause is that when the division contract was formed, the platform was still centered around the workflow loader and had not yet transitioned to plan blueprint and graph execution semantics. Fix: The body now elevates `*_plan_blueprint_ref` to the authoritative field, with the old workflow keys retained only for loader compatibility.

## 6. Boundary with HR Agent

- HR Agent can suggest new roles within existing divisions.
- HR Agent's workflow patches are not automatically effective configuration by default.
- New divisions must be created manually.

## 7. Supplementary Rules

### 7.0 `resource_boundaries` Budget Field

- If `resource_boundaries.budget_limit_per_task` is present, its unit is fixed to `USD`.
- The field must be a positive number representing the per-task budget ceiling, not an abstract score.
- The loader may expose `budget_limit_per_task_unit: "usd"` in its normalized runtime view.

### 7.1 `AGENT.md` Loading

- Division-level `AGENT.md` only supplements the behavioral description of that division and does not override platform hard rules.
- The loading order should be: platform base -> division -> role.

### 7.2 Trigger Conflict Resolution

- First check explicit priority, then more specific matches, then manual default routing.
- Conflict resolution results must be explainable and auditable.

### 7.3 Version and Migration

- `division.yaml` must carry a version.
- Breaking workflow / role changes must provide a migration note.
- In-flight tasks continue to be bound to the division version resolved at startup.

### 7.4 Domain Registry Integration

- Each division can bind at most one authoritative `domain`.
- `tool_bundle_ref`, `plugin_refs`, and `knowledge_namespace` should be consistent with the registered state in the Domain Registry / Plugin Registry.
- Divisions that do not declare a `domain` are allowed to use general-purpose tool sets but must not masquerade as domain-specialized divisions.
