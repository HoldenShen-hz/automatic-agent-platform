# ADR-002 Division System (Historical Compatibility, Superseded by Domain Model)

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post-execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and Dual-Channel output
- **Feedback**: Signal collection, preprocessing, and 7 feedback source types (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Release state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Superseded by ADR-081 and ADR-085
- Decision Date: 2026-04-02

## Background

> Note: This ADR is preserved as a historical migration document explaining how the old `division` narrative converged to the v4.3 `DomainDescriptor + OrgUnit` model. New implementations must no longer use `division_id` as the execution truth primary key.

The goal of Automatic Agent is not merely to support programming, but to host any business that can be decomposed into workflows. Therefore, business capabilities must be extended in a declarative, pluggable, and loosely-coupled manner, rather than being hard-coded into the platform core.

## Decision

Model business capabilities as a v4.3-compliant `DomainDescriptor + BusinessPack + DomainRiskSpec` triplet; the old `division` is only allowed as a compatibility alias or product narrative projection.

### DomainDescriptor

Declarative domain identity and capability boundaries:

- `domain_id`, `name`, `description`.
- `capabilities[]`: List of capabilities exposed by this domain.
- `constraints[]`: Runtime constraints (budget, timeout, concurrency).
- `risk_profile`: Associated DomainRiskSpec reference.

### BusinessPack

Pluggable business capability package:

- Corresponds to an independent package under `src/domains/business-pack/`.
- Contains roles, workflows, prompts, tools, and schema.
- Interacts with the platform through PluginSPI without polluting core code.
- Recommended directory structure: `business-pack/<domain>/manifest.yaml`.

### DomainRiskSpec

Domain risk specification (v4.3 §10 mandatory requirement):

| Level | Strategy |
|-------|----------|
| `advisory_only` | Provides advice only, requires human confirmation |
| `human_accountable` | All executions require human approval |
| `deterministic_hot_path_only` | Only deterministic execution paths allowed |

High-risk domains (quant-trading / financial-services / healthcare / legal) must declare DomainRiskSpec.

## Role Model

Role definitions require explicit expression of:

- Responsibility boundaries: What to do, what not to do.
- Tool capabilities: Minimum-privilege whitelist.
- Model tier: `reasoning`, `coding`, `balanced`, `fast`.
- Input/output contracts: Ensuring stable data transfer between steps.
- Concurrency constraints: Such as `max_instances`.

Role reuse strategy:

- Role definitions can be reused across domains.
- Roles with the same name in different domains can form different capabilities through tool and boundary restrictions.

## Cross-Domain Tasks

Cross-domain tasks are handled by the P3 orchestration plane:

- Split into multiple subtasks.
- Establish dependency graph.
- Verify upstream output can satisfy downstream input.
- Aggregate domain outputs into unified results through PlanGraphBundle.

## Dynamic Extension

The HR Agent is responsible for dynamically supplementing roles within existing domains:

- Analyze capability gaps.
- Generate role contracts and prompts.
- Verify consistency of tools, boundaries, and schema.
- Output workflow modifications as suggestions, not automatic deployment.

Boundaries:

- HR Agent does not automatically create new domains.
- New domains are still explicitly added by humans through BusinessPack.
- New role tool collections must be a subset of the target domain's existing tool union to avoid permission inflation.

## Results

Advantages:

- Fast business extension velocity, aligned with the "platform as company" design goal.
- New businesses naturally share security, communication, storage, and recovery capabilities.
- Multi-domain collaboration can be uniformly handled by the P3 orchestration plane.

Constraints:

- Role tools must adhere to the minimum-privilege principle.
- Workflow modifications must pass contract and schema compatibility checks.
- The more domains/packs, the higher the requirements for documentation, templates, rules, and testing.

## v4.3 ADR Remediation

- R8-76: This ADR originally used "division" as the canonical subject for business and execution boundaries. The root cause was that early organizational modeling preceded the domain model freeze. Fix: The text now explicitly states that `division` is retained only as a historical narrative or alias; the runtime canonical binding is uniformly converged to `domain_id / DomainDescriptor`, and organizational responsibility boundaries are handled by `OrgUnit`.

## Cross References

- [ADR-001 Three-Layer Separation Architecture](./001-three-layer-architecture.md)
- [ADR-004 Workflow and Routing](./004-workflow-routing.md)
- [ADR-081 Domain Descriptor and Onboarding](./081-domain-descriptor-and-onboarding.md)
- [ADR-085 Organization Governance and Knowledge Boundary](./085-organization-governance-and-knowledge-boundary.md)
- [Division Authoring](../guides/division-authoring.md)

## Source Sections

Note: After v4.3 migration, original section numbers §2.3/§2.4/§4.5/§4.6/§10.1 have been restructured. This ADR's relevant content is now distributed across §4 (Five-Plane Architecture), §10 (Risk Control), §40 (Goal Decomposition), §55 (Scale Ecosystem - Commercialization).

v4.3 valid references:
- `§4` Five-plane+X1 architecture
- `§10.1` Domain risk specification
- `§40.2` Goal decomposition and capability verification
- `§55` Commercialization and Marketplace
