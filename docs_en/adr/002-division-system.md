# ADR-002 Division System

- Status: Accepted
- Decision Date: 2026-04-02

## Context

The goal of Automatic Agent is not just to support programming, but to承载任意可被拆解为工作流的业务。因此业务能力必须以声明式、可插拔、低耦合的方式扩展，而不是写死在平台核心里。

## Decision

Model business capabilities as "divisions":

- Each division uses a declarative YAML configuration to describe.
- Configuration must contain at least `id`, `name`, `description`, `triggers`, `roles`, `workflow`, `retry`.
- Roles are constrained through Prompt, model tier, tool permissions, input/output contracts, and preconditions.
- Adding a new division should be roughly equivalent to adding a configuration directory rather than modifying core code.

Recommended directory structure:

- `divisions/<division>/division.yaml`
- `divisions/<division>/roles/*.prompt.md`
- Optional `AGENT.md`, rule files, and division-private resources

## Role Model

Role definitions need to explicitly express:

- Responsibility boundaries: What to do, what not to do.
- Tool capabilities: Least privilege whitelist.
- Model tier: `reasoning`, `coding`, `balanced`, `fast`.
- Input/output contracts: Ensure stable data transfer between steps.
- Concurrency constraints: Such as `max_instances`.

Role reuse strategy:

- Role definitions can be reused across divisions.
- Roles with the same name in different divisions can form different capabilities through tool and boundary restrictions.

## Workflow Model

Internal division workflow is responsible for defining:

- Step order.
- Which role each step uses.
- How input fields reference upstream outputs.
- Output keys produced by the current step.
- Which steps can fail and retry.

Constraints:

- Workflow should prioritize linear or lightweight DAG, avoid prematurely becoming a complex orchestration language.
- Large outputs should fall into artifact store, not be unlimited inline in state table.

## Dynamic Extension

HR Agent is responsible for dynamically supplementing roles within existing divisions:

- Analyze capability gaps.
- Generate role contracts and prompts.
- Verify consistency of tools, boundaries, and schemas.
- Output workflow modifications as suggestions rather than automatic deployment.

Boundaries:

- HR Agent does not automatically create new divisions.
- New divisions are still explicitly added by humans through YAML.
- New role tool sets must be a subset of the target division's existing tool union to avoid permission bloat.

## Cross-Division Tasks

Cross-division tasks are not directly bypassing the division system, but orchestrated by VP:

- Split into multiple subtasks.
- Establish dependency graph.
- Confirm upstream outputs can satisfy downstream inputs.
- Aggregate each division's output into unified result.

## Results

Benefits:

- Fast business extension speed, aligned with "platform as company" design goal.
- New businesses naturally share security, communication, storage, and recovery capabilities.
- Multi-division collaboration can be uniformly handled by VP orchestration layer.

Constraints:

- Role tools must follow least privilege principle.
- Workflow modifications must pass contract and schema compatibility checks.
- More divisions mean higher requirements for documentation, templates, rules, and testing.

## Cross-References

- [ADR-001 Three-Layer Distributed Architecture](./001-three-layer-architecture.md)
- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [Division Authoring](../guides/division-authoring.md)

## Source Sections

- `§2.3`
- `§2.4`
- `§4.5`
- `§4.6`
- `§10.1`
