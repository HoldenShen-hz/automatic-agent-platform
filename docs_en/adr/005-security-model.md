# ADR-005 Security Model

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

- Status: Accepted
- Decision Date: 2026-04-02

## Background

Automatic Agent allows Agents to access tools, execute commands, call external systems, and ultimately run in multi-tenant and commercial scenarios. Therefore, mandatory enforcement security boundaries must be established outside the model layer.

## Decision

Adopt multi-layer security model:

- Role permission layer: Each role can only access authorized tools and capabilities.
- Policy judgment layer: Rule system or policy provider makes `allow`, `deny`, `ask` judgments on commands and operations.
- Approval layer: High-risk commands, external network access, destructive operations must escalate for confirmation.
- Execution layer: Mandatory constraints via sandbox, path mapping, network isolation, and runtime audit.
- Plugin runtime layer: High-trust built-in plugins can enter independent subprocess runtime, enabling stronger mode with exclusive sandbox root, minimum env whitelist, and Node permission model.

## Four-Layer Protection Approach

Core principles:

- `deny wins`, any layer rejection terminates execution.
- Default to minimum privilege.
- Prompt injection cannot bypass tool boundaries and sandbox boundaries.
- When cost exceeds limit, policy violation, or LLM completely unavailable, enter read-only, pause, or terminate state.

Security chain:

1. Role tool permissions filtered first.
2. Policy rules or provider judged second.
3. When needed, go through approval.
4. Finally, sandbox and executor enforce constraints.

## Runtime Modes

Platform runtime mode affects approval and automation boundaries:

- `full_auto`: Only opened under stricter budget, security, and rollback conditions.
- `supervised_auto`: Allows automatic execution, but high-risk behavior still requires supervision.
- `read_only`: Prohibits writes and side effects.
- `no-write`: Allows reading and analysis, but no write operations.
- `no-external-call`: Prohibits external network and third-party system calls.
- `no-rollout`: Prohibits release, promotion, and external impact amplification actions.
- `manual_only`: All sensitive actions require human explicit confirmation.
- `incident-mode`: Incident handling mode, priority to protect system and evidence chain.

Notes:

- `supervised/auto/full-auto` are only allowed as legacy product terminology or UI projection, no longer as canonical runtime mode enumeration.

## Sandbox and Execution Policy

Execution side must at minimum cover:

- File system access restrictions.
- Network access policies.
- Command parsing and risk classification.
- Timeout, output limits, and exception handling.
- Platform detection and different host environment adaptation.
- Plugin SPI isolated runtime distinguishes at least `shared_process`, `forked_process`, `sandboxed_process`, and `containerized_process`. `sandboxed_process` must be an independent restricted subprocess, while `containerized_process` must enter external independent sandbox via explicit launcher interface, not just relying on logical constraints.

Enhanced capabilities include:

- Virtual path mapping.
- Sandbox pre-warming pool.
- Sandbox-level file locking.
- Remote kill switch.
- Plugin runtime should retain path to container/microVM evolution. Current implementation besides Node permission model + sandbox root's `sandboxed_process`, also provides `containerized_process` launcher host, can connect to external isolators like `docker`/`podman`/`bwrap`, but this still does not equal having completed live orchestrator orchestration.

## Pluggable Policy Providers

Policy layer should not only support one implementation:

- Phase 1a: Rule-driven provider.
- Phase 3: AI classifier provider.
- Phase 4: Integrate with enterprise policy engines like OPA.

Unified constraints:

- All provider results enter same decision chain.
- When multiple providers coexist, use `deny wins`.

## Authentication and Tenant Isolation

Security capabilities for commercialization also include:

- PKCE OAuth.
- Token management for Web UI/CLI.
- Multi-tenant data isolation.
- RBAC role permissions.
- Costs and outputs isolated by `user_id` or tenant.

## Results

Benefits:

- Security boundaries do not depend on model self-awareness.
- Future enterprise policy providers can seamlessly integrate.
- Consistent with permissions, audit, recovery, and commercialization capabilities.

Costs:

- Tool and role design must explicitly express boundaries.
- Sandbox, audit, and approval increase implementation and testing costs.
- Must prove with tests that policy chain can truly block dangerous paths.

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

## v4.3 ADR Remediation

- A-22: This ADR originally only retained `supervised/auto/full-auto` three-mode runtime. Root cause was that early security model treated automation level as the only control axis, not building runtime protection modes as canonical enum. Fix: Body now converges runtime mode to the 8 kinds specified in main architecture, and demotes old three-mode to UI/product projection terminology.