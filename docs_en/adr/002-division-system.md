# ADR-002 Division System

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and Dual-Channel output
- **Feedback**: Signal collection, preprocessing and 7 feedback sources (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Rollout state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-02

## Background

Automatic Agent's goal is not just to support programming, but to host any business that can be decomposed into workflows. Therefore business capabilities must be extended in a declarative, pluggable, loosely-coupled manner, not hard-coded in the platform core.

## Decision (v4.3 DomainDescriptor+BusinessPack Replaces Old Division YAML)

Model business capabilities as Domain (v4.3 canonical, replacing old Division YAML model):

- Each domain uses DomainDescriptor for declarative description.
- Configuration at minimum includes domain_id, name, description, BusinessPack, DomainRiskSpec, roles, workflow, and retry.
- DomainRiskSpec defines risk level, approval requirements, and timeout configuration for this domain.
- BusinessPack encapsulates prompt templates, tool sets, and input/output contracts for this domain.
- Roles are constrained by Prompt, model tier, tool permissions, input/output contracts, and preconditions.
- Adding a new domain should be roughly equivalent to adding a new configuration directory, rather than modifying core code.

Recommended directory structure (v4.3):

- domains/<domain>/domain.yaml (DomainDescriptor)
- domains/<domain>/business-pack/ (BusinessPack)
- domains/<domain>/roles/*.prompt.md
- Optional AGENT.md, rule files, and domain-private resources

> Historical compatibility: divisions/<division>/division.yaml format has been deprecated. Please migrate to the above v4.3 format. The Division YAML model in the original ADR-002 is only for legacy system compatibility. New systems must use DomainDescriptor.

## Role Model

Role definitions must explicitly express:

- Responsibility boundaries: What to do, what not to do.
- Tool capabilities: Minimum privilege whitelist.
- Model tier: reasoning, coding, balanced, fast.
- Input/output contracts: Ensure stable data passing between steps.
- Concurrency constraints: Such as max_instances.

Role reuse strategy:

- Role definitions can be reused across divisions.
- Same-named roles in different divisions can form different capabilities through tool and boundary constraints.

## Workflow Model

Internal division workflow is responsible for defining:

- Step sequence.
- Role used for each step.
- How input fields reference upstream outputs.
- Output keys produced by the current step.
- Which steps can fail and retry.

Constraints:

- Workflows should prioritize linear or lightweight DAG structures, avoiding premature transformation into complex orchestration languages.
- Large outputs should be stored in artifact store, not unlimited inline in the state table.

## Dynamic Extension

HR Agent is responsible for dynamically supplementing roles within existing divisions:

- Analyze capability gaps.
- Generate role contracts and prompts.
- Verify consistency of tools, boundaries, and schemas.
- Output workflow modifications as suggestions rather than automatic deployment.

Boundaries:

- HR Agent does not automatically create new divisions.
- New divisions are still explicitly added by humans through YAML.
- A new role's tool set must be a subset of the union of existing tools in the target division, avoiding permission expansion.

## Cross-Division Tasks

Cross-division tasks are not directly bypassing the division system, but handled by VP Orchestration:

- Split into multiple subtasks.
- Establish dependency graphs.
- Verify that upstream outputs can satisfy downstream inputs.
- Aggregate outputs from various divisions into a unified result.

## Results

Benefits:

- Faster business expansion, aligning with the platform as company design goal.
- New businesses naturally share security, communication, storage, and recovery capabilities.
- Multi-division collaboration can be uniformly handled through the VP orchestration layer.

Constraints:

- Role tools must adhere to the principle of least privilege.
- Workflow modifications must undergo contract and schema compatibility checks.
- The more divisions there are, the higher the requirements for documentation, templates, rules, and testing.

## Cross-References

- [ADR-001 Three-Layer Separation of Powers Architecture](./001-three-layer-architecture.md)
- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [Division Authoring](../guides/division-authoring.md)

## Source Sections

- Section 2.3
- Section 2.4
- Section 4.5
- Section 4.6
- Section 10.1

## v4.3 ADR Remediation

- R5-63: This ADR originally referenced old section numbers (such as Section 2.3/4.5/10.1 etc.), which have been updated to the correct section mappings in the actual architecture doc.
