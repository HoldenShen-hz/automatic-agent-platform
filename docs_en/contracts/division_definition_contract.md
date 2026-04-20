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

This contract defines the declarative configuration structure of divisions and the minimum requirements for roles, workflows, triggers, and retry strategies.

## 2. Division Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Division unique identifier |
| `version` | `string \| number` | Division definition version |
| `name` | `string` | Display name |
| `description` | `string` | Division description |
| `priority` | `number?` | Routing priority; higher value means higher priority |
| `triggers` | `string[]` | Routing trigger rules |
| `domain` | `string?` | Domain bound to this division |
| `tool_bundle_ref` | `string?` | Bound domain tool bundle |
| `plugin_refs` | `string[]?` | Allowed plugin references |
| `knowledge_namespace` | `string?` | Knowledge namespace for this division |
| `roles` | `RoleRef[]` | Role definition list |
| `default_workflow` | `string` | Default workflow ID |
| `orchestration_workflow` | `string?` | Multi-step orchestration workflow ID |

## 3. Trigger Rules

- Triggers are used for VP operations' first-round rule matching.
- High-frequency user language should be prioritized in expressions.
- Should not be overly broad to avoid multiple divisions大面积 overlapping matches.

## 4. RoleRef Minimum Fields

- `id`
- `name`
- `prompt`
- `model`
- `tools`
- `domain_id?`
- `max_instances?`

## 5. Workflow Rules

- `division.yaml` references workflows declared under the division through `default_workflow` / `orchestration_workflow`.
- Workflow definitions can be inline within loader-supported minimum definitions, or located in the `workflows/` directory and loaded by the loader.
- Data is passed between steps through output keys; if rework or rollback exists, it should be explicitly expressed without relying on implicit conventions.
- If a division declares `domain`, tool / plugin references in the workflow must match that domain.

## 6. Boundary with HR Agent

- HR Agent can suggest new roles within existing divisions.
- HR Agent's workflow patch is not automatically effective configuration by default.
- New divisions must be created manually.

## 7. Supplementary Rules

### 7.1 `AGENT.md` Loading

- Division-level `AGENT.md` only supplements the division's behavioral description and does not override platform hard rules.
- Load order should be: platform base -> division -> role.

### 7.2 Trigger Conflict Resolution

- First look at explicit priority, then more specific matches, then manual default routing.
- Conflict resolution results must be explainable and auditable.

### 7.3 Version and Migration

- `division.yaml` must carry a version.
- Breaking workflow / role changes must provide migration notes.
- In-flight tasks continue to be bound to the division version resolved at startup.

### 7.4 Domain Registry Integration

- Each division can bind at most one authoritative `domain`.
- `tool_bundle_ref`, `plugin_refs`, `knowledge_namespace` should be consistent with Domain Registry / Plugin Registry registration status.
- Divisions that do not declare `domain` may use general-purpose tool sets but must not impersonate domain-specialized divisions.
