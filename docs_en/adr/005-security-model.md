# ADR-005 Security Model

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

Automatic Agent allows Agents to access tools, execute commands, call external systems, and ultimately run in multi-tenant and commercial scenarios. Therefore, mandatory security boundaries must be established outside the model layer.

## Decision

Adopt a multi-layer security model:

- Role permission layer: Each role can only access authorized tools and capabilities.
- Policy judgment layer: Rule system or policy provider makes `allow`, `deny`, `ask` judgments on commands and operations.
- Approval layer: High-risk commands, external network access, and destructive operations must be escalated for confirmation.
- Execution layer: Mandatory constraints via sandbox, path mapping, network isolation, and runtime auditing.
- Plugin runtime layer: High-trust built-in plugins can enter independent subprocess runtime, enabling exclusive sandbox root, minimum env whitelist, and Node permission model in stronger mode.

## Four-Layer Defense Approach

Core principles:

- `deny wins`: Any single layer rejection terminates execution.
- Default to minimum privilege.
- Prompt injection cannot cross tool boundaries or sandbox boundaries.
- On cost overrun, policy violation, or complete LLM unavailability, enter read-only, pause, or terminate state.

Security chain:

1. Role tool permissions filtered first.
2. Policy rules or provider judged second.
3. Approval when needed.
4. Finally enforced by sandbox and executor.

## Execution Modes

Platform execution mode affects approval and automation boundaries:

- `supervised`: Security first; sensitive behaviors require explicit confirmation.
- `auto`: Allows more auto-execution but still retains high-risk approval.
- `full-auto`: Only opened under stricter budget, security, and rollback conditions; still retains hard prohibitions.

## Sandbox and Execution Policy

Execution side must cover at minimum:

- File system access restrictions.
- Network access policy.
- Command parsing and risk classification.
- Timeout, output limits, and exception handling.
- Platform detection and adaptation for different host environments.
- Plugin SPI isolated runtime must distinguish `shared_process`, `forked_process`, `sandboxed_process`, and `containerized_process`; where `sandboxed_process` must be an independently restricted subprocess, and `containerized_process` must enter external independent sandbox via explicit launcher interface, not just logical constraints.

Enhanced capabilities include:

- Virtual path mapping.
- Sandbox warm-up pool.
- Sandbox-level file locks.
- Remote kill switch.
- Plugin runtime should retain evolution space toward container/microVM; current implementation besides Node permission model + sandbox root `sandboxed_process` also provides `containerized_process` launcher host, which can connect to external isolators like `docker`/`podman`/`bwrap`, but this still does not equal completing live orchestrator orchestration.

## Pluggable Policy Providers

Policy layer should not support only one implementation:

- Phase 1a: Rule-driven provider.
- Phase 3: AI classifier provider.
- Phase 4: Integration with enterprise policy engines like OPA.

Unified constraints:

- All provider results enter the same decision chain.
- When multiple providers coexist, `deny wins` is applied.

## Authentication and Tenant Isolation

Post-commercialization security capabilities also include:

- PKCE OAuth.
- Web UI / CLI token management.
- Multi-tenant data isolation.
- RBAC role permissions.
- Costs and outputs isolated by `user_id` or tenant.

## Consequences

Advantages:

- Security boundaries do not rely on model self-awareness.
- Future enterprise policy providers can seamlessly integrate.
- Consistent with permission, audit, recovery, and commercialization capabilities.

Costs:

- Tool design and role design must explicitly express boundaries.
- Sandbox, audit, and approval increase implementation and testing costs.
- Must prove via tests that the policy chain can truly block dangerous paths.

## Cross-References

- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-008 Cost Model](./008-cost-model.md)
- [ADR-009 Deployment and Operations](./009-deployment-ops.md)

## Source Sections

- `§8.1`
- `§8.1.1`
- `§8.1.2`
- `§8.2`
- `§8.3`
- `§8.4`
- `§8.5`
- `§8.6`
