# Runtime Sequence

> **Last Updated**: 2026-05-26
>
> This document describes the key runtime main chain of the current Automatic Agent Platform, using current object and directory naming conventions. It no longer follows the old system's `WorkflowState / Phase1bOrchestrator / TransitionService` narrative.

---

## 1. Task Admission -> Mission Resolution -> HarnessRun Creation

```text
Client / UI / SDK
  -> P1 HTTP API (`task-routes` / `mission-routes`)
  -> P2 MissionResolver / MissionGovernanceService
  -> P3 IntakeAdmissionService
  -> P5 Truth Store + Event / Outbox append
  -> P3 Harness runtime bootstrap
```

Key steps:

1. The caller submits a task or Mission association request.
2. P1 completes authentication, input validation, and tenant scope resolution.
3. P2 performs Mission resolution and permission/risk/budget/policy intersection validation.
4. P3 `IntakeAdmissionService` generates the admission chain object and creates or binds `HarnessRun`.
5. P5 writes truth and event facts in the same transaction; on failure, the entire operation rolls back without allowing only half of the state to be persisted.

Current implementation locations:

- `src/platform/five-plane-interface/api/http-server/task-routes.ts`
- `src/platform/five-plane-control-plane/mission/`
- `src/platform/five-plane-orchestration/harness/runtime/`
- `src/platform/five-plane-state-evidence/truth/`

---

## 2. Harness Orchestration -> Dispatch -> Lease -> Worker Execution

```text
HarnessRun
  -> Planner / Routing / Replan
  -> ExecutionDispatchService
  -> ExecutionLeaseService
  -> Worker Pool
  -> Execution Engine / Tool Executor / Plugin Executor
  -> Writeback with lease + fencing
```

Key steps:

1. P3 makes orchestration decisions based on `PlanGraphBundle`, constraints, risk, and context.
2. P4 `ExecutionDispatchService` selects executable tickets and workers.
3. `ExecutionLeaseService` assigns lease/fencing tokens to ensure single authoritative writeback.
4. Workers execute specific actions such as tool/plugin/browser/human-wait.
5. Execution results return to the truth store via writeback, using lease/fencing for concurrency protection.

Current implementation locations:

- `src/platform/five-plane-execution/dispatcher/`
- `src/platform/five-plane-execution/lease/`
- `src/platform/five-plane-execution/worker-pool/`
- `src/platform/five-plane-execution/execution-engine/`

---

## 3. Event Facts -> DurableEventBus -> Consumer / DLQ

```text
Producer
  -> P5 truth mutation
  -> Event append / Outbox append
  -> DurableEventBus
  -> Consumer ack / retry
  -> DLQ on terminal failure
```

Key steps:

1. Any Tier-1 status change writes to truth first, then appends event facts.
2. `DurableEventBus` is responsible for dispatching events to consumers by layer.
3. Consumer failures will no longer be silently swallowed by `DurableEventBusAsync`, but will return to the main chain for retry/alerting/DLQ.
4. After reaching the failure boundary, it enters DLQ and is handled by subsequent replay or manual recovery.

Current implementation locations:

- `src/platform/five-plane-state-evidence/events/`
- `src/platform/five-plane-state-evidence/dlq/`
- `src/platform/five-plane-state-evidence/outbox/`

---

## 4. Federation Audit / Trust Governance Main Chain

```text
Federation action
  -> FederationAudit.record()
  -> persistent snapshot / archive
  -> TrustRelationship evaluate / enforce
  -> expiry / reauth / revoke gate
```

Key steps:

1. Federation actions enter `FederationAudit`, writing activity snapshots and archiving according to policy.
2. At query time, perform multi-condition intersection filtering, not just filtering by the first index condition.
3. `TrustRelationship` checks `expiresAt`, periodic reauth, and status during admission and evaluation.
4. Expired, revoked, or unvalidated trust (beyond the window) no longer only affects scoring but directly exits the active available state.

Current implementation locations:

- `src/scale-ecosystem/federation/federation-audit.ts`
- `src/scale-ecosystem/federation/trust-relationship.ts`

---

## 5. UI Public Query Chain

```text
Web / Electron / Mobile
  -> shared api-client (`/v1/*`)
  -> runtime baseUrl = /api
  -> P1 Layer C routes
  -> MissionControl / Knowledge / Pack services
```

Key steps:

1. The frontend endpoint catalog uniformly defines `/v1/*` paths.
2. At runtime,拼接 with `baseUrl=/api`, ultimately accessing `/api/v1/*`.
3. Public queries default to Layer C routes, not `/admin/*`.
4. Representative public interfaces include:
   - `/v1/workers`
   - `/v1/queues`
   - `/v1/agents`
   - `/v1/dashboard/metrics`
   - `/v1/explanations`
   - `/v1/meta/contract-version`
   - `/v1/knowledge`
   - `/v1/marketplace`
   - `/v1/packs/:packId/versions`
   - `/v1/workflows/builder`

Current implementation locations:

- `ui/packages/shared/api-client/src/endpoints.ts`
- `ui/packages/shared/api-client/src/interceptors.ts`
- `ui/packages/shared/api-client/src/rest-client.ts`
- `ui/packages/shared/api-client/src/ws-client.ts`
- `ui/packages/shared/api-client/src/ws-event-router.ts`
- `src/platform/five-plane-interface/api/http-server/dashboard-routes.ts`
- `src/platform/five-plane-interface/api/http-server/plane-routes.ts`
- `src/platform/five-plane-interface/api/http-server/pack-routes.ts`
- `src/platform/five-plane-interface/api/http-server/task-routes.ts`

---

## 6. Electron Platform Bridge Chain

```text
Electron preload
  -> exposeInMainWorld("AA_ELECTRON")
  -> exposeInMainWorld("__AA_ELECTRON__")
  -> desktop-platform-adapter resolve bridge
  -> shared platform APIs
```

Key steps:

1. Preload exposes dual-name bridge, compatible with historical callers and current adapter.
2. `desktop-platform-adapter` prioritizes reading `__AA_ELECTRON__` and is compatible with `AA_ELECTRON`.
3. Desktop capabilities such as secure storage, deep link, shell, and windowing are uniformly injected via PlatformAdapter.

Current implementation locations:

- `ui/apps/electron-win/src/preload.ts`
- `ui/packages/shared/platform/src/desktop-platform-adapter.ts`
- `ui/packages/shared/platform/src/bridge-types.ts`

---

## 7. Current Reading Recommendations

1. To understand "how tasks enter the system", first read the P1/P2/P3 corresponding chapters in `01-code-structure.md`, then read sections 1 and 2 of this document.
2. To understand "how status and events are closed loop", first read section 3 of this document, then see the P4/P5 diagrams in `03-module-diagrams.md`.
3. To understand "how frontend connects to backend", first read sections 5 and 6 of this document, then see `05-cross-platform-ui-architecture.md`.