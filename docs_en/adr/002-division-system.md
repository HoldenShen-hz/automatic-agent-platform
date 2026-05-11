# ADR-002 Division System

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post-execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and Dual-Channel output
- **Feedback**: Signal collection, preprocessing, and 7 feedback source types (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Rollout state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-02

## Context

The goal of Automatic Agent is not merely to support programming, but to host any business that can be decomposed into workflows. Therefore, business capabilities must be extended in a declarative, pluggable, and loosely coupled manner, rather than being hardcoded into the platform core.

## Decision (v4.3 DomainDescriptor+BusinessPack Replaces Old Division YAML)

Model business capabilities as "Domain" (v4.3 canonical, replacing the old Division YAML model):

- Each domain uses DomainDescriptor for declarative description.
- Configuration must at least include `domain_id`, `name`, `description`, `BusinessPack`, `DomainRiskSpec`, `roles`, `workflow`, and `retry`.
- DomainRiskSpec defines the risk level, approval requirements, and timeout configuration for this domain.
- BusinessPack encapsulates the prompt templates, tool sets, and input/output contracts for this domain.
- Roles are constrained through prompts, model tiers, tool permissions, input/output contracts, and preconditions.
- Adding a new domain should be approximately equivalent to adding a new configuration directory, rather than modifying core code.

Recommended directory structure (v4.3):

- `domains/<domain>/domain.yaml` (DomainDescriptor)
- `domains/<domain>/business-pack/` (BusinessPack)
- `domains/<domain>/roles/*.prompt.md`
- Optional `AGENT.md`, rule files, and domain-private resources

> Legacy compatibility: The `divisions/<division>/division.yaml` format has been deprecated. Please migrate to the v4.3 format above. The Division YAML model in the original ADR-002 text is for legacy system compatibility only. New systems must use DomainDescriptor.

## Role Model

Role definitions must explicitly express:

- Responsibility boundaries: what to do, what not to do.
- Tool capabilities: minimum privilege whitelist.
- Model tiers: `reasoning`, `coding`, `balanced`, `fast`.
- Input/output contracts: ensuring stable data transfer between steps.
- Concurrency constraints: such as `max_instances`.

Role reuse strategy:

- Role definitions can be reused across divisions.
- Roles with the same name in different divisions can form different capabilities through tool and boundary restrictions.

## Workflow Model

The internal workflow of a division is responsible for defining:

- Step sequence.
- The role used for each step.
- How input fields reference upstream outputs.
- The output keys produced by the current step.
- Which steps can fail and retry.

Constraints:

- Workflows should prioritize linear or lightweight DAG structures, avoiding premature transformation into complex orchestration languages.
- Large outputs should be stored in the artifact store, rather than being unlimitedly inlined in the state table.

## Dynamic Extension

The HR Agent is responsible for dynamically supplementing roles within existing divisions:

- Analyze capability gaps.
- Generate role contracts and prompts.
- Verify consistency of tools, boundaries, and schemas.
- Output workflow modifications as suggestions rather than automatic deployment.

Boundaries:

- HR Agent does not automatically create new divisions.
- New divisions are still explicitly added by humans through YAML.
- A new role's tool set must be a subset of the union of existing tools in the target division, avoiding permission expansion.

## Cross-Division Tasks

Cross-division tasks do not directly bypass the division system but are orchestrated by VP:

- Split into multiple subtasks.
- Establish dependency graphs.
- Verify that upstream outputs can satisfy downstream inputs.
- Aggregate outputs from various divisions into a unified result.

## Results

Advantages:

- Faster business expansion, aligning with the "platform as company" design goal.
- New businesses naturally share security, communication, storage, and recovery capabilities.
- Multi-division collaboration can be uniformly handled through the VP orchestration layer.

Constraints:

- Role tools must adhere to the principle of least privilege.
- Workflow modifications must undergo contract and schema compatibility checks.
- The more divisions there are, the higher the requirements for documentation, templates, rules, and testing.

## Cross References

- [ADR-001 Three-Layer Separation Architecture](./001-three-layer-architecture.md)
- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [Division Authoring](../guides/division-authoring.md)

## Source Sections

- `§2.3`
- `§2.4`
- `§4.5`
- `§4.6`
- `§10.1`

## v4.3 ADR Remediation

- R5-63: This ADR originally referenced old section numbers (such as `§2.3`/`§4.5`/`§10.1` etc.), which have now been updated to the correct section mappings in the architecture document.