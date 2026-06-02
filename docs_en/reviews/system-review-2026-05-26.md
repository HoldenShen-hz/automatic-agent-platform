# System-Level Manual Review (2026-05-26)

| Field | Value |
|---|---|
| Review date | 2026-05-26 |
| Review scope | `src/`, `ui/`, `.github/workflows/`, `docs_zh/reference/` |
| Review method | Manual sampling review of high-risk links: event delivery, execution identity, federation governance, UI shell bridging, CI architecture gate |
| Current conclusion | The system's main trunk is largely complete, but 6 real gaps still need priority handling. Of these, 1 will directly break Tier-1 event reliability, 3 fall under "governance/audit state not persisted", 1 is a missing CI gate, and 1 is a broken Electron shell bridge. |

---

## Issue list

| ID | Severity | Issue | Review conclusion | Root cause | Evidence |
|---|---|---|---|---|---|
| SYS-001 | P0 | `DurableEventBusAsync` swallows async handler rejections, causing events to be incorrectly acked. | Unresolved. The current async facade converts consumer failures into successful returns; `DurableEventBus` then calls `markEventAck`, bypassing Tier-1 retry/DLQ semantics. | Reliability defect / async contract broken | `src/platform/five-plane-state-evidence/events/durable-event-bus-async.ts:44-52`; `src/platform/five-plane-state-evidence/events/durable-event-bus.ts:575-595` |
| SYS-002 | P1 | Worker identity registration returns success even when persistence fails, and prefers in-memory state for auth. | Unresolved. The registration path writes `memoryStore` first; persistence failures are silently swallowed. In-process claims continue to succeed, but identity is lost after restart, producing split behavior: "accepted in current process, rejected after restart". | State consistency / silent failure | `src/platform/five-plane-execution/worker-pool/worker-service-identity.ts:49-82`; `src/platform/five-plane-execution/worker-pool/worker-service-identity.ts:109-163` |
| SYS-003 | P1 | Federation audit claims 7-year retention, but the implementation only stores data in in-process memory. | Unresolved. `FederationAudit` only has `Map`/`Set` indexes and in-memory records, with no persistence, replay, or external repository injection. After process restart, the audit trail is completely lost, which is inconsistent with the compliance retention stance. | Governance capability not persisted | `src/scale-ecosystem/federation/federation-audit.ts:75-112`; `src/scale-ecosystem/federation/federation-audit.ts:142-190` |
| SYS-004 | P1 | Federation trust relationships are a pure in-memory model; revoke/downgrade/withdraw state does not survive restarts. | Unresolved. `TrustRelationshipManager` uses in-memory `Map` to store trust/policy/event/index; creation, revocation, and downgrade do not write to a source of truth. Multi-org collaboration governance state is reset after a process restart. | Governance capability not persisted | `src/scale-ecosystem/federation/trust-relationship.ts:94-148`; `src/scale-ecosystem/federation/trust-relationship.ts:179-240` |
| SYS-005 | P1 | Architecture boundary lint is not wired into main CI, but the reference document marks `CI-001` as completed. | Unresolved. The repository already has the `lint:architecture-boundary` command, but the `validate` job in `ci.yml` does not execute it. At the same time, the reference document `automatic_agent_system_harness_improvement_plan_v1_9_architecture_release.md` already marks `CI-001` as `completed`, which is inconsistent between the document and the actual pipeline state. | Engineering governance / doc-state drift | `package.json:222`; `.github/workflows/ci.yml:24-59`; `docs_zh/reference/automatic_agent_system_harness_improvement_plan_v1_9_architecture_release.md:1391-1396` |
| SYS-006 | P1 | The bridge name exposed by the Electron preload does not match the name read by the runtime adapter, so the desktop bridge is actually broken. | Unresolved. The preload exposes the bridge via `contextBridge.exposeInMainWorld("AA_ELECTRON", bridge)`, while `ElectronPlatformAdapter` reads from `window.__AA_ELECTRON__`. This causes secure storage, deep link, shell, and other capabilities to fall back to the default adapter for a long time. | Interface contract inconsistency | `ui/apps/electron-win/src/preload.ts:27-35`; `ui/packages/shared/platform/src/desktop-platform-adapter.ts:11-25` |

---

## Root cause summary

1. The async facade, in order to "avoid unhandled rejections", broke the main chain's success/failure semantics.
2. Multiple governance subsystems still use in-process state, lacking an authoritative store or recovery mechanism.
3. Document closure came ahead of actual CI implementation, producing a "doc completed, pipeline not enforced" drift.
4. The UI shell has a contract bug from inconsistent bridge names, causing platform capabilities to appear on the surface but not actually take effect.

---

## Suggested priority

1. Fix `SYS-001` first. This is the most direct reliability break and will cause Tier-1 event failures to be misreported as successes.
2. Second batch: `SYS-002`, `SYS-003`, `SYS-004` — converge worker identity, federation audit, and trust relationship into a recoverable source of truth.
3. Third batch: `SYS-005`, `SYS-006` — tighten CI governance and fix the real Electron bridge, respectively.

---

## Notes

1. This document only records the real issues confirmed in this round of manual review; it does not delete the content of existing review documents.
2. This round did not perform full testing, nor did it make code fixes for the above issues; the current output is only the review conclusions and evidence archival.

---

## Round 2 in-depth cross review additions (2026-05-26)

This round additionally checked federation governance, UI API contracts, frontend-backend path system, and cross-consistency between documents and implementation. The following issues are appended to the same system review ledger.

| ID | Severity | Issue | Review conclusion | Root cause | Evidence |
|---|---|---|---|---|---|
| SYS-007 | P1 | `FederationAudit.query()` only uses the first index to narrow the candidate set, but does not continue to validate other filter conditions such as `actor/action/correlationId/orgId`. | Unresolved. Multi-condition queries can yield incorrect results where "only the first condition is used to filter, subsequent conditions are ignored", making audit retrieval unreliable. | Query semantics defect / audit inconsistency | `src/scale-ecosystem/federation/federation-audit.ts:152-191` |
| SYS-008 | P1 | Federation audit retention claims to support archive-before-delete, but only increments the `archived` count with no actual archive landing. | Unresolved. `applyRetentionPolicy()` only runs comment-placeholder logic when `archiveBeforeDelete=true`, and ultimately returns "archived" without real archive evidence. | Governance loop not closed / fake archive | `src/scale-ecosystem/federation/federation-audit.ts:276-298` |
| SYS-009 | P1 | `expiresAt`, `requirePeriodicReauth`, `reauthIntervalDays` in trust policy only participate in scoring, not in admission blocking. | Unresolved. `getTrustBetweenOrgs()` only checks `status === "active"`, and does not reject due to expiration or exceeding the reauth window. `calculateTrustFactors()` only lowers the score and does not trigger `expired/suspended` state transitions. | Governance policy not enforced | `src/scale-ecosystem/federation/trust-relationship.ts:163-176`; `src/scale-ecosystem/federation/trust-relationship.ts:404-413`; `src/scale-ecosystem/federation/trust-relationship.ts:477-481` |
| SYS-010 | P1 | The UI default API prefix, endpoint catalog paths, and the real paths in tests/docs are inconsistent, so default frontend-backend integration will hit wrong addresses. | Unresolved. Web runtime defaults to `baseUrl=/api`, endpoint catalog uses unversioned paths like `/tasks`, `/workflows`, concatenating to get `/api/tasks`; but tests and architecture documents use `/api/v1/tasks`, `/api/v1/dashboard/*` as the standard. | Interface contract drift / version prefix inconsistency | `ui/apps/web/src/runtime.ts:143-149`; `ui/packages/shared/api-client/src/rest-client.ts:334-335`; `ui/packages/shared/api-client/src/endpoints.ts:177-190`; `docs_zh/architecture/05-cross-platform-ui-architecture.md:2482-2487`; `ui/tests/tools/tooling.test.ts:11-12` |
| SYS-011 | P1 | The UI endpoint catalog marks several interfaces as `planned: false` / directly consumable, but the corresponding backend routes and OpenAPI do not exist. | Unresolved. Currently at least the following drift samples exist: `/dashboard/metrics`, `/marketplace`, `/workflows/builder`, `/knowledge`, `/packs/:packId/versions`, `/explanations`. The frontend will call according to implemented interfaces, but the backend route table and OpenAPI do not have corresponding capabilities. | Frontend-backend contract mismatch / incorrect status annotation | `ui/packages/shared/api-client/src/endpoints.ts:205-221`; `src/platform/five-plane-interface/api/openapi-document.ts:1-120`; `src/platform/five-plane-interface/api/http-server/pack-routes.ts:1-146`; route scan of `src/platform/five-plane-interface/api/http-server/` did not find corresponding implementations of `/v1/marketplace`, `/v1/workflows/builder`, `/v1/explanations`, `/v1/dashboard/metrics` |
| SYS-012 | P2 | The shared Mission Control query layer directly consumes Layer B's `/admin/workers`, `/admin/queues`, conflicting with the UI architecture's "frontend only consumes Layer C" requirement. | Unresolved. The endpoint catalog already marks `workers`, `queues` as `apiLayer: "B"`, but the shared query layer still exposes them as general mission-control data sources; this hardcodes internal admin-plane contracts into the public frontend layer for the long term. | Architecture layering violation | `ui/packages/shared/api-client/src/endpoints.ts:202-203`; `ui/packages/shared/state/src/queries/mission-control-queries.ts:23-29`; `docs_zh/architecture/05-cross-platform-ui-architecture.md:2518-2548` |

### Round 2 supplementary conclusion

1. The main issues with the federation governance module have shifted from "whether the capability exists" to "whether query, retention, and policy enforcement are actually closed-loop".
2. The biggest risk in the UI subsystem is not just whether features exist, but that the "path prefix, Layer marking, interface completion status" three sets of conventions have not been converged into a single authoritative contract.
3. The area most likely to cause integration misjudgment in the current system is the shared api client: it looks complete on the surface, but a portion of its endpoints are still ahead of the real backend routes and OpenAPI.

---

## Fix results back-write (2026-05-26)

The following back-writes do not delete the prior review records; they only supplement the latest "whether it is now closed" status, root cause, and evidence.

| ID | Current conclusion | Root cause | Fix evidence | Targeted test |
|---|---|---|---|---|
| SYS-001 | Fixed. `DurableEventBusAsync` no longer swallows async consumer rejections; failures are passed back along the original chain to the durable bus, avoiding the incorrect `ack` of Tier-1 events. | The async facade, to avoid unhandled rejections, converted failures into successful completions, breaking the success/failure contract. | `src/platform/five-plane-state-evidence/events/durable-event-bus-async.ts` | `tests/unit/platform/state-evidence/events/durable-event-bus-async.test.ts` |
| SYS-002 | Fixed. Worker identity registration is now: persist first, then enter in-memory state; persistence failure directly fails closed; malformed durable payloads are also rejected for auth. | The original implementation wrote to memory first and then tried to persist, while swallowing persistence exceptions, leading to "accepted in current process, rejected after restart". | `src/platform/five-plane-execution/worker-pool/worker-service-identity.ts` | `tests/unit/platform/execution/worker-pool/worker-service-identity.test.ts`; `tests/unit/platform/execution/worker-pool/worker-service-identity-r13.test.ts` |
| SYS-003 | Fixed. Federation audit now defaults to persisting snapshots + archive files, with record recovery after restart, no longer only in-process memory. | The audit implementation only had `Map/Set` indexes, with no authoritative persistence. | `src/scale-ecosystem/federation/federation-audit.ts` | `tests/unit/scale-ecosystem/federation-audit.test.ts` |
| SYS-004 | Fixed. Trust relationship / policy / event are all now written to persistent snapshots; revoke, downgrade, and withdraw can survive restarts. | Trust governance state only existed in in-memory `Map`, with no recovery path. | `src/scale-ecosystem/federation/trust-relationship.ts` | `tests/unit/scale-ecosystem/trust-relationship.test.ts` |
| SYS-005 | Fixed. The main CI `validate` job has incorporated `lint:architecture-boundary`; the document's "completed" status and pipeline enforce are realigned. | Engineering governance convention preceded pipeline implementation, forming a "doc completed, CI not executed" drift. | `.github/workflows/ci.yml` | `npm run typecheck`; CI workflow contract verified through repo validation reads |
| SYS-006 | Fixed. Electron preload now exposes both `AA_ELECTRON` and `__AA_ELECTRON__`, and the desktop adapter also supports reading from both names; the desktop bridge is reconnected. | Preload and runtime adapter used two different bridge names. | `ui/apps/electron-win/src/preload.ts`; `ui/packages/shared/platform/src/bridge-types.ts`; `ui/packages/shared/platform/src/desktop-platform-adapter.ts` | `ui/tests/unit/ui/apps/electron-win/preload.test.ts`; `ui/tests/shared/platform.test.ts` |
| SYS-007 | Fixed. Federation audit query now performs intersection validation on all filter conditions after the index narrows the candidate set, no longer only consuming the first condition. | The query implementation only used the first index condition for filtering, and subsequent conditions were not actually executed. | `src/scale-ecosystem/federation/federation-audit.ts` | `tests/unit/scale-ecosystem/federation-audit.test.ts` |
| SYS-008 | Fixed. Retention archive-before-delete now actually writes to NDJSON archives, then deletes from the active set, no longer just a fake archive count. | The original implementation only incremented the `archived` number, with no real archive sink. | `src/scale-ecosystem/federation/federation-audit.ts` | `tests/unit/scale-ecosystem/federation-audit.test.ts` |
| SYS-009 | Fixed. `expiresAt` and periodic reauth have entered trust admission blocking; expiration or re-verification timeout transitions the trust out of the active-usable state. | Policy fields only participated in scoring, not in availability judgment of active trust. | `src/scale-ecosystem/federation/trust-relationship.ts` | `tests/unit/scale-ecosystem/trust-relationship.test.ts` |
| SYS-010 | Fixed. The shared endpoint catalog has been unified to the `/v1/*` path system; after concatenating with Web's default `/api` prefix, the correct `/api/v1/*` is obtained. | UI runtime, endpoint catalog, and docs/tests used different version prefixes. | `ui/packages/shared/api-client/src/endpoints.ts` | `ui/tests/shared/api-client.test.ts`; `ui/tests/shared/endpoint-type-contracts.test.ts` |
| SYS-011 | Fixed. Originally marked as consumable public interfaces have been supplemented with backend routes and OpenAPI: `/v1/dashboard/metrics`, `/v1/workers`, `/v1/queues`, `/v1/agents`, `/v1/explanations`, `/v1/meta/contract-version`, `/v1/knowledge`, `/v1/marketplace`, `/v1/packs/:packId/versions`, `/v1/workflows/builder`. | The frontend endpoint catalog was ahead of the real backend export surface, causing a contract drift of "frontend implemented, backend nonexistent". | `src/platform/five-plane-interface/api/http-server/dashboard-routes.ts`; `src/platform/five-plane-interface/api/http-server/plane-routes.ts`; `src/platform/five-plane-interface/api/http-server/pack-routes.ts`; `src/platform/five-plane-interface/api/http-server/task-routes.ts`; `src/platform/five-plane-interface/api/openapi-document.ts` | `tests/unit/platform/interface/api/http-server/dashboard-routes.test.ts`; `tests/unit/platform/interface/api/http-server/plane-routes.test.ts`; `tests/unit/platform/interface/api/http-server/pack-routes.test.ts`; `tests/unit/platform/interface/api/http-server/task-routes.test.ts`; `tests/unit/platform/interface/api/openapi-document.test.ts` |
| SYS-012 | Fixed. `workers`, `queues` have been elevated to Layer C public interfaces; the frontend query layer no longer depends on the Layer B admin plane paths of `/admin/*`. | The shared Mission Control query directly consumed internal admin contracts, violating UI architecture layering. | `ui/packages/shared/api-client/src/endpoints.ts`; `src/platform/five-plane-interface/api/http-server/dashboard-routes.ts` | `ui/tests/shared/endpoint-type-contracts.test.ts`; `tests/unit/platform/interface/api/http-server/dashboard-routes.test.ts` |

### Verification scope of this round

1. Main repo targeted regression:
   - `tests/unit/platform/state-evidence/events/durable-event-bus-async.test.ts`
   - `tests/unit/platform/execution/worker-pool/worker-service-identity.test.ts`
   - `tests/unit/platform/execution/worker-pool/worker-service-identity-r13.test.ts`
   - `tests/unit/scale-ecosystem/federation-audit.test.ts`
   - `tests/unit/scale-ecosystem/trust-relationship.test.ts`
   - `tests/unit/platform/interface/api/http-server/dashboard-routes.test.ts`
   - `tests/unit/platform/interface/api/http-server/plane-routes.test.ts`
   - `tests/unit/platform/interface/api/http-server/pack-routes.test.ts`
   - `tests/unit/platform/interface/api/http-server/task-routes.test.ts`
   - `tests/unit/platform/interface/api/openapi-document.test.ts`
2. UI targeted regression:
   - `ui/tests/unit/ui/apps/electron-win/preload.test.ts`
   - `ui/tests/shared/platform.test.ts`
   - `ui/tests/shared/api-client.test.ts`
   - `ui/tests/shared/endpoint-type-contracts.test.ts`
3. Type check:
   - `npm run typecheck`
