# Stable Core Scope

## 1. Goal

This document defines the minimum system scope allowed during the "achievable stable operation" phase.

Its purpose is not to expand functionality, but to narrow scope, reduce instability sources, and let the team first stabilize the core execution chain.

## 2. Stable Core Definition

Stable Core refers to the implementation subset deliberately limited by the current system to achieve "stable operation".

It must satisfy:

- Scope is small enough to be controllable.
- Dependencies are few enough to be verifiable.
- Failure paths are recoverable.
- Cost and risk are predictable.

## 3. Included Scope

### 3.1 Deployment and Operation Mode

- Single machine.
- Single process or minimum multi-process.
- SQLite.
- Local filesystem.
- Both `supervised` and `auto` modes.

### 3.2 Orchestration and Business Scope

- Single division.
- Single Agent main chain.
- Minimum workflow engine.
- Approval, budget, recovery, observability baseline.
- Minimum inspect, health, and human takeover entry points.

### 3.3 Tool Scope

- Few core tools.
- Controlled `bash`.
- Controlled `read/write/edit`.
- Basic provider calls.
- Necessary artifact output capability.

## 4. Explicitly Not Included

During Stable Core phase, the following are explicitly not done:

- Multi-division concurrent orchestration.
- Remote worker.
- Plugin marketplace.
- HR dynamic role creation.
- Complex evolution engine.
- Large-scale memory autonomous extraction and rewrite.
- Enterprise multi-tenant.
- Enterprise SSO/RBAC/private deployment.
- `full-auto` mode.

## 5. Stability Goals

Stable Core must at least achieve:

- Continuous operation for `7 ~ 14` days.
- Core task success rate stable above agreed baseline.
- Recoverable after `kill -9`, tool failure, SQLite conflict, event duplication.
- State, events, approvals, and cost records are reconcilable.
- No serious security incidents.
- Cost is controllable and explainable.

## 6. Required Validations

- State machine legal transition tests.
- Idempotency and recovery tests.
- Key event replay/dead-letter tests.
- Backup recovery tests.
- Cancel propagation tests.
- Concurrent conflict and file lock competition tests.
- `24h` soak test.
- `72h` soak test.

Formal validation requirements see:

- [./stable_runtime_validation_plan.md](./stable_runtime_validation_plan.md)

## 7. Threshold for Entering Next Phase

Only after Stable Core runs stably, expansion is allowed to:

- More complex workflow within single division.
- More tools.
- More complex provider strategies.
- Higher concurrency.
- Remote coordination preparation.

In other words:

- Do not expand scope with excuse "supplement stability later" before Stable Core is stable.

## 8. Relationship with Other Documents

- It is the stability convergence supplement of [phases/phase-1a-foundation.md](./phases/phase-1a-foundation.md).
- It is the scope pruning rule for [system_improvement_roadmap.md](./system_improvement_roadmap.md) at current phase.
- Together with [../reviews/stable_runtime_blockers_checklist.md](../reviews/stable_runtime_blockers_checklist.md) defines the minimum threshold for "stable operation".
- Its implementation sequence is constrained by [stable_launch_execution_plan.md](./stable_launch_execution_plan.md).
