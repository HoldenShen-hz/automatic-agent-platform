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

This contract defines the safety boundaries for shared workers, shared cache, and shared queues in a multi-tenant environment.

Related documents:

- `tenant_and_organization_contract.md`
- `enterprise_secret_management_contract.md`
- `data_classification_and_prompt_handling_contract.md`

## 2. Objectives

- Prevent cross-tenant data pollution.
- Prevent residual context leakage during shared worker reuse.
- Clarify the boundary between shared infrastructure and tenant boundary.

## 3. Key Isolation Planes

- identity
- storage
- artifacts
- cache
- execution workspace
- secret scope

## 4. Rules

- Shared workers must rebuild or sanitize tenant-scoped runtime context before each execution.
- Cache keys must explicitly include tenant/workspace boundaries.
- Artifact download, debug snapshot, and inspect APIs must include tenant-aware authorization.
- Workers must not carry over secrets, prompt context, or artifact references from the previous tenant into the next task.
- Worker leases, temporary directories, sandbox, repo cache, and memory snapshots must all include tenant/workspace scope markers.
- Any execution with missing, conflicting, or unresolvable tenant scope should fail-closed.

## 5. Shared vs. Dedicated Boundaries

- Allowed to share: worker binary, base images, model connection pools, public read-only schemas
- Not allowed to share: tenant secrets, tenant runtime context, tenant file workspace, tenant-scoped memory

Supplementary rules:

- Shared queues can be used, but queue messages must explicitly carry tenant/workspace ownership.
- Shared cache hits must not be reused across tenants, even if the payload appears identical.
- Before shared worker recycling or tenant switching, context erasure and secret recovery must be completed.
- `dedicated_pool` tenants must actually map to tenant-scoped worker pools/resource pools, not merely record `isolationMode` in metadata.
- `dedicated_pool` scheduling strategy must be `dedicated_pool_only`; shared queues can receive requests, but final execution must not fall back to shared worker pools.

## 5A. Automatic Isolation Trigger

When cross-tenant risk indicators appear in shared workers or shared infrastructure, the system must automatically enter isolation mode.

- Default trigger threshold: `failure_rate > 30%` within a rolling window AND `sample_count >= min_sample_size`.
- `min_sample_size` must not be lower than `20` by default.
- Upon trigger, the following must be automatically executed: stop new scheduling, isolate worker pools, elevate audit level, require human review.
- If it is a single-tenant hotspot failure, isolation scope should be minimized to `tenant/workspace`; if ownership cannot be determined, elevate to shared worker pool-level isolation and fail-closed.
- Before automatically releasing isolation, the following must be verified: failure rate has dropped, sample size is sufficient, and context erasure and secret recovery checks have been completed.

## 6. Sealing Conclusion

Multi-tenant security does not end with adding `tenant_id` to tables. The execution state isolation of shared workers must also be formally modeled.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-51: This document originally only had qualitative isolation rules. The root cause was that the tenant isolation contract emphasized boundary principles but did not elevate shared worker risk to an enforceable automatic trigger. Fix: The main text now includes an automatic isolation trigger, requiring automatic isolation and fail-closed when `failure_rate > 30%` and `min_sample_size` is reached.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
