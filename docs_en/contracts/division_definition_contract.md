# Division Definition Contract

## 1. Scope

This contract defines the declarative configuration structure of divisions and minimum requirements for roles, workflows, triggers, and retry policies.

## 2. Division Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Division unique identifier |
| `version` | `string \| number` | Division definition version |
| `name` | `string` | Display name |
| `description` | `string` | Division description |
| `priority` | `number?` | Routing priority; higher value means higher priority |
| `triggers` | `string[]` | Routing trigger rules |
| `domain` | `string?` | Domain bound to division |
| `tool_bundle_ref` | `string?` | Bound domain tool bundle |
| `plugin_refs` | `string[]?` | Allowed plugin references |
| `knowledge_namespace` | `string?` | Knowledge namespace for this division |
| `roles` | `RoleRef[]` | Role definition list |
| `default_workflow` | `string` | Default workflow ID |
| `orchestration_workflow` | `string?` | Multi-step orchestration workflow ID |

## 3. Trigger Rules

- Triggers are used for VP operations' first-round rule matching.
- Should prioritize expressing high-frequency user language.
- Should not be too broad to avoid multiple divisions large-area overlapping matches.

## 4. RoleRef Minimum Fields

- `id`
- `name`
- `prompt`
- `model`
- `tools`
- `domain_id?`
- `max_instances?`

## 5. Workflow Rules

- `division.yaml` references workflows declared under this division through `default_workflow` / `orchestration_workflow`.
- Workflow definitions can be inline in the loader-supported minimum definition or located in the `workflows/` directory and loaded by the loader.
- Data is passed between steps through output keys; if rework or rollback exists, it should be explicitly expressed and not rely on implicit conventions.
- If a division declares `domain`, tool / plugin references in the workflow must match that domain.

## 6. Boundary with HR Agent

- HR Agent can suggest new roles within existing divisions.
- HR Agent's workflow patch is not automatically effective configuration by default.
- New divisions must be created manually.

## 7. Supplementary Rules

### 7.1 `AGENT.md` Loading

- Division-level `AGENT.md` only supplements that division's behavioral description and does not override platform hard rules.
- Loading order should be: platform base -> division -> role.

### 7.2 Trigger Conflict Resolution

- First look at explicit priority, then more specific matches, then manual default routing.
- Conflict resolution results must be explainable and auditable.

### 7.3 Version and Migration

- `division.yaml` must carry version.
- Breaking workflow / role changes must provide migration notes.
- Tasks in progress continue to bind to the division version resolved at their start.

### 7.4 Domain Registry Integration

- Each division can bind at most one authoritative `domain`.
- `tool_bundle_ref`, `plugin_refs`, `knowledge_namespace` should be consistent with Domain Registry / Plugin Registry registration status.
- Divisions that do not declare `domain` can use general tool sets but must not impersonate domain-specialized divisions.
