# ADR-005 Security Model

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

- Status: Accepted
- Decision Date: 2026-04-02

## Background

Automatic Agent allows agents to access tools, execute commands, call external systems, and ultimately run in multi-tenant and commercial scenarios. Therefore, mandatory security boundaries must be established outside the model layer.

## Decision

Adopt a multi-layer security model:

- Role permission layer: Each role can only access authorized tools and capabilities.
- Policy judgment layer: Rule system or policy provider makes `allow`, `deny`, `ask` judgments on commands and operations.
- Approval layer: High-risk commands, external network access, and destructive operations must be escalated for confirmation.
- Execution layer: Mandatory constraints through sandbox, path mapping, network isolation, and runtime audit.
- Plugin runtime layer: High-trust built-in plugins can enter independent subprocess runtime, with enhanced mode enabling exclusive sandbox root, minimal env whitelist, and Node permission model.

## Four-Layer Defense Approach

Core principles:

- `deny wins` - any layer rejecting terminates execution.
- Default to minimum privilege.
- Prompt injection cannot bypass tool boundaries and sandbox boundaries.
- Enter read-only, pause, or termination state when cost exceeds limit, policy violation, or LLM completely unavailable.

Security chain:

1. Role tool permissions filtered first.
2. Policy rules or provider judged second.
3. Approval path when needed.
4. Finally enforced by sandbox and executor.

## Runtime Modes

The platform's runtime mode affects approval and automation boundaries:

- `full_auto`: Only opened under stricter budget, security, and rollback conditions.
- `supervised_auto`: Allows automatic execution, but high-risk behaviors still require supervision.
- `read_only`: Prohibit writes and side effects.
- `no-write`: Allow reading and analysis, but no write operations.
- `no-external-call`: Prohibit external network and third-party system calls.
- `no-rollout`: Prohibit release, promotion, and external impact amplification actions.
- `manual_only`: All sensitive actions require explicit human confirmation.
- `incident-mode`: Incident handling mode, prioritizing system and evidence chain protection.

Note:

- `supervised / auto / full-auto` are only allowed as legacy product terminology or UI projection, no longer as canonical runtime mode enumeration.

## Sandbox and Execution Policy

Execution side must cover at least:

- File system access restrictions.
- Network access policy.
- Command parsing and risk classification.
- Timeout, output limits, and exception catching.
- Platform detection and different host environment adaptation.
- Plugin SPI isolated runtime must distinguish `shared_process`, `forked_process`, `sandboxed_process`, and `containerized_process`; where `sandboxed_process` must be an independently restricted subprocess, and `containerized_process` must enter external independent sandbox through explicit launcher interface, not just logical constraints.

Enhanced capabilities include:

- Virtual path mapping.
- Sandbox warm-up pool.
- Sandbox-level file locks.
- Remote kill switch.
- Plugin runtime should retain evolution space toward container/microVM; current implementation provides `containerized_process` launcher host beyond Node permission model + sandbox root `sandboxed_process`, which can connect to external isolators like `docker` / `podman` / `bwrap`, but this still does not equal completed live orchestrator orchestration.

## Pluggable Policy Provider

Policy layer should not only support one implementation:

- Phase 1a: Rule-driven provider.
- Phase 3: AI classifier provider.
- Phase 4: Integrate with enterprise policy engines like OPA.

Unified constraints:

- All provider results enter the same decision chain.
- When multiple providers coexist, `deny wins` applies.

## Authentication and Tenant Isolation

Security capabilities after commercialization also include:

- PKCE OAuth.
- Token management for Web UI / CLI.
- Multi-tenant data isolation.
- RBAC role permissions.
- Costs and outputs isolated by `user_id` or tenant.

## Results

Advantages:

- Security boundaries do not rely on model self-awareness.
- Future enterprise policy providers can seamlessly integrate.
- Consistent with permissions, audit, recovery, and commercialization capabilities.

Constraints:

- Tool design and role design must explicitly express boundaries.
- Sandbox, audit, and approval increase implementation and testing costs.
- Must prove through testing that the policy chain can truly block dangerous paths.

## Cross References

- [ADR-006 LLM Provider Strategy](./006-llm-provider-strategy.md)
- [ADR-008 Cost Model](./008-cost-model.md)
- [ADR-009 Deployment and Operations](./009-deployment-ops.md)

## Source Sections

Note: After v4.3 migration, original §8.* section numbers have been restructured. This ADR's relevant content is now distributed across §10 (Risk Control), §19 (Delegation and Agency), §23 (Compliance and Data Governance), §27 (Security Architecture).

v4.3 valid references:
- `§10.2` Risk assessment model
- `§10.3` Risk levels and default deny policy
- `§19.2` Delegation chain depth limit
- `§23` Compliance and data governance
- `§27` Security architecture

## v4.3 ADR Remediation

- A-22: This ADR originally only retained three runtime modes: `supervised / auto / full-auto`. The root cause was that the early security model treated automation level as the sole control dimension and did not build runtime protection modes like read-only, no-write, no-external-call, no-rollout, manual-only, and incident-mode as canonical enumeration. Fix: The text now converges runtime modes to the 8 canonical modes specified in the main architecture, and demotes the old three modes to UI/product projection terminology.
