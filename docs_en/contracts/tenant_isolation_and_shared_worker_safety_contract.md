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

- Prevent cross-tenant data pollution.
- Prevent context leakage during shared worker reuse.
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
- Cache keys must explicitly include tenant / workspace boundaries.
- Artifact download, debug snapshot, and inspect API must all carry tenant-aware authorization.
- Workers must not carry the previous tenant's secrets, prompt context, or artifact references into the next task.
- Worker leases, temporary directories, sandbox, repo cache, and memory snapshots must all carry tenant / workspace scope markers.
- Any execution with missing, conflicting, or indeterminate tenant scope should fail-closed.

## 5. Shared vs. Dedicated Boundaries

Allowed to share: worker binary, base image, model connection pool, public read-only schema

Not allowed to share: tenant secrets, tenant runtime context, tenant file workspace, tenant-scoped memory

Supplementary rules:

- Shared queues can be shared, but queue messages must explicitly carry tenant / workspace ownership.
- Shared cache hits must not be reused across tenants, even if payloads appear identical.
- Before shared worker recycling or tenant switching, context erasure and secret recovery must be completed.

## 5A. Automatic Isolation Triggers

When shared workers or shared infrastructure show signs of cross-tenant risk, system must automatically enter isolation mode.

- Default trigger threshold: failure_rate > 30% within rolling window AND sample_count >= min_sample_size.
- `min_sample_size` default must not be lower than `20`.
- After trigger, must automatically execute: stop new scheduling, isolate worker pool, elevate audit level, require human review.
- If single tenant hot spot fault, isolation scope should be minimized to `tenant / workspace`; if ownership cannot be determined, elevate to shared worker pool level isolation and fail-closed.
- Before automatically releasing isolation, must see failure rate decline, sample size satisfied, and context erasure and secret recovery checks completed.

## 6. Closure Conclusion

Multi-tenant security is not complete by just adding a `tenant_id` to tables; the execution state isolation of shared workers must also be formally modeled.


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If this document's historical paragraphs conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-51: This document originally only had qualitative isolation rules. Root cause: tenant isolation contract emphasized boundary principles, but did not elevate shared worker risk to executable automatic triggers. Fix: This version adds automatic isolation triggers, requiring automatic isolation and fail-closed when failure_rate > 30% AND min_sample_size is reached.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budget must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
