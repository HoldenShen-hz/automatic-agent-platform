# Agent Contract

> **OAPEFLIR Related**: This contract defines Agent boundary for OAPEFLIR 8 stages, corresponding to ADR-016, ADR-080, and ADR-075.
> **Update Date**: 2026-04-17

## 1. Scope

This contract defines the identity, responsibility boundary, input/output schema, precondition checks, and permission constraints of Agents within the platform.

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
| `scope` | `AgentScope` | Responsibility and boundary |
| `domain_binding` | `DomainBinding` | Domain binding and domain constraints |
| `input_schema` | `schema` | Input requirements |
| `output_schema` | `schema` | Output requirements |
| `preconditions` | `PreconditionCheck[]` | Pre-execution checks |
| `prompt_template` | `string` | System prompt template |
| `business_alias?` | `string` | Narrative alias, e.g., `VP orchestration` |

Naming rules:

- Engineering implementation should prioritize using stable canonical role / component id.
- `business_alias` is only for product narrative, documentation, or UI display; it should not become the underlying scheduling primary key.

## 4. Scope Constraints

`scope` at least contains:

- `responsibilities`
- `boundaries`

`DomainBinding` at least contains:

- `domain_id`
- `domain_descriptor_ref`
- `risk_profile_ref?`
- `tool_bundle_ids?`
- `knowledge_namespaces?`

Rules:

- Responsibilities describe what can be done.
- Boundaries describe what explicitly cannot be done.
- There should be no high-overlap core responsibilities between roles without arbitration boundaries.
- `domain_id` must point to a registered `DomainDescriptor`; Agent's tools, knowledge, and governance boundaries should be derived from domain binding, not inferred from organizational narrative units.

## 5. Preconditions

Each precondition at least contains:

- `check`
- `description`
- `severity`

Semantics:

- Parent Agent performs checks before actual execution.
- On failure, enters remediation, rollback, or escalation; do not let child Agent guess on its own.

Phase boundary:

- Phase 1a preconditions are primarily deterministic checks, such as input integrity, permissions, budget, and dependency existence.
- Semantic or model-driven preconditions belong to subsequent enhancements; they should not be assumed to be generally effective in Phase 1a by default.

## 6. Permission Rules

- Agent can only call authorized tools.
- High-risk tools must appear together with boundary description.
- New role tool sets must not expand without constraints.
- Collaboration tools like `spawn_agent`, `send_message` should be subject to stricter role restrictions.

## 6.1 Dispatch Abstraction Boundary

`DispatchMode` at least distinguishes three types:

- `workflow_delegation`: Parent workflow delegates steps to a role; this is business orchestration semantics.
- `sub_agent_spawn`: Pull up collaborative sub-Agent within the same logical execution surface; this is collaborative execution strategy.
- `worker_dispatch`: Execution plane dispatches execution tickets to workers via `PlanGraphDispatch (PlanGraphBundle)`; this is infrastructure scheduling semantics.

Rules:

- The three cannot be mixed as the same abstract word "dispatch".
- When business documentation talks about role delegation, it should not be equated with worker scheduling by default.
- Queue / lease / worker semantics of execution plane are governed by `execution_plane_contract.md`, and canonical handoff must be `PlanGraphDispatch (PlanGraphBundle)`.

## 7. Failure Semantics

- Input does not satisfy schema: Do not execute directly.
- Precondition failure: Enter parent handling logic.
- Output missing fields: Allow limited completion retry.

## 7A. OAPEFLIR Executor Boundary

Agent executor within phase1-4 scope should consume or produce results according to OAPEFLIR stages (corresponding to ADR-016):

| OAPEFLIR Stage | Agent Role | Constraint |
| --- | --- | --- |
| Observe | Collect signals | Cannot make assessment decisions |
| Assess | Assess risk/complexity | Cannot bypass Plan to execute directly |
| Plan | Generate execution plan | Must comply with R3-SINGLE constraint |
| Execute | Execute plan | Cannot bypass `PlanGraphBundle` (R3-NOBYPASS) |
| Feedback | Collect signals | Cannot directly affect execution |
| Learn | Extract patterns | Cannot directly write controlled state |
| Improve | Evaluate candidates | Must go through guardrail + approval |
| Release | Controlled release | Must obey autonomy boundary |

**Rules**:

- Agent can assist with content generation for Observe / Assess / Plan / Feedback / Learn, but cannot directly bypass deterministic guardrail to write final controlled state.
- If Agent output is used for Improve / Release, it must take effect only after going through policy / guardrail / approval chain (R4-EVIDENCE constraint).

## 7B. Middleware Hooks

`AgentMiddlewareHook` currently at least should allow:

- `observe_pre`
- `assess_post`
- `feedback_collect`
- `learn_extract`

Rules:

- Middleware hook is a runtime seam, not a backdoor bypassing policy.
- Hook output entering feedback / learning / improvement chain must have auditable provenance.

## 8. Supplementary Rules

### 8.1 Unified Role Schema

All roles at least uniformly contain:

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

- Platform roles and domain roles differ only in `role_kind`, `domain_binding`, and permission scope; they should not evolve into two sets of object models.
- Any new role must declare output contract and tool boundaries.

### 8.2 Prompt Template Variables

Prompt template variables at least divided into:

- `system_vars`
- `task_vars`
- `domain_vars`
- `runtime_vars`

Rules:

- Undeclared variables default to lint error; silent ignore is not allowed.
- High-risk runtime constraints must not only exist in prompt variables; they must have system-level enforcement.

### 8.3 Role Versioning

- Role versioning uses monotonically increasing semantic version or integer version.
- Breaking prompt / output contract changes must bump major version.
- Running executions continue to bind to the role version at startup; hot replacement is not allowed to contaminate them.

## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical paragraphs conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-27: This document previously used `division` narrative as the primary organizational boundary for Agent, and wrote `worker_dispatch` as generalized dispatch without `PlanGraphDispatch`. Root cause: role contract inherited v3 organizational orchestration model and did not sync rewrite with domain-centric model and graph dispatch handoff in v4.3. Fix: The text now converges Agent binding to `domain_id / DomainDescriptor`, and explicitly binds `worker_dispatch` to `PlanGraphDispatch (PlanGraphBundle)`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.