# Division Definition Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage loop:

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

This contract defines the declarative configuration structure of divisions, and minimum requirements for roles, workflows, triggers, and retry strategies.

## 2. Division Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Division unique identifier |
| `version` | `string \| number` | Division definition version |
| `name` | `string` | Display name |
| `description` | `string` | Division description |
| `priority` | `number?` | Routing priority, higher value means higher priority |
| `triggers` | `string[]` | Routing trigger rules |
| `domain` | `string?` | Domain bound to this division |
| `tool_bundle_ref` | `string?` | Bound domain tool bundle |
| `plugin_refs` | `string[]?` | Allowed plugin references |
| `knowledge_namespace` | `string?` | Knowledge namespace for this division |
| `roles` | `RoleRef[]` | Role definition list |
| `default_plan_blueprint_ref` | `string` | **canonical** PlanGraphBundle blueprint reference |
| `orchestration_plan_blueprint_ref` | `string?` | **canonical** multi-step orchestration PlanGraphBundle blueprint reference |
| `default_workflow` | `string?` | **deprecated** legacy loader alias, only for old data compatibility |
| `orchestration_workflow` | `string?` | **deprecated** legacy loader alias, only for old data compatibility |

Rules:
- `default_plan_blueprint_ref` and `orchestration_plan_blueprint_ref` are canonical references and must point to `PlanGraphBundle`.
- `default_workflow` / `orchestration_workflow` are retained only for backward compatibility and must not be used as primary keys for new designs.

## 3. Trigger Rules

- Triggers are used for VP operations' first-round rule matching.
- Should prioritize expressing high-frequency user language.
- Should not be too broad to avoid multiple divisions having large overlapping hits.

## 4. RoleRef Minimum Fields

- `id`
- `name`
- `prompt`
- `model`
- `tools`
- `domain_id?`
- `max_instances?`

## 5. Workflow Rules

- `division.yaml` should prioritize referencing orchestration blueprints through `default_plan_blueprint_ref` / `orchestration_plan_blueprint_ref`; `default_workflow` / `orchestration_workflow` are retained only as compatibility aliases.
- Workflow definitions can be inline in loader-supported minimal definitions, or located in `workflows/` directory and loaded by loader uniformly.
- Data is passed between steps through output keys; if rework or rollback exists, it should be explicitly expressed, not relying on implicit conventions.
- If division declares `domain`, tool / plugin references in workflow must match that domain.

## v4.3 Contract Remediation

- T-72: This document originally wrote `default_workflow / orchestration_workflow` as canonical references. The root cause was that when the division contract was formed, the platform was still centered on the workflow loader, and had not switched to plan blueprint and graph execution semantics. Fix: The main text now elevates `*_plan_blueprint_ref` to the authoritative field, and the old workflow keys are retained only as loader compatibility aliases.

## 6. Boundary with HR Agent

- HR Agent can suggest new roles within existing divisions.
- HR Agent's workflow patch is not automatically effective configuration by default.
- New divisions must be created manually.

## 7. Supplementary Rules

### 7.1 AGENT.md Loading

- Division-level `AGENT.md` only supplements that division's behavior description, does not override platform hard rules.
- Loading order should be: platform base -> division -> role.

### 7.2 Trigger Conflict Resolution

- First look at explicit priority, then more specific matches, then manual default routing.
- Conflict resolution results must be explainable and auditable.

### 7.3 Version and Migration

- `division.yaml` must carry version.
- Breaking workflow / role changes must provide migration note.
- Running tasks continue to bind to the division version parsed at startup.

### 7.4 Domain Registry Integration

- Each division can bind at most one authoritative `domain`.
- `tool_bundle_ref`, `plugin_refs`, `knowledge_namespace` should be consistent with Domain Registry / Plugin Registry registration status.
- Divisions that do not declare `domain` can use general tool sets, but must not impersonate domain-specialized division.