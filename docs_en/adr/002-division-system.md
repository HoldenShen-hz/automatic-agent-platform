# ADR-002 Domain System (Legacy Division Terminology Compatible)

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

- Status: Partially Superseded by DomainDescriptor + BusinessPack Baseline
- Decision Date: 2026-04-02

## Background

Automatic Agent's goal is not merely to support programming, but to serve as a runtime for arbitrary workflow-decomposable business. Therefore, business capabilities must extend in a declarative, pluggable, loosely-coupled manner, rather than being hardcoded in the platform core.

## Decision (v4.3 DomainDescriptor+BusinessPack Replaces Old Division YAML Model)

Model business capabilities as "Domain" (v4.3 canonical, replacing old Division YAML model):

- Each domain uses DomainDescriptor for declarative description.
- Configuration must include at least `domain_id`, `name`, `description`, `BusinessPack`, `DomainRiskSpec`, `roles`, `workflow`, `retry`.
- DomainRiskSpec defines this domain's risk level, approval requirements, and timeout configuration.
- BusinessPack encapsulates this domain's prompt templates, tool sets, and input/output contracts.
- Roles are constrained via prompt, model tier, tool permissions, input/output contracts, and preconditions.
- Adding a new domain is roughly equivalent to adding a new configuration directory, rather than modifying core code.

Recommended directory structure (v4.3):

- `domains/<domain>/domain.yaml` (DomainDescriptor)
- `domains/<domain>/business-pack/` (BusinessPack)
- `domains/<domain>/roles/*.prompt.md`
- Optional `AGENT.md`, rules files, and domain private resources

> Historical Compatibility: `divisions/<division>/division.yaml` format is deprecated. Please migrate to the v4.3 format above. The original ADR-002 Division YAML model is only for legacy system compatibility. New systems must use DomainDescriptor.

## Role Model

Role definitions need explicit expression:

- Responsibility boundaries: what to do, what not to do.
- Tool capabilities: minimum privilege whitelist.
- Model tier: `reasoning`, `coding`, `balanced`, `fast`.
- Input/output contracts: ensure stable data transfer between steps.
- Concurrency constraints: e.g., `max_instances`.

Role reuse strategy:

- Role definitions can be reused across domains.
- Same-named roles in different domains can form different capabilities via tool and boundary constraints.

## Workflow Model

Internal domain workflow defines:

- Step sequence.
- Role used for each step.
- How input fields reference upstream outputs.
- Output keys produced by current step.
- Which steps can fail and retry.

Constraints:

- Workflow should prioritize linear or lightweight DAG, avoid premature transformation into complex orchestration language.
- Large outputs should go to artifact store, not unlimited inline in state tables.

## Dynamic Extension

HR Agent is responsible for dynamically adding roles within existing domains:

- Analyze capability gaps.
- Generate role contracts and prompts.
- Verify consistency of tools, boundaries, and schemas.
- Output workflow modifications as suggestions, not auto-deployment.

Boundaries:

- HR Agent does not automatically create new domains.
- New domains are still added explicitly by humans via YAML.
- New role tool sets must be subsets of the target domain's existing tool union to avoid permission bloat.

## Cross-Domain Tasks

Cross-domain tasks do not directly bypass the domain system, but are handled by P3 Orchestration Plane:

- Decomposed into multiple subtasks.
- Dependency graph established.
- Confirm upstream outputs can satisfy downstream inputs.
- Aggregate each domain output into unified result.

## Results

Benefits:

- Business extension speed aligns with "platform as company" design goal.
- New businesses naturally share security, communication, storage, and recovery capabilities.
- Multi-domain collaboration can be uniformly handled by P3 Orchestration Plane.

Constraints:

- Role tools must adhere to minimum privilege principle.
- Workflow modifications must pass contract and schema compatibility checks.
- More domains means higher requirements for documentation, templates, rules, and tests.

## Cross-References

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

- R5-63: This ADR originally referenced old section numbers (e.g., `§2.3`/`§4.5`/`§10.1`). It has now been updated with correct section mappings from the actual architecture document.