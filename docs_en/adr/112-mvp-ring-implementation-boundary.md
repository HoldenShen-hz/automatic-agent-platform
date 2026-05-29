# ADR-112: MVP Ring Implementation Boundary

- Status: Accepted
- Decision Date: 2026-04-27

## Background

The platform target state includes enterprise governance, 24 domains, multi-region, Marketplace, Edge, PlatformOps, and operational maturity capabilities. If the first implementation attempts to fully achieve the target state in one iteration, v4.3 Contract Freeze will be slowed by peripheral capabilities, and core HarnessRuntime cannot form a runnable闭环.

## Decision

1. v4.3 advances in three rings:
   - Ring 1 MVP: contract freeze, intake, HarnessRun, PlanGraphBundle, Graph Scheduler, NodeRun, NodeAttemptReceipt, Budget, SideEffect, HITL basic, Event/Audit/Evidence.
   - Ring 2 Hardening: replay, recovery, lease/fencing, DLQ, diagnostics, evidence bundle, runtime drill.
   - Ring 3 Enterprise: organization governance, SSO/SCIM, multi-tenant isolation, multi-region, Marketplace, Edge, PlatformOps, 24 domain batch onboarding.
2. Ring 1 is the first goal for code implementation; Ring 2/3 must not反向阻塞 Ring 1's API, schema, state machine, and test freeze.
3. v4.3 contract in `docs_zh/contracts/` is Ring 1's implementation entry; old contracts can serve as historical compatibility description, but do not define MVP main chain.
4. 24 domains, 12 DomainRecipe prototypes, and enterprise-scale capabilities are onboarded by wave after core runtime semantics stabilize.

## Ring 1 Acceptance Boundary

- Can create `RequestEnvelope` from `TaskDraft` via `ConfirmedTaskSpec`.
- Can create and advance `HarnessRun`.
- Can receive `PlanGraphBundle` and schedule ready `NodeRun`.
- Can record `NodeAttempt` and `NodeAttemptReceipt`.
- Can advance state via `RuntimeStateMachine.transition(command)` and append `platform.*` fact event.
- Can execute budget reservation / settlement and side effect reconciliation / compensation minimum闭环.
- Can record `DecisionInputBundle`, `HarnessDecision`, and `HumanResponsibilityRecord`.

## Consequences

- Current development plan prioritizes updating `docs_zh/operations/current_todo_list.md`, ADR, and contract.
- Code implementation uses `src/platform/contracts/` and runtime MVP as the first batch landing points.
- `docs_en/` is not modified in this round.

## Related Documents

- [109-contract-freeze.md](./109-contract-freeze.md)
- [00-platform-architecture.md](../architecture/00-platform-architecture.md)
- [current_todo_list.md](../operations/current_todo_list.md)