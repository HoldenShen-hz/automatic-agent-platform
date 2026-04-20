# ADR-005 Security Model

- Status: Accepted
- Decision Date: 2026-04-02

## Context

Automatic Agent allows Agent to access tools, execute commands, call external systems, and ultimately run in multi-tenant and commercialization scenarios, so mandatory security boundaries must be established outside the model layer.

## Decision

Adopt multi-layer security model:

- Role permission layer: Each role can only access authorized tools and capabilities.
- Policy judgment layer: Rule system or policy provider makes `allow`, `deny`, `ask` judgments on commands and operations.
- Approval layer: High-risk commands, external network access, destructive operations must escalate for confirmation.
- Execution layer: Mandatory constraints through sandbox, path mapping, network isolation, and runtime audit.
- Plugin runtime layer: High-trust built-in plugins can enter independent subprocess runtime, enabling exclusive sandbox root, minimal env whitelist, and Node permission model in stronger mode.

## Four-Layer Defense Approach

Core principles:

- `deny wins`, any layer rejection terminates execution.
- Default to least privilege.
- Prompt injection cannot bypass tool boundaries and sandbox boundaries.
- When cost limit exceeded, policy violated, or LLM completely unavailable, enter read-only, pause, or termination state.

Security chain:

1. Role tool permissions filtered first.
2. Policy rules or provider judged second.
3. Escalate when needed.
4. Finally enforced by sandbox and executor.

## Operation Modes

Platform operation mode affects approval and automation boundaries:

- `supervised`: Security priority, sensitive behavior requires explicit confirmation.
- `auto`: Allows more automatic execution but still retains high-risk approval.
- `full-auto`: Only opened under stricter budget, security, and rollback conditions, still retains hard prohibitions.

## Sandbox and Execution Policy

Execution side must cover at least:

- File system access restrictions.
- Network access policy.
- Command parsing and risk classification.
- Timeout, output limits, and exception handling.
- Platform detection and adaptation to different host environments.
- Plugin SPI isolated runtime at least distinguishes `shared_process`, `forked_process`, `sandboxed_process`, and `containerized_process`; where `sandboxed_process` must be an independent restricted subprocess, and `containerized_process` must enter external independent sandbox through explicit launcher interface, not just logical constraints.

Enhanced capabilities include:

- Virtual path mapping.
- Sandbox warm pool.
- Sandbox-level file locks.
- Remote kill switch.
- Plugin runtime should retain evolution space toward container/microVM; current implementation besides Node permission model + sandbox root `sandboxed_process` also provides `containerized_process` launcher host, which can connect to external isolators like `docker`/`podman`/`bwrap`, but this still does not equal completed live orchestrator orchestration.

## Pluggable Policy Providers

Policy layer should not only support one implementation:

- Phase 1a: Rule-driven provider.
- Phase 3: AI classifier provider.
- Phase 4: Connect to enterprise policy engines like OPA.

Unified constraints:

- All provider results enter the same decision chain.
- When multiple providers coexist, `deny wins` is used.

## Authentication and Tenant Isolation

Security capabilities after commercialization also include:

- PKCE OAuth.
- Token management for Web UI/CLI.
- Multi-tenant data isolation.
- RBAC role permissions.
- Costs and outputs isolated by `user_id` or tenant.

## Results

Benefits:

- Security boundaries do not rely on model self-awareness.
- Future enterprise policy providers can seamlessly connect.
- Consistent with permission, audit, recovery, and commercialization capabilities.

Costs:

- Tool design and role design must explicitly express boundaries.
- Sandbox, audit, and approval increase implementation and testing costs.
- Must prove through testing that policy chain can truly block dangerous paths.

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
