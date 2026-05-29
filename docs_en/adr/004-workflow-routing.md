# ADR-004 Workflow and Routing

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and dual-channel output
- **Feedback**: Signal collection, preprocessing, and 7 feedback sources (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Rollout state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Partially Superseded by v4.3 Routing + HarnessRuntime Baseline
- Decision Date: 2026-04-02

## Background

The platform needs to simultaneously support simple single tasks, standard workflows, multi-role collaboration, and cross-domain composite tasks. If all tasks go through the same heavy process, it will significantly slow things down and amplify costs, while also making simple scenarios bear unnecessary coordination overhead.

## Decision

Adopt five-plane-driven routing and multi-path execution:

- P1 Interface Plane is responsible for receiving messages, triage, and entry normalization.
- P2 Control Plane is responsible for policy matching, risk assessment, and routing decisions.
- P3 Orchestration Plane is responsible for cross-domain decomposition, dependency management, and `PlanGraphBundle` generation.
- `HarnessRuntime` serves as the unique execution runtime accepting P3→P4 handoff.
- Domain agent/worker only executes local responsibilities within `HarnessRuntime`-assigned `NodeRun` boundaries.

System defines four execution paths:

- `passthrough`: Shortest path, suitable for low-complexity tasks.
- `fast`: Emphasizes low latency and low cost.
- `standard`: Introduces testing, validation, or lightweight review.
- `full`: Full role collaboration and stronger quality assurance.

## Task Lifecycle

Typical path:

1. P1 receives message and filters non-task conversations.
2. P2 completes rule matching, risk assessment, and routing decision.
3. Single-domain tasks directly generate minimal `PlanGraphBundle`.
4. Cross-domain tasks are handed to P3 for decomposition, dependency graph management, and graph patch.
5. `HarnessRuntime` executes `NodeRun/NodeAttempt` and returns `NodeAttemptReceipt`.
6. P1/P2 consume projected results and return to original channel.

## Workflow Data Passing (§5.5 deprecates WorkflowState/StepOutput)

> Note: §5.5 has deprecated `WorkflowState` and `StepOutput`. Please use PlanGraphBundle/NodeAttemptReceipt instead.

Workflow data passing (v4.3 canonical):

- `PlanGraphBundle` saves node outputs and current execution index.
- Each node completion produces structured `NodeAttemptReceipt`.
- Downstream nodes read upstream results via output key.
- Large results enter artifact store, with only references saved in state.

Key requirements:

- Outputs must pass schema validation before writing.
- Limited retry allowed when key fields are missing.
- Partial success should be explicitly recorded, with precondition deciding whether to continue.

## Routing Principles

P2 Control Plane routing rules:

- Rules first, LLM fallback second.
- Simple tasks prioritize hitting `passthrough` or `fast`.
- Only enter P3 orchestration path when cross-domain dependencies are explicitly identified.

P3 Orchestration responsibilities:

- Decompose composite tasks.
- Establish dependency graph.
- Perform schema compatibility pre-check.
- After upstream node completion, inject results into downstream context via `PlanGraphBundle`/`GraphPatch`.

## Self-Healing and Escalation

After workflow failure, do not exit directly. Handle in this order:

- Limited retries.
- Loop detection to avoid repeatedly executing same failed action.
- When needed, fall back to upstream steps or mark partial success.
- After exceeding threshold, escalate to P2 Control Plane for human takeover or higher governance action.

HITL trigger scenarios include:

- Cost approaching or exceeding threshold.
- Security-sensitive operations.
- Task itself has ambiguity.
- Self-healing exceeded maximum attempts.
- Organizational changes or high-risk workflow suggestions.

## Relationship Between Contract and HR

Workflow should not evolve separately from the contract system:

- Each role should have explicit input/output schema.
- Preconditions are parent Agent's pre-validation of child Agent.
- HR Agent-generated new roles must adhere to same contracts.
- HR-provided workflow changes can only be suggestions, not auto-deployed.

## Results

Benefits:

- Simple tasks are not slowed by heavy orchestration.
- Complex tasks can get cross-domain collaboration capability.
- Workflow state can be persisted, naturally supporting recovery and audit.

Constraints:

- Requires unified task, step, and event models.
- Workflow DSL needs strict complexity control to avoid premature support for too many branching syntaxes.
- Routing, cost, and recovery logic need collaborative design, cannot be scattered everywhere.

## Cross-References

- [ADR-001 Three-Layer Separation Architecture](./001-three-layer-architecture.md)
- [ADR-002 Division System](./002-division-system.md)
- [ADR-008 Cost Model](./008-cost-model.md)

## Source Sections

- `§4.1`
- `§4.1.1`
- `§4.1.2`
- `§4.1.3`
- `§4.2`
- `§4.3`
- `§4.4`
- `§4.5`
- `§4.6`

## v4.3 ADR Remediation

- A-21: This ADR originally continued using the v3 agent hierarchy (`VP Operations/VP Orchestration/Division/Lead Agent/CEO`). Root cause was that the Workflow and Routing ADR long assumed organizational narrative without rewriting alongside v4.3 five-plane and `HarnessRuntime` becoming the runtime backbone. Fix: Body now changed to P1/P2/P3 and `HarnessRuntime`-driven routing and execution model.