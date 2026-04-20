# ADR-004 Workflow and Routing

- Status: Accepted
- Decision Date: 2026-04-02

## Context

The platform needs to simultaneously support simple single tasks, standard workflows, multi-role collaboration, and cross-division compound tasks. If all tasks go through the same heavy process, it will significantly slow down speed and increase costs, and also make simple scenarios bear unnecessary coordination overhead.

## Decision

Adopt layered routing and multi-path workflow:

- VP Operations is responsible for receiving messages, triage, classification, and division routing.
- VP Orchestration only intervenes when cross-division tasks appear, responsible for splitting, dependency management, and aggregation.
- Inside the division, Lead Agent executes local workflow autonomously.

System defines four execution paths:

- `passthrough`: Shortest path, suitable for low-complexity tasks.
- `fast`: Emphasizes low latency and low cost.
- `standard`: Introduces testing, validation, or lightweight review.
- `full`: Full role collaboration and stronger quality assurance.

## Task Lifecycle

Typical path is as follows:

1. VP Operations receives message and filters non-task conversations.
2. VP Operations performs rule matching, falls back to fast model for classification when necessary.
3. Single-division tasks route directly to corresponding division.
4. Cross-division tasks handed to VP Orchestration for splitting and dependency graph management.
5. Each division's Lead Agent autonomously executes and returns results.
6. VP Orchestration aggregates results, returns to original channel.

## Workflow Data Transfer

`input: "{user_stories}"` in workflow is not string replacement but runtime binding:

- `WorkflowState` saves step outputs and current index.
- Each step produces structured `StepOutput` after completion.
- Downstream steps read upstream results through output key.
- Large volume results enter artifact store, only references saved in state.

Key requirements:

- Outputs must pass schema validation before writing.
- Limited retry allowed when key fields are missing.
- Partial success should be explicitly recorded, letting precondition decide whether to continue.

## Routing Principles

VP Operations routing rules:

- Rules first, LLM fallback second.
- Simple tasks prioritize `passthrough` or `fast`.
- Only enter VP Orchestration path when explicit cross-division dependencies exist.

VP Orchestration responsibilities:

- Split compound tasks.
- Establish dependency graph.
- Perform schema compatibility pre-check.
- Inject results into downstream context after upstream division completes.

## Self-Healing and Escalation

After workflow failure, do not exit directly but handle in the following order:

- Limited retries.
- Loop detection, avoid repeatedly executing the same failed action.
- Fallback to upstream step or mark partial success when needed.
- After exceeding threshold, escalate to VP Orchestration or CEO.

HITL trigger scenarios include:

- Cost approaching or exceeding threshold.
- Security-sensitive operations.
- Ambiguity in the task itself.
- Self-healing exceeds maximum attempts.
- Organizational changes or high-risk workflow suggestions.

## Relationship Between Contracts and HR

Workflow should not evolve separately from the contract system:

- Each role should have clear input/output schema.
- Preconditions are parent Agent's pre-check on child Agent.
- HR Agent-generated new roles must comply with same contracts.
- HR's workflow changes can only be suggestions, cannot be automatically deployed.

## Results

Benefits:

- Simple tasks not slowed down by heavy orchestration.
- Complex tasks can obtain cross-division collaboration capability.
- Workflow state can be persisted, naturally supporting recovery and audit.

Constraints:

- Unified task, step, and event model needed.
- Workflow DSL needs strict complexity control, avoid prematurely supporting too many branching syntaxes.
- Routing, cost, and recovery logic need coordinated design, cannot be scattered everywhere.

## Cross-References

- [ADR-001 Three-Layer Distributed Architecture](./001-three-layer-architecture.md)
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
