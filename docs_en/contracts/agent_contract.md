# Agent Contract

> **OAPEFLIR Relationship**: This contract defines the Agent boundaries for OAPEFLIR 8 stages, corresponding to ADR-016, ADR-080, and ADR-075.
> **Update Date**: 2026-04-17

## 1. Scope

This contract defines the identity, responsibility boundaries, input/output schemas, precondition checks, and permission constraints for Agents within the platform.

Related documents:
- [ADR-016 OAPEFLIR Eight-Stage Model](../adr/016-oapeflir-loop-model.md)
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

- Engineering implementations should prioritize stable canonical role / component id.
- `business_alias` is only used for product narrative, documentation, or UI display, and should not become the underlying scheduling primary key.

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

- `responsibilities` describe what can be done.
- `boundaries` describe what explicitly cannot be done.
- Roles must not have highly overlapping core responsibilities without decisive boundaries.
- `domain_id` must point to a registered `DomainDescriptor`; Agent tools, knowledge, and governance boundaries should be derived from domain binding, rather than reverse-engineered from organizational narrative units.

## 5. Preconditions

Each precondition must include at least:

- `check`
- `description`
- `severity`

Semantics:

- Parent-level Agent performs checks before actual execution.
- On failure, enter remediation, fallback, or escalation, rather than letting the child Agent guess on its own.

Phase boundaries:

- Phase 1a preconditions are primarily deterministic checks, such as input completeness, permissions, budget, and dependency existence.
- Semantic or model-driven preconditions belong to subsequent enhancements and should not be assumed to be universally effective in Phase 1a by default.

## 6. Permission Rules

- Agents can only call authorized tools.
- High-risk tools must appear together with boundary descriptions.
- New role tool sets must not expand without constraints.
- Collaboration tools such as `spawn_agent` and `send_message` should be subject to stricter role restrictions.

## 6.1 Dispatch Abstraction Boundary

`DispatchMode` must distinguish at least three types:

- `workflow_delegation`: Parent workflow delegates steps to a role; this is business orchestration semantics.
- `sub_agent_spawn`: Pull up a collaborative child Agent within the same logical execution surface; this is collaborative execution strategy.
- `worker_dispatch`: Execution plane dispatches execution tickets to workers via `PlanGraphDispatch (PlanGraphBundle)`; this is infrastructure scheduling semantics.

Rules:

- The three cannot be used interchangeably as the same abstract word "dispatch".
- When business documents talk about role delegation, they should not default to being equivalent to worker scheduling.
- Execution plane queue / lease / worker semantics are governed by `execution_plane_contract.md`, and the canonical handoff must be `PlanGraphDispatch (PlanGraphBundle)`.

## 7. Failure Semantics

- Input does not satisfy schema: Must not execute directly.
- Precondition failure: Enter parent-level handling logic.
- Output missing fields: Allow limited completion retry.

## 7A. OAPEFLIR Executor Boundaries

Agent executors within phase 1-4 scope should consume or produce results according to OAPEFLIR stages (corresponding to ADR-016):

| OAPEFLIR Stage | Agent Role | Constraint |
|--------------|-----------|------|
| Observe | Collect signals | Must not make assessment decisions |
| Assess | Assess risk/complexity | Must not bypass Plan to execute directly |
| Plan | Generate execution plan | Must comply with R3-SINGLE constraint |
| Execute | Execute plan | Must not bypass `PlanGraphBundle` (R3-NOBYPASS) |
| Feedback | Collect signals | Must not directly affect execution |
| Learn | Extract patterns | Must not directly write controlled state |
| Improve | Evaluate candidates | Must pass through guardrail + approval |
| Release | Controlled release | Must obey autonomy boundary |

**Rules**:

- Agents can assist with content generation for Observe / Assess / Plan / Feedback / Learn, but cannot directly bypass deterministic guardrails to write final controlled state.
- If Agent output is used for Improve / Release, it must take effect after passing through policy / guardrail / approval chain (R4-EVIDENCE constraint).

## 7B. Middleware Hooks

`AgentMiddlewareHook` must currently at least allow:

- `observe_pre`
- `assess_post`
- `feedback_collect`
- `learn_extract`

Rules:

- Middleware hooks are runtime seams, not backdoors to bypass policy.
- Hook output that enters feedback / learning / improvement chain must have auditable provenance.

## 8. Supplementary Rules

### 8.1 Unified Role Schema

All roles must uniformly include at least:

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

- Platform roles and domain roles only differ in `role_kind`, `domain_binding`, and permission scope; they should not evolve into two sets of object models.
- Any new role must declare output contract and tool boundaries.

### 8.2 Prompt Template Variables

Prompt template variables are minimally divided into:

- `system_vars`
- `task_vars`
- `domain_vars`
- `runtime_vars`

Rules:

- Undeclared variables default to lint error; silent ignoring is not allowed.
- High-risk runtime constraints must not only exist in prompt variables; they must have system-level strong constraints.

### 8.3 Role Versioning

- Role versioning uses monotonically increasing semantic versioning or integer versioning.
- Breaking prompt / output contract changes must upgrade the major version.
- Running executions continue to bind to the role version at startup and must not be contaminated by hot replacement.

## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If the historical paragraphs of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 to ADR-113, and `src/platform/contracts/executable-contracts/` prevail.

- T-27: This document originally used `division` narrative as the primary organizational boundary for Agents, and wrote `worker_dispatch` as generalized dispatch without `PlanGraphDispatch`. Root cause: The role contract inherited the v3 organizational orchestration model and was not rewritten with v4.3's domain-centered model and graph dispatch handoff. Fix: The main text now converges Agent binding to `domain_id / DomainDescriptor`, and explicitly binds `worker_dispatch` to `PlanGraphDispatch (PlanGraphBundle)`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.