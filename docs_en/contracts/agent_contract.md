# Agent Contract

## 1. Scope

This contract defines the identity, responsibility boundaries, input/output schemas, pre-checks, and permission constraints of Agents within the platform.

## 2. Key Objects

- `AgentDefinition`
- `AgentScope`
- `InputSchema`
- `OutputSchema`
- `PreconditionCheck`
- `DispatchMode`
- `AgentMiddlewareHook`

## 3. AgentDefinition Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Agent/role identifier |
| `name` | `string` | Display name |
| `model_tier` | `reasoning \| coding \| balanced \| fast` | Model tier |
| `tools` | `string[]` | Available tool list |
| `scope` | `AgentScope` | Responsibilities and boundaries |
| `input_schema` | `schema` | Input requirements |
| `output_schema` | `schema` | Output requirements |
| `preconditions` | `PreconditionCheck[]` | Pre-execution checks |
| `prompt_template` | `string` | System prompt template |
| `business_alias?` | `string` | Narrative alias, e.g., `VP Orchestration` |

Naming rules:

- Engineering implementations should prioritize stable canonical role / component ids.
- `business_alias` is only for product narratives, documentation, or UI display, and should not become the underlying scheduling primary key.

## 4. Scope Constraints

`scope` must contain at least:

- `responsibilities`
- `boundaries`

Rules:

- Responsibilities describe what can be done.
- Boundaries describe what clearly cannot be done.
- Roles must not have highly overlapping core responsibilities without resolution boundaries.

## 5. Preconditions

Each precondition must contain at least:

- `check`
- `description`
- `severity`

Semantics:

- The parent Agent performs checks before actual execution.
- On failure, proceed to remediation, fallback, or escalation, rather than letting the child Agent guess on its own.

Phase boundaries:

- Phase 1a preconditions are primarily deterministic checks, such as input completeness, permissions, budget, and dependency existence.
- Semantic or model-driven preconditions belong to subsequent enhancements and should not be assumed to be generally effective in Phase 1a by default.

## 6. Permission Rules

- Agents can only call authorized tools.
- High-risk tools must appear together with boundary descriptions.
- New role tool sets must not expand without constraints.
- Collaboration tools like `spawn_agent` and `send_message` should be subject to stricter role restrictions.

## 6.1 Dispatch Abstraction Boundaries

`DispatchMode` should distinguish at least three types:

- `workflow_delegation`: Parent workflow delegates steps to a role — this is business orchestration semantics.
- `sub_agent_spawn`: Pull up collaborative sub-agents within the same logical execution surface — this is collaborative execution strategy.
- `worker_dispatch`: Execution plane dispatches execution tickets to workers — this is infrastructure scheduling semantics.

Rules:

- The three must not be mixed and used as the same abstract word "dispatch".
- When business documents discuss role delegation, they should not default to equating it with worker scheduling.
- The queue / lease / worker semantics of the execution plane are handled by `execution_plane_contract.md`.

## 7. Failure Semantics

- Input does not satisfy schema: Must not execute directly.
- Precondition failure: Enters parent handling logic.
- Output missing fields: Allows limited fill-in retry.

## 7A. OAPEFLIR Executor Boundaries

The Agent executor within phase1-4 scope should consume or produce results according to OAPEFLIR stages, and must at minimum be aware of:

- `observe`
- `assess`
- `plan`
- `execute`
- `feedback`
- `learn`
- `improve`
- `release`

Rules:

- Agents may assist with content generation for Observe / Assess / Plan / Feedback / Learn but cannot directly bypass deterministic guardrails to write final controlled state.
- If Agent output is used for Improve / Release, it must go through the policy / guardrail / approval chain before taking effect.

## 7B. Middleware Hooks

`AgentMiddlewareHook` should currently at least allow:

- `observe_pre`
- `assess_post`
- `feedback_collect`
- `learn_extract`

Rules:

- Middleware hooks are runtime seams, not backdoors to bypass policies.
- If hook output enters the feedback / learning / improvement chain, it must have auditable provenance.

## 8. Supplementary Rules

### 8.1 Unified Role Schema

All roles must uniformly include at least:

- `role_id`
- `role_kind` (`hq | division`)
- `display_name`
- `objective`
- `prompt_ref`
- `tool_permissions`
- `model_profile`
- `output_contract_ref`
- `version`

Rules:

- HQ and division roles only differ in `role_kind` and permission scope, and should not evolve into two object models.
- Any new role must declare its output contract and tool boundaries.

### 8.2 Prompt Template Variables

Prompt template variables are minimally divided into:

- `system_vars`
- `task_vars`
- `division_vars`
- `runtime_vars`

Rules:

- Undeclared variables default to lint errors and are not allowed to be silently ignored.
- High-risk runtime constraints must not exist only in prompt variables; they must have system-level enforcement.

### 8.3 Role Versioning

- Role versions use monotonically increasing semantic versioning or integer versioning.
- Breaking prompt / output contract changes must bump the major version.
- Executions in progress continue to bind to the role version at their start and must not be contaminated by hot replacement.
