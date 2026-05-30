# Tenant Isolation And Shared Worker Safety Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines the security boundaries for shared workers, shared cache, and shared queues in a multi-tenant environment.

Related documents:

- `tenant_and_organization_contract.md`
- `enterprise_secret_management_contract.md`
- `data_classification_and_prompt_handling_contract.md`

## 2. Objectives

- Prevent cross-tenant data contamination.
- Prevent context leakage during shared worker reuse.
- Clarify the boundary between shared infrastructure and tenant boundaries.

## 3. Key Isolation Planes

- identity
- storage
- artifacts
- cache
- execution workspace
- secret scope

## 4. Rules

- Shared workers must rebuild or purge tenant-scoped runtime context before each execution.
- Cache keys must explicitly include tenant/workspace boundaries.
- Artifact download, debug snapshots, and inspect APIs must use tenant-aware authorization.
- Workers must not carry forward the previous tenant's secrets, prompt context, or artifact references into the next task.
- Worker leases, temporary directories, sandboxes, repo caches, and memory snapshots must all have tenant/workspace scope markers.
- Any execution with missing, conflicting, or unresolvable tenant scope must fail-closed.

## 5. Shared vs. Dedicated Boundaries

- Allowable shared: worker binaries, base images, model connection pools, public read-only schemas
- Not allowable shared: tenant secrets, tenant runtime context, tenant file workspace, tenant-scoped memory

Supplementary rules:

- Shared queues may be shared, but queue messages must explicitly carry tenant/workspace ownership.
- Shared cache hits must not be reused across tenants, even if payloads appear identical.
- Shared workers must complete context erasure and secret recovery before recycling or switching tenants.
- `dedicated_pool` tenants must actually map to tenant-scoped worker pools/resource pools, not just record `isolationMode` in metadata.
- `dedicated_pool` scheduling strategy must be `dedicated_pool_only`; shared queues may accept orders, but final execution must not fall back to the shared worker pool.

## 5A. Automatic Isolation Triggers

When shared workers or shared infrastructure show signs of cross-tenant risk, the system must automatically enter isolation mode.

- Default trigger threshold: `failure_rate > 30%` within a rolling window AND `sample_count >= min_sample_size`.
- `min_sample_size` default must not be lower than `20`.
- Upon trigger, must automatically execute: stop new scheduling, isolate worker pools, elevate audit level, require human review.
- For single-tenant hotspot failures, isolation scope should be minimized to `tenant/workspace`; if ownership cannot be determined, escalate to shared worker pool-level isolation and fail-closed.
- Before automatically releasing isolation, must see failure rate drop, sample size met, and context erasure and secret recovery checks completed.

## 6. Conclusion

Multi-tenant security is not complete by simply adding `tenant_id` to tables; execution-state isolation of shared workers must also be formally modeled.

## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-51: This document previously only had qualitative isolation rules. Root cause: the tenant isolation contract emphasized boundary principles but did not elevate shared worker risk to an enforceable automatic trigger. Fix: The main text now adds automatic isolation triggers, requiring automatic isolation and fail-closed behavior when `failure_rate > 30%` and `min_sample_size` is reached.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR may only be used as `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.