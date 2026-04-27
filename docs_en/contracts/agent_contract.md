# Agent Contract

> **OAPEFLIR Related**: This contract defines the Agent boundary for OAPEFLIR phase 8, corresponding to ADR-016, ADR-080, and ADR-075.
> **Updated**: 2026-04-17

## 1. Scope

This contract defines the identity, responsibility boundaries, input/output schemas, preconditions, and permission constraints for Agents within the platform.

Related Documents:
- [ADR-016 OAPEFLIR Eight-Phase Model](../adr/016-oapeflir-loop-model.md)
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
| `tools` | `string[]` | Available tool list |
| `scope` | `AgentScope` | Responsibility and boundary |
| `input_schema` | `schema` | Input requirements |
| `output_schema` | `schema` | Output requirements |
| `preconditions` | `PreconditionCheck[]` | Pre-execution checks |
| `prompt_template` | `string` | System prompt template |
| `business_alias?` | `string` | Narrative alias, e.g., `VP Orchestration` |

Naming Rules:

- Engineering implementations should prioritize stable canonical role / component IDs.
- `business_alias` is only used for product narratives, documentation, or UI display, and should not become the underlying scheduling primary key.

## 4. Scope Constraints

`scope` must contain at least:

- `responsibilities`
- `boundaries`

Rules:

- responsibilities describe what can be done.
- boundaries describe what explicitly cannot be done.
- Roles must not have highly overlapping core responsibilities without clear resolution boundaries.

## 5. Preconditions

Each precondition must contain at least:

- `check`
- `description`
- `severity`

Semantics:

- Parent Agent performs checks before actual execution.
- On failure, enter remediation, rollback, or escalation, rather than letting the sub-agent guess.

Phase Boundary:

- Phase 1a preconditions focus on deterministic checks, such as input completeness, permissions, budget, and dependency existence.
- Semantic or model-driven preconditions belong to subsequent enhancements and should not be assumed to be universally effective in Phase 1a by default.

## 6. Permission Rules

- Agents can only call authorized tools.
- High-risk tools must appear together with boundary descriptions.
- New role tool sets must not expand without constraints.
- Collaboration tools like `spawn_agent`, `send_message` should be subject to stricter role restrictions.

## 6.1 Dispatch Abstraction Boundary

`DispatchMode` must distinguish at least three types:

- `workflow_delegation`: Parent workflow delegates steps to a role—this is business orchestration semantics.
- `sub_agent_spawn`: Spawns a collaborative sub-agent within the same logical execution plane—this is collaborative execution strategy.
- `worker_dispatch`: Execution plane dispatches execution tickets to workers—this is infrastructure scheduling semantics.

Rules:

- These three must not be mixed into the same abstract word "dispatch".
- When business documents discuss role delegation, they should not be assumed to be equivalent to worker scheduling.
- The queue / lease / worker semantics of the execution plane are handled by `execution_plane_contract.md`.

## 7. Failure Semantics

- Input does not satisfy schema: Must not execute directly.
- Precondition failure: Enters parent handling logic.
- Missing output fields: Allows limited completion retry.

## 7A. OAPEFLIR Executor Boundary

Agent executor should consume or produce results according to OAPEFLIR phases within the phase1-4 range (corresponding to ADR-016):

| OAPEFLIR Phase | Agent Role | Constraint |
|--------------|-----------|------|
| Observe | Collect signals | Must not make evaluation decisions |
| Assess | Assess risk/complexity | Must not bypass Plan to execute |
| Plan | Generate execution plan | Must comply with R3-SINGLE constraint |
| Execute | Execute plan | Must not bypass Plan DTO (R3-NOBYPASS) |
| Feedback | Collect signals | Must not directly influence execution |
| Learn | Extract patterns | Must not directly write controlled state |
| Improve | Evaluate candidates | Must pass through guardrail + approval |
| Release | Controlled release | Must comply with autonomy boundary |

**Rules**:

- Agents can assist in content generation for Observe / Assess / Plan / Feedback / Learn, but cannot directly bypass deterministic guardrails to write final controlled state.
- If Agent output is used for Improve / Release, it must go through policy / guardrail / approval chain before taking effect (R4-EVIDENCE constraint).

## 7B. Middleware Hooks

`AgentMiddlewareHook` should currently allow at least:

- `observe_pre`
- `assess_post`
- `feedback_collect`
- `learn_extract`

Rules:

- Middleware hook is a runtime seam, not a backdoor to bypass policies.
- Hook output that enters the feedback / learning / improvement chain must have auditable provenance.

## 8. Supplementary Rules

### 8.1 Unified Role Schema

All roles must uniformly include:

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

- HQ and division roles only differ in `role_kind` and permission scope, and should not evolve into two sets of object models.
- Any new role must declare output contract and tool boundaries.

### 8.2 Prompt Template Variables

Prompt template variables are minimally divided into:

- `system_vars`
- `task_vars`
- `division_vars`
- `runtime_vars`

Rules:

- Undeclared variables default to lint errors and must not be silently ignored.
- High-risk runtime constraints must not exist only in prompt variables; there must be system-level hard constraints.

### 8.3 Role Versioning

- Role versions use monotonically increasing semantic versioning or integer versioning.
- Breaking prompt / output contract changes must bump the major version.
- Running executions continue to bind to the role version at startup and must not be contaminated by hot replacement.
