# Agent Contract

> **OAPEFLIR Related**: This contract defines the Agent boundaries for OAPEFLIR 8 stages, corresponding to ADR-016, ADR-080, and ADR-075.
> **Updated**: 2026-04-17

## 1. Scope

This contract defines the identity, responsibility boundaries, input/output schemas, precondition checks, and permission constraints of Agents within the platform.

Related Documents:
- [ADR-016 OAPEFLIR 8-Stage Model](../adr/016-oapeflir-loop-model.md)
- [ADR-075 Six-Level Controlled Release](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)

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
| `tools` | `string[]` | Available tools list |
| `scope` | `AgentScope` | Responsibilities and boundaries |
| `input_schema` | `schema` | Input requirements |
| `output_schema` | `schema` | Output requirements |
| `preconditions` | `PreconditionCheck[]` | Pre-execution checks |
| `prompt_template` | `string` | System prompt template |
| `business_alias?` | `string` | Narrative alias, e.g., `VP Orchestration` |

Naming Rules:

- Engineering implementation should prioritize stable canonical role / component id.
- `business_alias` is only used for product narrative, documentation, or UI display, and should not become the underlying scheduling primary key.

## 4. Scope Constraints

`scope` must contain at least:

- `responsibilities`
- `boundaries`

Rules:

- responsibilities describe what can be done.
- boundaries describe what clearly cannot be done.
- Roles must not have high overlap in core responsibilities without clear arbitration boundaries.

## 5. Preconditions

Each precondition must contain at least:

- `check`
- `description`
- `severity`

Semantics:

- Parent Agent performs checks before actual execution.
- On failure, enter remediation, rollback, or escalation, rather than letting the child Agent guess on its own.

Phase Boundaries:

- Phase 1a preconditions are primarily deterministic checks, such as input completeness, permissions, budget, and dependency existence.
- Semantic or model-driven preconditions belong to subsequent enhancements and should not be assumed to be universally effective in Phase 1a.

## 6. Permission Rules

- Agents can only call authorized tools.
- High-risk tools must appear together with boundary descriptions.
- New role tool sets must not expand without constraints.
- Collaboration tools like `spawn_agent`, `send_message` should be subject to stricter role restrictions.

## 6.1 Dispatch Abstraction Boundaries

`DispatchMode` must distinguish at least three types:

- `workflow_delegation`: Parent workflow delegates steps to a role; this is business orchestration semantics.
- `sub_agent_spawn`: Pull up collaborating child Agents within the same logical execution surface; this is collaborative execution strategy.
- `worker_dispatch`: Execution plane dispatches execution tickets to workers; this is infrastructure scheduling semantics.

Rules:

- These three cannot be mixed and used as the same abstract word "dispatch".
- When business documents talk about role delegation, they should not default to equating it with worker scheduling.
- Execution plane queue / lease / worker semantics are the responsibility of `execution_plane_contract.md`.

## 7. Failure Semantics

- Input does not satisfy schema: must not execute directly.
- Precondition fails: enters parent handling logic.
- Output missing fields: allows limited fill-and-retry.

## 7A. OAPEFLIR Executor Boundaries

Agent executor within phase1-4 scope should consume or produce results according to OAPEFLIR stages (corresponding to ADR-016):

| OAPEFLIR Stage | Agent Role | Constraints |
|--------------|-----------|------|
| Observe | Collect signals | Must not make assessment decisions |
| Assess | Assess risk/complexity | Must not bypass Plan to execute directly |
| Plan | Generate execution plan | Must comply with R3-SINGLE constraint |
| Execute | Execute plan | Must not bypass Plan DTO (R3-NOBYPASS) |
| Feedback | Collect signals | Must not directly affect execution |
| Learn | Extract patterns | Must not directly write controlled state |
| Improve | Evaluate candidates | Must pass through guardrail + approval |
| Release | Controlled release | Must comply with autonomy boundary |

**Rules**:

- Agents can assist content generation for Observe / Assess / Plan / Feedback / Learn, but cannot directly bypass deterministic guardrails to write final controlled state.
- If Agent output is used for Improve / Release, it must go through policy / guardrail / approval chain before taking effect (R4-EVIDENCE constraint).

## 7B. Middleware Hooks

`AgentMiddlewareHook` currently at least allows:

- `observe_pre`
- `assess_post`
- `feedback_collect`
- `learn_extract`

Rules:

- Middleware hooks are runtime seams, not backdoors to bypass policies.
- If hook output enters feedback / learning / improvement chain, it must have auditable provenance.

## 8. Supplementary Rules

### 8.1 Unified Role Schema

All roles must uniformly contain at least:

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

- HQ and division roles only differ in `role_kind` and permission scope; they should not evolve into two object models.
- Any new role must declare output contract and tool boundaries.

### 8.2 Prompt Template Variables

Prompt template variables are minimally divided into:

- `system_vars`
- `task_vars`
- `division_vars`
- `runtime_vars`

Rules:

- Undeclared variables default to lint error; silent ignore is not allowed.
- High-risk runtime constraints must not only exist in prompt variables; they must have system-level enforced constraints.

### 8.3 Role Versioning

- Role versions use monotonically increasing semantic versioning or integer versioning.
- Breaking prompt / output contract changes must upgrade the major version.
- Running executions continue binding to the role version at their start time and must not be polluted by hot replacement.