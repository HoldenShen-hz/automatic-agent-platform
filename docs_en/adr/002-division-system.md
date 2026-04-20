# ADR-002 Division System

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-phase cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and dual-channel output
- **Feedback**: Signal collection, preprocessing, and 7 feedback source types (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and rollout state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-02

## Context

The goal of Automatic Agent is not just to support programming, but to host any business that can be broken down into workflows. Therefore, business capabilities must be extended in a declarative, pluggable, loosely-coupled manner, not hard-coded into the platform core.

## Decision

Model business capabilities as "divisions":

- Each division uses a declarative YAML configuration to describe itself.
- Configuration must include at least `id`, `name`, `description`, `triggers`, `roles`, `workflow`, `retry`.
- Roles are constrained by prompt, model tier, tool permissions, input/output contracts, and preconditions.
- Adding a new division should preferably be equivalent to adding a new configuration directory, not modifying core code.

Recommended directory structure:

- `divisions/<division>/division.yaml`
- `divisions/<division>/roles/*.prompt.md`
- Optional `AGENT.md`, rule files, and division-private resources

## Role Model

Role definitions must explicitly express:

- Responsibility boundaries: what to do, what not to do.
- Tool capabilities: minimum-privilege whitelist.
- Model tier: `reasoning`, `coding`, `balanced`, `fast`.
- Input/output contracts: ensuring stable data passing between steps.
- Concurrency constraints: such as `max_instances`.

Role reuse strategy:

- Role definitions can be reused across divisions.
- Same-named roles in different divisions can form different capabilities via tool and boundary constraints.

## Workflow Model

Internal division workflow defines:

- Step order.
- Which role each step uses.
- How input fields reference upstream outputs.
- Output keys produced by the current step.
- Which steps can fail and retry.

Constraints:

- Workflow should preferably remain linear or light DAG, avoiding premature evolution into complex orchestration language.
- Large outputs should fall into artifact store, not be unlimited inline in state tables.

## Dynamic Extension

HR Agent is responsible for dynamically supplementing roles within existing divisions:

- Analyze capability gaps.
- Generate role contracts and prompts.
- Verify consistency of tools, boundaries, and schemas.
- Output workflow modifications as suggestions, not automatic deployment.

Boundaries:

- HR Agent does not automatically create new divisions.
- New divisions are still explicitly added by humans via YAML.
- New role tool sets must be subsets of the target division's existing tool union, avoiding permission bloat.

## Cross-Division Tasks

Cross-division tasks do not directly bypass the division system; instead, VP Orchestration handles them:

- Split into multiple subtasks.
- Build dependency graph.
- Verify upstream outputs can satisfy downstream inputs.
- Aggregate each division's output into a unified result.

## Consequences

Advantages:

- Business extension speed is fast, aligning with "platform as company" design goal.
- New businesses naturally share security, communication, storage, and recovery capabilities.
- Multi-division collaboration can be uniformly handled by the VP Orchestration layer.

Constraints:

- Role tools must obey minimum privilege principle.
- Workflow modifications must pass contract and schema compatibility checks.
- More divisions mean higher requirements for documentation, templates, rules, and testing.

## Cross-References

- [ADR-001 Three-Layer Separation of Authority](./001-three-layer-architecture.md)
- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [Division Authoring](../guides/division-authoring.md)

## Source Sections

- `§2.3`
- `§2.4`
- `§4.5`
- `§4.6`
- `§10.1`
