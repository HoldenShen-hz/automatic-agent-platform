# ADR-005 Security Model

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

Automatic Agent allows agents to access tools, execute commands, invoke external systems, and ultimately operate in multi-tenant and commercial scenarios. Therefore, enforced security boundaries must be established beyond the model layer.

## Decision

Adopt a multi-layer security model:

- Role permission layer: Each role can only access authorized tools and capabilities.
- Policy judgment layer: Rule system or policy provider makes allow, deny, ask judgments on commands and operations.
- Approval layer: High-risk commands, external network access, destructive operations must be escalated for confirmation.
- Execution layer: Enforced constraints via sandbox, path mapping, network isolation, and runtime auditing.
- Plugin runtime layer: High-trust built-in plugins can enter independent subprocess runtimes, with exclusive sandbox root, minimal env whitelist, and Node permission model enabled in enhanced mode.

## Four-Layer Defense Approach

Core principles:

- deny wins: Any layer rejecting terminates execution.
- Default to least privilege.
- Prompt injection cannot cross tool boundaries or sandbox boundaries.
- When cost limits, policy violations, or LLM complete unavailability occur, the system enters read-only, paused, or terminated state.

Security chain:

1. Role tool permissions are filtered first.
2. Policy rules or provider make a second judgment.
3. Approval is invoked when needed.
4. Sandbox and executor enforce the final execution.

## Running Modes

The platform's running mode affects approval and automation boundaries:

- full_auto: Only enabled under stricter budget, security, and rollback conditions.
- supervised_auto: Allows automatic execution, but high-risk behaviors still require supervision.
- read_only: Prohibits writes and side effects.
- no-write: Allows reading and analysis, but prohibits any write operations.
- no-external-call: Prohibits external network and third-party system calls.
- no-rollout: Prohibits release, rollout, and external impact amplification actions.
- manual_only: All sensitive actions require explicit human confirmation.
- incident-mode: Incident handling mode, prioritizing system and evidence chain protection.

Notes:

- supervised, auto, and full-auto are only permitted as legacy product terminology or UI projections, no longer serving as canonical runtime mode enumerations.

## Sandbox and Execution Strategy

The execution side must cover at minimum:

- File system access restrictions.
- Network access policy.
- Command parsing and risk classification.
- Timeout, output limits, and exception handling.
- Platform detection and different host environment adaptation.
- Plugin SPI isolated runtime must distinguish between shared_process, forked_process, sandboxed_process, and containerized_process. Where sandboxed_process must be an independently restricted subprocess, and containerized_process must enter an external independent sandbox via an explicit launcher interface, not relying solely on logical constraints.

Enhanced capabilities include:

- Virtual path mapping.
- Sandbox warm-up pool.
- Sandbox-level file locks.
- Remote kill switch.
- Plugin runtime should retain evolution space toward container or microVM. Current implementation besides sandboxed_process with Node permission model plus sandbox root, also provides containerized_process launcher host, which can integrate with external isolators such as docker, podman, or bwrap, but this still does not equal completed live orchestrator orchestration.

## Pluggable Policy Providers

The policy layer should not support only one implementation:

- Phase 1a: Rule-driven provider.
- Phase 3: AI classifier provider.
- Phase 4: Integration with enterprise policy engines such as OPA.

Unified constraints:

- All provider results enter the same decision chain.
- When multiple providers coexist, deny wins is applied.

## Authentication and Tenant Isolation

Commercial security capabilities also include:

- PKCE OAuth.
- Token management for Web UI and CLI.
- Multi-tenant data isolation.
- RBAC role permissions.
- Costs and deliverables isolated by user_id or tenant.

## Results

Benefits:

- Security boundaries do not rely on model self-awareness.
- Future enterprise policy providers can seamlessly integrate.
- Maintains consistency with permissions, auditing, recovery, and commercialization capabilities.

Costs:

- Tool design and role design must explicitly express boundaries.
- Sandbox, auditing, and approval increase implementation and testing costs.
- Must prove through tests that the policy chain can truly block dangerous paths.

## Cross-References

- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-008 Cost Model](./008-cost-model.md)
- [ADR-009 Deployment and Operations](./009-deployment-ops.md)

## Source Sections

- Section 8.1
- Section 8.1.1
- Section 8.1.2
- Section 8.2
- Section 8.3
- Section 8.4
- Section 8.5
- Section 8.6

## v4.3 ADR Remediation

- A-22: This ADR originally only kept three running modes supervised, auto, and full-auto. Root cause being that the early security model treated automation level as the only control dimension and did not build runtime protection modes like read-only, no-write, no-external-call, no-rollout, manual-only, incident-mode as canonical enumerations. Fix: The main text now converges running modes to the 8 runtime modes specified in the main architecture, and degrades the old three tiers to UI and product projection terminology.
