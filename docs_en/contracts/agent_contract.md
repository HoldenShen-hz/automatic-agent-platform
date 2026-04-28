# Agent Contract

> **OAPEFLIR Relationship**: This contract defines Agent boundaries across the OAPEFLIR 8-stage loop, corresponding to ADR-016, ADR-080, and ADR-075.
> **Updated**: 2026-04-17

## 1. Scope

This contract defines the identity, responsibility boundaries, input/output schemas, preconditions, and permission constraints for Agents within the platform.

Related Documents:
- [ADR-016 OAPEFLIR Eight-Stage Model](../adr/016-oapeflir-loop-model.md)
- [ADR-075 Six-Level Controlled Rollout](../adr/075-controlled-rollout-release.md)
- [ADR-080 Learn Hub](../adr/080-learn-hub-pattern-detection.md)

## 2. Key Objects

- `AgentDefinition`
- `AgentScope`
- `InputSchema`
- `OutputSchema`
- `PreconditionCheck`
- `DispatchMode`
- `AgentMiddlewareHook`
- `DomainBinding`

## 3. AgentDefinition Minimum Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Agent/role identifier |
| `name` | `string` | Display name |
| `model_tier` | `reasoning \| coding \| balanced \| fast` | Model tier |
| `tools` | `string[]` | Available tools list |
| `scope` | `AgentScope` | Responsibilities and boundaries |
| `domain_binding` | `DomainBinding` | Domain binding and domain constraints |
| `input_schema` | `schema` | Input requirements |
| `output_schema` | `schema` | Output requirements |
| `preconditions` | `PreconditionCheck[]` | Pre-execution checks |
| `prompt_template` | `string` | System prompt template |
| `business_alias?` | `string` | Narrative alias, e.g., `VP Orchestration` |

Naming rules:

- Engineering implementations should prioritize stable canonical role / component IDs.
- `business_alias` is only for product narratives, documentation, or UI display, and should not become the underlying scheduling primary key.

## 4. Scope Constraints

`scope` must include at least:

- `responsibilities`
- `boundaries`

`DomainBinding` must include at least:

- `domain_id`
- `domain_descriptor_ref`
- `risk_profile_ref?`
- `tool_bundle_ids?`
- `knowledge_namespaces?`

Rules:

- Responsibilities describe what the agent can do.
- Boundaries describe what the agent explicitly cannot do.
- There must be no high-overlap core responsibilities between roles without arbitration boundaries.
- `domain_id` must point to a registered `DomainDescriptor`; an Agent's tools, knowledge, and governance boundaries should be derived from domain binding, not inferred from organizational narrative units.

## 5. Preconditions

Each precondition must include at least:

- `check`
- `description`
- `severity`

Semantics:

- The parent Agent performs checks before actual execution.
- On failure, proceed to remediation, rollback, or escalation, rather than letting the child Agent guess on its own.

Phase boundaries:

- Phase 1a preconditions are primarily deterministic checks, such as input completeness, permissions, budget, and dependency existence.
- Semantic or model-driven preconditions belong to subsequent enhancements and should not be assumed to be universally effective in Phase 1a by default.

## 6. Permission Rules

- Agents can only call authorized tools.
- High-risk tools must appear with boundary descriptions.
- New role tool sets must not expand without constraints.
- Collaboration tools like `spawn_agent`, `send_message` should be subject to stricter role restrictions.

## 6.1 Dispatch Abstraction Boundaries

`DispatchMode` must distinguish three types:

- `workflow_delegation`: The parent workflow delegates steps to a role—this is business orchestration semantics.
- `sub_agent_spawn`: Pulling up collaborative sub-agents within the same logical execution plane—this is collaborative execution strategy.
- `worker_dispatch`: The execution plane dispatches execution tickets to workers via `PlanGraphDispatch (PlanGraphBundle)`—this is infrastructure scheduling semantics.

Rules:

- These three cannot be conflated as the same abstract word "dispatch".
- When business documents talk about role delegation, they should not be assumed equivalent to worker scheduling.
- The execution plane's queue / lease / worker semantics are handled by `execution_plane_contract.md`, and the canonical handoff must be `PlanGraphDispatch (PlanGraphBundle)`.

## 7. Failure Semantics

- Input does not satisfy schema: Do not execute directly.
- Precondition failure: Enter parent handling logic.
- Output missing fields: Allow limited retry with completion.

## 7A. OAPEFLIR Executor Boundaries

The Agent executor should consume or produce results according to OAPEFLIR stages within phases 1-4 (corresponding to ADR-016):

| OAPEFLIR Stage | Agent Role | Constraint |
| --- | --- | --- |
| Observe | Collect signals | Must not make assessment decisions |
| Assess | Assess risk/complexity | Must not bypass Plan for direct execution |
| Plan | Generate execution plan | Must comply with R3-SINGLE constraint |
| Execute | Execute plan | Must not bypass `PlanGraphBundle` (R3-NOBYPASS) |
| Feedback | Collect signals | Must not directly affect execution |
| Learn | Extract patterns | Must not directly write controlled state |
| Improve | Evaluate candidates | Must pass through guardrail + approval |
| Release | Controlled release | Must observe autonomy boundary |

**Rules**:

- Agents can assist with content generation for Observe / Assess / Plan / Feedback / Learn, but cannot directly bypass deterministic guardrails to write final controlled state.
- If Agent output is used for Improve / Release, it must go through the policy / guardrail / approval chain before taking effect (R4-EVIDENCE constraint).

## 7B. Middleware Hooks

`AgentMiddlewareHook` currently at minimum should allow:

- `observe_pre`
- `assess_post`
- `feedback_collect`
- `learn_extract`

Rules:

- Middleware hooks are runtime seams, not backdoors to bypass policies.
- If hook output enters the feedback / learning / improvement chain, it must have auditable provenance.

## 8. Supplementary Rules

### 8.1 Unified Role Schema

All roles must uniformly include at minimum:

- `role_id`
- `role_kind` (`platform | domain`)
- `display_name`
- `objective`
- `prompt_ref`
- `tool_permissions`
- `model_profile`
- `output_contract_ref`
- `version`

Rules:

- Platform roles and domain roles differ only in `role_kind`, `domain_binding`, and permission scope, and should not evolve into two different object models.
- Any new role must declare its output contract and tool boundaries.

### 8.2 Prompt Template Variables

Prompt template variables must be divided into at minimum:

- `system_vars`
- `task_vars`
- `domain_vars`
- `runtime_vars`

Rules:

- Undeclared variables are treated as lint errors by default and must not be silently ignored.
- High-risk runtime constraints must not exist only in prompt variables; they must have system-level enforcement.

### 8.3 Role Versioning

- Role versions use monotonically increasing semantic versioning or integer versioning.
- Breaking prompt / output contract changes must increment the major version.
- Running executions continue to be bound to the role version at their startup time and must not be polluted by hot replacement.


## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical sections conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-27: This document originally continued to use the `division` narrative as the primary organizational boundary for Agents, and wrote `worker_dispatch` as generalized dispatch semantics without `PlanGraphDispatch`. Root cause: The role contract inherited the v3 organizational orchestration model and did not synchronize with the domain-centric model and graph dispatch handoff in v4.3. Fix: The body now converges Agent binding to `domain_id / DomainDescriptor`, and explicitly binds `worker_dispatch` to `PlanGraphDispatch (PlanGraphBundle)`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
